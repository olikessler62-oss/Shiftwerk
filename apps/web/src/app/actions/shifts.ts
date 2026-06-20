"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { buildShiftTimestamps, shiftTimeFromTimestamp } from "@/lib/dates";
import {
  areaCalendarShiftsCacheTag,
  weekStartsForShiftCacheInvalidation,
} from "@/lib/cached-areacalendar-shifts";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { resolveSimulatedProposedAssignOptions } from "@/lib/shift-confirmation-assign-mode";
import { isPastShiftDate } from "@/lib/planning-readonly";
import {
  canDeleteShift,
  shiftDeleteBlockedActionError,
} from "@/lib/shift-deletion-policy";
import { shiftsOverlapIso } from "@/lib/shift-overlap";
import {
  DEFAULT_COUNTRY_CODE,
  getOrgFeaturesFromPlanningMode,
  resolveConfirmationAssignPatch,
  resolveEffectiveConfirmationStatus,
  resolveOrganizationTimeZone,
  validateEmployeeNotAbsentOnDate,
  validateProfileForShiftConfirmationAssign,
  validateRestPeriodForCountry,
  validateShiftDurationForCountry,
  validateShiftServiceHoursForArea,
  validateEmployeeDayShiftAssignments,
  weekdayIndexFromDate,
  restWeekStaffingDemandEligible,
  isoWeekStartFromShiftDate,
  isoWeekEndFromWeekStart,
  resolveProfileWeeklyHoursTarget,
  validateEmployeeWeeklyHoursAfterAssign,
  type PlanningMode,
  type WeeklyShiftHourWindow,
} from "@schichtwerk/database";
import { remainingAssignableWeekDates } from "@/lib/shift-assign-rest-of-week";
import type { ShiftAssignValidationContext } from "@/lib/shift-assign-validation";
import {
  setShiftAssignUndoBatch,
  takeShiftAssignUndoBatch,
  type ShiftAssignUndoBatch,
  type ShiftUndoSnapshot,
} from "@/lib/shift-assign-undo-store";
import {
  areAreaCalendarShiftTimesComplete,
} from "@/lib/available-employees-for-shift";
import {
  loadShiftAssignValidationContext,
  mergeShiftAssignWarnings,
  validateShiftAssignEligibility,
} from "@/lib/shift-assign-validation";
import type { EmployeeShiftRecord } from "@schichtwerk/database";

export type ShiftActionResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; error: string };

type AssignShiftWithTimesInput = {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  areaShiftTemplateId: string | null;
  locationId: string;
  locationAreaId: string | null;
  withoutServiceHours?: boolean;
  /** Bestehende Schicht per ID aktualisieren (Mehrfach-Schichten pro Tag). */
  existingShiftId?: string;
  /** Superadmin-Simulation: Zuweisungen als proposed speichern. */
  simulatedProposedOnAssign?: boolean;
  /** Superadmin: App-Registrierungs-Gate umgehen. */
  relaxAppRegistrationGate?: boolean;
  /** Gleiche Schicht an weiteren Wochentagen der sichtbaren Woche (still, wenn Bedingungen verletzt). */
  assignToRemainingWeekDays?: boolean;
  weekDates?: readonly string[];
};

function buildAssignSnapshotSource(
  input: AssignShiftWithTimesInput,
  starts_at: string,
  ends_at: string
) {
  return {
    employee_id: input.employeeId,
    location_id: input.locationId,
    location_area_id: input.locationAreaId,
    area_shift_template_id: input.areaShiftTemplateId,
    shift_date: input.shiftDate,
    starts_at,
    ends_at,
    notes: null as string | null,
  };
}

export type AssignShiftBatchRowInput = {
  employeeId: string;
  startTime: string;
  endTime: string;
  areaShiftTemplateId: string | null;
  /** Bestehende Ankertag-Schicht (Mehrfach-Modal mit Restwoche). */
  existingShiftId?: string;
};

export type AssignShiftBatchRowResult =
  | { rowIndex: number; ok: true; warnings?: string[] }
  | { rowIndex: number; ok: false; error: string };

export type AssignShiftBatchResult =
  | {
      ok: true;
      results: AssignShiftBatchRowResult[];
      undoAvailable: boolean;
      savedRowCount: number;
    }
  | { ok: false; error: string };

function toUndoSnapshot(row: EmployeeShiftRecord): ShiftUndoSnapshot {
  return {
    id: row.id,
    employee_id: row.employee_id,
    area_shift_template_id: row.area_shift_template_id,
    location_id: row.location_id,
    location_area_id: row.location_area_id,
    shift_date: row.shift_date,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    created_by: row.created_by,
  };
}

function findOverlappingShifts(
  existing: EmployeeShiftRecord[],
  startsAt: string,
  endsAt: string
): EmployeeShiftRecord[] {
  return existing.filter((shift) =>
    shiftsOverlapIso(shift.starts_at, shift.ends_at, startsAt, endsAt)
  );
}

async function canSilentlyAssignShiftOnRestWeekDay(
  db: Awaited<ReturnType<typeof getDatabase>>,
  organizationId: string,
  planningMode: PlanningMode,
  assignCtx: ShiftAssignValidationContext,
  input: AssignShiftWithTimesInput,
  targetDate: string,
  timeZone: string
): Promise<boolean> {
  if (targetDate <= input.shiftDate || isPastShiftDate(targetDate)) return false;
  if (!areAreaCalendarShiftTimesComplete(input.startTime, input.endTime)) {
    return false;
  }

  const absenceCheck = validateEmployeeNotAbsentOnDate(
    input.employeeId,
    assignCtx.absences,
    targetDate
  );
  if (!absenceCheck.ok) return false;

  const orgFeatures = getOrgFeaturesFromPlanningMode(planningMode);
  if (
    orgFeatures.serviceHours &&
    input.locationAreaId &&
    !input.withoutServiceHours
  ) {
    const serviceHoursCheck = validateShiftServiceHoursForArea(
      assignCtx.serviceHours ?? [],
      input.locationAreaId,
      assignCtx.countryCode,
      targetDate,
      input.startTime,
      input.endTime
    );
    if (!serviceHoursCheck.ok) return false;
  }

  if (
    orgFeatures.qualifications &&
    input.locationAreaId &&
    !input.withoutServiceHours
  ) {
    const employeeQualificationIds =
      assignCtx.profileQualificationIds?.get(input.employeeId) ?? new Set<string>();
    if (
      !restWeekStaffingDemandEligible({
        areaId: input.locationAreaId,
        countryCode: assignCtx.countryCode,
        shiftDate: targetDate,
        startTime: input.startTime,
        endTime: input.endTime,
        employeeId: input.employeeId,
        serviceHours: assignCtx.serviceHours ?? [],
        staffingRules: assignCtx.staffingRules ?? [],
        employeeQualificationIds,
        qualificationNameById: assignCtx.qualificationNameById ?? new Map(),
      })
    ) {
      return false;
    }
  }

  const { starts_at, ends_at } = buildShiftTimestamps(
    targetDate,
    input.startTime,
    input.endTime,
    timeZone
  );

  const employeeDayShifts = await db.listShiftsForEmployeeDate(
    input.employeeId,
    targetDate
  );
  if (findOverlappingShifts(employeeDayShifts, starts_at, ends_at).length > 0) {
    return false;
  }

  const weeklyCheck = await validateShiftWeeklyHoursCompliance(
    input.employeeId,
    targetDate,
    input.startTime,
    input.endTime,
    timeZone
  );
  if (!weeklyCheck.ok) return false;

  return true;
}

async function assignShiftToRemainingWeekDaysSilently(
  organizationId: string,
  userId: string,
  planningMode: PlanningMode,
  assignCtx: ShiftAssignValidationContext,
  input: AssignShiftWithTimesInput,
  weekDates: readonly string[],
  undoBatch: ShiftAssignUndoBatch,
  timeZone: string,
  shiftConfirmationEnabled: boolean
): Promise<string[]> {
  const db = await getDatabase();
  const assignedDates: string[] = [];

  for (const targetDate of remainingAssignableWeekDates(
    input.shiftDate,
    weekDates
  )) {
    const eligible = await canSilentlyAssignShiftOnRestWeekDay(
      db,
      organizationId,
      planningMode,
      assignCtx,
      input,
      targetDate,
      timeZone
    );
    if (!eligible) continue;

    try {
      await persistShiftWithTimes(
        organizationId,
        userId,
        { ...input, shiftDate: targetDate, existingShiftId: undefined },
        undoBatch,
        timeZone,
        shiftConfirmationEnabled
      );
      assignedDates.push(targetDate);
    } catch {
      // Bedingung verletzt oder Persist fehlgeschlagen — Tag überspringen.
    }
  }

  return assignedDates;
}

async function validateShiftLaborCompliance(
  organizationId: string,
  employeeId: string,
  shiftDate: string,
  startTime: string,
  endTime: string,
  timeZone: string,
  options?: { sameDayBatchPeerCount?: number; excludeShiftIds?: ReadonlySet<string> }
): Promise<{ ok: true; warnings?: string[] } | { ok: false; error: string }> {
  const db = await getDatabase();
  const countryCode =
    (await db.getOrganizationCountryCode(organizationId)) ?? DEFAULT_COUNTRY_CODE;
  const weekday = weekdayIndexFromDate(shiftDate);

  const durationCheck = validateShiftDurationForCountry({
    countryCode,
    start_time: startTime,
    end_time: endTime,
    weekday,
    shiftDate,
    point: "shift_assign",
  });
  if (!durationCheck.ok) return durationCheck;

  const { starts_at, ends_at } = buildShiftTimestamps(
    shiftDate,
    startTime,
    endTime,
    timeZone
  );
  const excludeIds = options?.excludeShiftIds ?? new Set<string>();
  const sameDay = (await db.listShiftsForEmployeeDate(employeeId, shiftDate)).filter(
    (shift) => !excludeIds.has(shift.id)
  );
  const overlappingIds = new Set(
    findOverlappingShifts(sameDay, starts_at, ends_at).map((shift) => shift.id)
  );
  const otherSameDayCount = sameDay.filter(
    (shift) => !overlappingIds.has(shift.id)
  ).length;
  const isSplitDutyDay =
    otherSameDayCount > 0 || (options?.sameDayBatchPeerCount ?? 0) > 0;

  if (isSplitDutyDay) {
    return {
      ok: true,
      warnings: durationCheck.warnings.length ? durationCheck.warnings : undefined,
    };
  }

  const restShifts = (
    await db.listShiftsForEmployeeRestCheck(
      employeeId,
      starts_at,
      ends_at,
      shiftDate
    )
  ).filter((shift) => !excludeIds.has(shift.id) && !overlappingIds.has(shift.id));

  const restCheck = validateRestPeriodForCountry({
    countryCode,
    newStartsAt: starts_at,
    newEndsAt: ends_at,
    newShiftDate: shiftDate,
    timeZone,
    existingShifts: restShifts,
  });
  if (!restCheck.ok) return restCheck;

  return {
    ok: true,
    warnings: durationCheck.warnings.length ? durationCheck.warnings : undefined,
  };
}

async function validateShiftWeeklyHoursCompliance(
  employeeId: string,
  shiftDate: string,
  startTime: string,
  endTime: string,
  timeZone: string,
  options?: {
    excludeShiftIds?: ReadonlySet<string>;
    additionalWeekWindows?: readonly WeeklyShiftHourWindow[];
    employeeName?: string;
    weeklyHoursTarget?: number | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDatabase();
  const profile =
    options?.weeklyHoursTarget !== undefined
      ? null
      : await db.getProfileById(employeeId);
  const targetHours = resolveProfileWeeklyHoursTarget(
    options?.weeklyHoursTarget ?? profile?.weekly_hours
  );
  const employeeName = options?.employeeName ?? profile?.full_name;

  const weekStart = isoWeekStartFromShiftDate(shiftDate);
  const weekEnd = isoWeekEndFromWeekStart(weekStart);
  const existingShifts = await db.listShiftsForEmployeeInDateRange(
    employeeId,
    weekStart,
    weekEnd
  );

  const { starts_at, ends_at } = buildShiftTimestamps(
    shiftDate,
    startTime,
    endTime,
    timeZone
  );
  const excludeIds = new Set(options?.excludeShiftIds ?? []);
  const sameDay = existingShifts.filter(
    (shift) => shift.shift_date === shiftDate && !excludeIds.has(shift.id)
  );
  for (const overlapping of findOverlappingShifts(sameDay, starts_at, ends_at)) {
    excludeIds.add(overlapping.id);
  }

  const proposedWindows: WeeklyShiftHourWindow[] = [
    { shiftDate, startTime, endTime },
    ...(options?.additionalWeekWindows ?? []),
  ];

  const result = validateEmployeeWeeklyHoursAfterAssign({
    targetHours,
    weekStart,
    existingShifts,
    excludeShiftIds: excludeIds,
    proposedWindows,
    employeeName,
  });

  return result.ok ? { ok: true } : result;
}

async function persistShiftWithTimes(
  organizationId: string,
  userId: string,
  input: AssignShiftWithTimesInput,
  undoBatch: ShiftAssignUndoBatch,
  timeZone: string,
  shiftConfirmationEnabled: boolean
): Promise<void> {
  const db = await getDatabase();

  if (!areAreaCalendarShiftTimesComplete(input.startTime, input.endTime)) {
    throw new Error("Ungültige Schichtzeiten.");
  }

  const { starts_at, ends_at } = buildShiftTimestamps(
    input.shiftDate,
    input.startTime,
    input.endTime,
    timeZone
  );

  const nextSnapshot = buildAssignSnapshotSource(input, starts_at, ends_at);

  const payload = {
    area_shift_template_id: input.areaShiftTemplateId,
    location_id: input.locationId,
    location_area_id: input.locationAreaId,
    starts_at,
    ends_at,
    created_by: userId,
  };

  if (input.existingShiftId) {
    const snapshot = await db.getShiftRecordById(
      input.existingShiftId,
      organizationId
    );
    if (!snapshot) {
      throw new Error("Schicht nicht gefunden.");
    }

    const sameDay = await db.listShiftsForEmployeeDate(
      input.employeeId,
      input.shiftDate
    );
    const otherShifts = sameDay.filter((shift) => shift.id !== input.existingShiftId);
    const overlapping = findOverlappingShifts(otherShifts, starts_at, ends_at);
    if (overlapping.length > 0) {
      throw new Error("Schichtzeiten überschneiden sich mit einer anderen Schicht.");
    }

    undoBatch.replacements.push(toUndoSnapshot(snapshot));
    const confirmationPatch = resolveConfirmationAssignPatch({
      shiftConfirmationEnabled,
      existing: snapshot,
      next: nextSnapshot,
    });
    await db.updateShift(input.existingShiftId, { ...payload, ...confirmationPatch });
    return;
  }

  const existing = await db.listShiftsForEmployeeDate(
    input.employeeId,
    input.shiftDate
  );
  const overlapping = findOverlappingShifts(existing, starts_at, ends_at);

  if (overlapping.length > 0) {
    const primary = overlapping[0];
    const snapshot = await db.getShiftRecordById(primary.id, organizationId);
    if (snapshot) {
      undoBatch.replacements.push(toUndoSnapshot(snapshot));
    }
    const confirmationPatch = resolveConfirmationAssignPatch({
      shiftConfirmationEnabled,
      existing: snapshot,
      next: nextSnapshot,
    });
    await db.updateShift(primary.id, { ...payload, ...confirmationPatch });

    for (let i = 1; i < overlapping.length; i++) {
      const extra = overlapping[i];
      const extraSnapshot = await db.getShiftRecordById(extra.id, organizationId);
      if (extraSnapshot) {
        undoBatch.replacements.push(toUndoSnapshot(extraSnapshot));
      }
      await db.deleteShift(extra.id, organizationId, userId);
      undoBatch.deletedIds.push(extra.id);
    }
    return;
  }

  const confirmationPatch = resolveConfirmationAssignPatch({
    shiftConfirmationEnabled,
    existing: null,
    next: nextSnapshot,
  });

  const { id } = await db.insertShift({
    organization_id: organizationId,
    employee_id: input.employeeId,
    shift_date: input.shiftDate,
    ...payload,
    ...confirmationPatch,
  });
  undoBatch.createdIds.push(id);
}

async function validateAssignContext(
  organizationId: string,
  employeeId: string,
  shiftDate: string,
  locationId: string,
  locationAreaId: string | null,
  requireArea: boolean,
  shiftConfirmationEnabled: boolean,
  relaxAppRegistrationGate = false
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isPastShiftDate(shiftDate)) {
    return { ok: false, error: "Vergangene Tage können nicht mehr geplant werden." };
  }

  const db = await getDatabase();
  const locations = await db.listLocations(organizationId);
  if (!locations.some((l) => l.id === locationId)) {
    return { ok: false, error: "Standort nicht gefunden" };
  }

  if (requireArea) {
    if (!locationAreaId) {
      return { ok: false, error: "Bereich nicht gefunden" };
    }
    const areas = await db.listLocationAreas(locationId);
    if (!areas.some((a) => a.id === locationAreaId)) {
      return { ok: false, error: "Bereich nicht gefunden" };
    }
  }

  const profile = await db.getProfileById(employeeId);
  const gate = validateProfileForShiftConfirmationAssign(
    profile,
    organizationId,
    shiftConfirmationEnabled,
    { relaxAppRegistrationGate }
  );
  if (!gate.ok) return gate;

  return { ok: true };
}

function revalidateShiftPaths(scope?: {
  organizationId: string;
  locationId: string;
  shiftDates: string[];
}) {
  revalidatePath("/dashboard");
  revalidatePath("/bereich-kalender");

  if (!scope?.locationId) return;

  const tags = new Set<string>();
  for (const shiftDate of scope.shiftDates) {
    for (const weekStart of weekStartsForShiftCacheInvalidation(shiftDate)) {
      tags.add(
        areaCalendarShiftsCacheTag(
          scope.organizationId,
          scope.locationId,
          weekStart
        )
      );
    }
  }
  for (const tag of tags) {
    revalidateTag(tag);
  }
}

function revalidateShiftPathsFromUndoBatch(
  organizationId: string,
  batch: ShiftAssignUndoBatch
) {
  const shiftDates = new Set<string>();
  let locationId: string | undefined;

  for (const snapshot of batch.replacements) {
    shiftDates.add(snapshot.shift_date);
    if (snapshot.location_id) locationId = snapshot.location_id;
  }

  if (!locationId || shiftDates.size === 0) {
    revalidateShiftPaths();
    return;
  }

  revalidateShiftPaths({
    organizationId,
    locationId,
    shiftDates: [...shiftDates],
  });
}

export async function assignShiftWithTimes(
  input: AssignShiftWithTimesInput
): Promise<ShiftActionResult> {
  try {
    const { organizationId, userId, orgFeatures, organization, profile } =
      await requireManager();
    const assignMode = resolveSimulatedProposedAssignOptions({
      organizationEnabled: organization.shift_confirmation_enabled,
      simulatedProposedOnAssign: input.simulatedProposedOnAssign,
      relaxAppRegistrationGate: input.relaxAppRegistrationGate,
      managerEmail: profile.email,
    });
    const context = await validateAssignContext(
      organizationId,
      input.employeeId,
      input.shiftDate,
      input.locationId,
      input.locationAreaId,
      orgFeatures.areas,
      assignMode.shiftConfirmationEnabled,
      assignMode.relaxAppRegistrationGate
    );
    if (!context.ok) return context;

    const db = await getDatabase();
    const assignCtx = await loadShiftAssignValidationContext(
      db,
      organizationId,
      organization.planning_mode,
      input.locationId,
      input.locationAreaId
    );
    const eligibilityCheck = validateShiftAssignEligibility(
      organization.planning_mode,
      assignCtx,
      {
        employeeId: input.employeeId,
        shiftDate: input.shiftDate,
        startTime: input.startTime,
        endTime: input.endTime,
        locationAreaId: input.locationAreaId,
        withoutServiceHours: input.withoutServiceHours,
      }
    );
    if (!eligibilityCheck.ok) return eligibilityCheck;
    const assignWarnings = eligibilityCheck.warnings;

    const timeZone = resolveOrganizationTimeZone(organization);

    const laborCheck = await validateShiftLaborCompliance(
      organizationId,
      input.employeeId,
      input.shiftDate,
      input.startTime,
      input.endTime,
      timeZone,
      input.existingShiftId
        ? { excludeShiftIds: new Set([input.existingShiftId]) }
        : undefined
    );
    if (!laborCheck.ok) return laborCheck;

    const weeklyCheck = await validateShiftWeeklyHoursCompliance(
      input.employeeId,
      input.shiftDate,
      input.startTime,
      input.endTime,
      timeZone,
      input.existingShiftId
        ? { excludeShiftIds: new Set([input.existingShiftId]) }
        : undefined
    );
    if (!weeklyCheck.ok) return weeklyCheck;

    const undoBatch: ShiftAssignUndoBatch = {
      createdIds: [],
      deletedIds: [],
      replacements: [],
    };

    await persistShiftWithTimes(
      organizationId,
      userId,
      input,
      undoBatch,
      timeZone,
      assignMode.shiftConfirmationEnabled
    );

    const revalidatedDates = new Set<string>([input.shiftDate]);

    if (
      input.assignToRemainingWeekDays &&
      input.weekDates?.length &&
      !input.existingShiftId
    ) {
      const extraDates = await assignShiftToRemainingWeekDaysSilently(
        organizationId,
        userId,
        organization.planning_mode,
        assignCtx,
        input,
        input.weekDates,
        undoBatch,
        timeZone,
        assignMode.shiftConfirmationEnabled
      );
      for (const date of extraDates) {
        revalidatedDates.add(date);
      }
    }

    setShiftAssignUndoBatch(userId, undoBatch);
    revalidateShiftPaths({
      organizationId,
      locationId: input.locationId,
      shiftDates: [...revalidatedDates],
    });

    return {
      ok: true,
      warnings: mergeShiftAssignWarnings(assignWarnings, laborCheck.warnings),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}

export async function assignShiftBatch(input: {
  shiftDate: string;
  locationId: string;
  locationAreaId: string;
  rows: AssignShiftBatchRowInput[];
  deleteShiftIds?: string[];
  withoutServiceHours?: boolean;
  simulatedProposedOnAssign?: boolean;
  relaxAppRegistrationGate?: boolean;
  assignToRemainingWeekDays?: boolean;
  weekDates?: readonly string[];
}): Promise<AssignShiftBatchResult> {
  try {
    const { organizationId, userId, organization, profile } = await requireManager();
    const assignMode = resolveSimulatedProposedAssignOptions({
      organizationEnabled: organization.shift_confirmation_enabled,
      simulatedProposedOnAssign: input.simulatedProposedOnAssign,
      relaxAppRegistrationGate: input.relaxAppRegistrationGate,
      managerEmail: profile.email,
    });
    const timeZone = resolveOrganizationTimeZone(organization);
    const db = await getDatabase();

    if (isPastShiftDate(input.shiftDate)) {
      return { ok: false, error: "Vergangene Tage können nicht mehr geplant werden." };
    }

    const locations = await db.listLocations(organizationId);
    if (!locations.some((l) => l.id === input.locationId)) {
      return { ok: false, error: "Standort nicht gefunden" };
    }

    const areas = await db.listLocationAreas(input.locationId);
    if (!areas.some((a) => a.id === input.locationAreaId)) {
      return { ok: false, error: "Bereich nicht gefunden" };
    }

    const deleteShiftIds = [...new Set(input.deleteShiftIds ?? [])];
    const excludeShiftIds = new Set(deleteShiftIds);
    for (const shiftId of deleteShiftIds) {
      const shift = await db.getShiftRecordById(shiftId, organizationId);
      if (!shift) {
        return { ok: false, error: "Schicht nicht gefunden" };
      }
      if (shift.location_area_id !== input.locationAreaId) {
        return { ok: false, error: "Schicht gehört nicht zu diesem Bereich" };
      }
      if (shift.shift_date !== input.shiftDate) {
        return { ok: false, error: "Schicht gehört nicht zu diesem Tag" };
      }
      if (isPastShiftDate(shift.shift_date)) {
        return {
          ok: false,
          error: "Vergangene Schichten können nicht mehr entfernt werden.",
        };
      }
    }

    const assignCtx = await loadShiftAssignValidationContext(
      db,
      organizationId,
      organization.planning_mode,
      input.locationId,
      input.locationAreaId
    );

    type ValidRow = AssignShiftBatchRowInput & {
      rowIndex: number;
      starts_at: string;
      ends_at: string;
      warnings?: string[];
    };

    const validRows: ValidRow[] = [];
    const results: AssignShiftBatchRowResult[] = [];
    const pendingBatchWindowsByEmployee = new Map<string, WeeklyShiftHourWindow[]>();
    const weeklyHoursTargetByEmployee = new Map<string, number | null>();
    const employeeNameById = new Map<string, string>();

    const completeBatchRows = input.rows
      .map((row, rowIndex) => ({ row, rowIndex }))
      .filter(
        ({ row }) =>
          row.employeeId &&
          areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)
      );
    const batchPeerCountByEmployee = new Map<string, number>();
    for (const { row } of completeBatchRows) {
      batchPeerCountByEmployee.set(
        row.employeeId,
        (batchPeerCountByEmployee.get(row.employeeId) ?? 0) + 1
      );
    }

    for (let rowIndex = 0; rowIndex < input.rows.length; rowIndex++) {
      const row = input.rows[rowIndex];
      if (
        !row.employeeId ||
        !areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)
      ) {
        continue;
      }

      const context = await validateAssignContext(
        organizationId,
        row.employeeId,
        input.shiftDate,
        input.locationId,
        input.locationAreaId,
        true,
        assignMode.shiftConfirmationEnabled,
        assignMode.relaxAppRegistrationGate
      );
      if (!context.ok) {
        results.push({ rowIndex, ok: false, error: context.error });
        continue;
      }

      const eligibilityCheck = validateShiftAssignEligibility(
        "advanced",
        assignCtx,
        {
          employeeId: row.employeeId,
          shiftDate: input.shiftDate,
          startTime: row.startTime,
          endTime: row.endTime,
          locationAreaId: input.locationAreaId,
          withoutServiceHours: input.withoutServiceHours,
        }
      );
      if (!eligibilityCheck.ok) {
        results.push({ rowIndex, ok: false, error: eligibilityCheck.error });
        continue;
      }

      const rowExcludeShiftIds = new Set(excludeShiftIds);
      if (row.existingShiftId) {
        rowExcludeShiftIds.add(row.existingShiftId);
      }

      const laborCheck = await validateShiftLaborCompliance(
        organizationId,
        row.employeeId,
        input.shiftDate,
        row.startTime,
        row.endTime,
        timeZone,
        {
          sameDayBatchPeerCount:
            (batchPeerCountByEmployee.get(row.employeeId) ?? 1) - 1,
          excludeShiftIds: rowExcludeShiftIds,
        }
      );
      if (!laborCheck.ok) {
        results.push({ rowIndex, ok: false, error: laborCheck.error });
        continue;
      }

      if (!weeklyHoursTargetByEmployee.has(row.employeeId)) {
        const profile = await db.getProfileById(row.employeeId);
        weeklyHoursTargetByEmployee.set(
          row.employeeId,
          profile?.weekly_hours ?? null
        );
        if (profile?.full_name) {
          employeeNameById.set(row.employeeId, profile.full_name);
        }
      }

      const weeklyCheck = await validateShiftWeeklyHoursCompliance(
        row.employeeId,
        input.shiftDate,
        row.startTime,
        row.endTime,
        timeZone,
        {
          excludeShiftIds: rowExcludeShiftIds,
          additionalWeekWindows: pendingBatchWindowsByEmployee.get(row.employeeId) ?? [],
          weeklyHoursTarget: weeklyHoursTargetByEmployee.get(row.employeeId) ?? null,
          employeeName: employeeNameById.get(row.employeeId),
        }
      );
      if (!weeklyCheck.ok) {
        results.push({ rowIndex, ok: false, error: weeklyCheck.error });
        continue;
      }

      const { starts_at, ends_at } = buildShiftTimestamps(
        input.shiftDate,
        row.startTime,
        row.endTime,
        timeZone
      );

      validRows.push({
        ...row,
        rowIndex,
        starts_at,
        ends_at,
        warnings: mergeShiftAssignWarnings(
          eligibilityCheck.warnings,
          laborCheck.warnings
        ),
      });

      const pendingWindows = pendingBatchWindowsByEmployee.get(row.employeeId) ?? [];
      pendingWindows.push({
        shiftDate: input.shiftDate,
        startTime: row.startTime,
        endTime: row.endTime,
      });
      pendingBatchWindowsByEmployee.set(row.employeeId, pendingWindows);
    }

    for (let i = 0; i < validRows.length; i++) {
      for (let j = 0; j < i; j++) {
        if (validRows[i].employeeId !== validRows[j].employeeId) continue;
        if (
          shiftsOverlapIso(
            validRows[i].starts_at,
            validRows[i].ends_at,
            validRows[j].starts_at,
            validRows[j].ends_at
          )
        ) {
          results.push({
            rowIndex: validRows[i].rowIndex,
            ok: false,
            error: "Überschneidung mit anderer Zeile im Batch.",
          });
          validRows.splice(i, 1);
          i -= 1;
          break;
        }
      }
    }

    const countryCode =
      (await db.getOrganizationCountryCode(organizationId)) ?? DEFAULT_COUNTRY_CODE;
    const weekday = weekdayIndexFromDate(input.shiftDate);
    const rowsByEmployee = new Map<string, ValidRow[]>();
    for (const row of validRows) {
      const group = rowsByEmployee.get(row.employeeId) ?? [];
      group.push(row);
      rowsByEmployee.set(row.employeeId, group);
    }

    for (const [employeeId, employeeRows] of rowsByEmployee) {
      const modalWindows = employeeRows.map((row) => ({
        startTime: row.startTime,
        endTime: row.endTime,
      }));
      if (modalWindows.length < 2) continue;

      const existingDayShifts = await db.listShiftsForEmployeeDate(
        employeeId,
        input.shiftDate
      );
      const externalWindows = existingDayShifts
        .filter((shift) => shift.location_area_id !== input.locationAreaId)
        .map((shift) => ({
          startTime: shiftTimeFromTimestamp(shift.starts_at, timeZone),
          endTime: shiftTimeFromTimestamp(shift.ends_at, timeZone),
        }));

      const dayCheck = validateEmployeeDayShiftAssignments({
        countryCode,
        shiftDate: input.shiftDate,
        weekday,
        windows: [...modalWindows, ...externalWindows],
      });

      if (!dayCheck.ok) {
        for (const row of employeeRows) {
          results.push({
            rowIndex: row.rowIndex,
            ok: false,
            error: dayCheck.error,
          });
        }
        const blocked = new Set(employeeRows.map((row) => row.rowIndex));
        for (let i = validRows.length - 1; i >= 0; i--) {
          if (blocked.has(validRows[i]!.rowIndex)) {
            validRows.splice(i, 1);
          }
        }
      }
    }

    const undoBatch: ShiftAssignUndoBatch = {
      createdIds: [],
      deletedIds: [],
      replacements: [],
    };

    let anySuccess = false;
    const revalidatedDates = new Set<string>([input.shiftDate]);

    for (const shiftId of deleteShiftIds) {
      const snapshot = await db.getShiftRecordById(shiftId, organizationId);
      if (!snapshot) continue;
      const blockReason = resolveShiftDeletionBlockReason(snapshot);
      if (blockReason) {
        results.push({
          rowIndex: -1,
          ok: false,
          error: blockReason,
        });
        continue;
      }
      undoBatch.replacements.push(toUndoSnapshot(snapshot));
      await db.deleteShift(shiftId, organizationId, userId);
      undoBatch.deletedIds.push(shiftId);
      anySuccess = true;
    }

    for (const row of validRows) {
      if (results.some((r) => !r.ok && r.rowIndex === row.rowIndex)) continue;

      try {
        await persistShiftWithTimes(
          organizationId,
          userId,
          {
            employeeId: row.employeeId,
            shiftDate: input.shiftDate,
            startTime: row.startTime,
            endTime: row.endTime,
            areaShiftTemplateId: row.areaShiftTemplateId,
            locationId: input.locationId,
            locationAreaId: input.locationAreaId,
            withoutServiceHours: input.withoutServiceHours,
            existingShiftId: row.existingShiftId,
          },
          undoBatch,
          timeZone,
          assignMode.shiftConfirmationEnabled
        );
        results.push({ rowIndex: row.rowIndex, ok: true, warnings: row.warnings });
        anySuccess = true;

        if (input.assignToRemainingWeekDays && input.weekDates?.length) {
          const restWeekInput: AssignShiftWithTimesInput = {
            employeeId: row.employeeId,
            shiftDate: input.shiftDate,
            startTime: row.startTime,
            endTime: row.endTime,
            areaShiftTemplateId: row.areaShiftTemplateId,
            locationId: input.locationId,
            locationAreaId: input.locationAreaId,
            withoutServiceHours: input.withoutServiceHours,
          };
          const extraDates = await assignShiftToRemainingWeekDaysSilently(
            organizationId,
            userId,
            organization.planning_mode,
            assignCtx,
            restWeekInput,
            input.weekDates,
            undoBatch,
            timeZone,
            assignMode.shiftConfirmationEnabled
          );
          for (const date of extraDates) {
            revalidatedDates.add(date);
          }
        }
      } catch (e) {
        results.push({
          rowIndex: row.rowIndex,
          ok: false,
          error: e instanceof Error ? e.message : "Speichern fehlgeschlagen",
        });
      }
    }

    if (anySuccess) {
      setShiftAssignUndoBatch(userId, undoBatch);
      revalidateShiftPaths({
        organizationId,
        locationId: input.locationId,
        shiftDates: [...revalidatedDates],
      });
    }

    return {
      ok: true,
      results,
      undoAvailable: anySuccess,
      savedRowCount: results.filter((entry) => entry.ok).length,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}

export async function undoLastShiftAssignBatch(): Promise<ShiftActionResult> {
  try {
    const { organizationId, userId } = await requireManager();
    const batch = takeShiftAssignUndoBatch(userId);
    if (!batch) {
      return { ok: false, error: "Kein Rückgängig-Schritt verfügbar." };
    }

    const db = await getDatabase();

    for (const snapshot of batch.replacements) {
      await db.updateShift(snapshot.id, {
        area_shift_template_id: snapshot.area_shift_template_id,
        location_id: snapshot.location_id ?? "",
        location_area_id: snapshot.location_area_id,
        starts_at: snapshot.starts_at,
        ends_at: snapshot.ends_at,
        created_by: snapshot.created_by ?? userId,
      });
    }

    for (const id of batch.createdIds) {
      await db.deleteShift(id, organizationId, userId);
    }

    for (const id of batch.deletedIds) {
      const snapshot = batch.replacements.find((row) => row.id === id);
      if (!snapshot || !snapshot.location_id) continue;
      await db.insertShift({
        organization_id: organizationId,
        employee_id: snapshot.employee_id,
        area_shift_template_id: snapshot.area_shift_template_id,
        location_id: snapshot.location_id,
        location_area_id: snapshot.location_area_id,
        shift_date: snapshot.shift_date,
        starts_at: snapshot.starts_at,
        ends_at: snapshot.ends_at,
        created_by: snapshot.created_by ?? userId,
      });
    }

    revalidateShiftPathsFromUndoBatch(organizationId, batch);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Rückgängig fehlgeschlagen",
    };
  }
}

function resolveShiftDeletionBlockReason(shift: {
  shift_date: string;
  confirmation_status?: import("@schichtwerk/types").ShiftConfirmationStatus;
  requested_at?: string | null;
}): string | null {
  if (
    canDeleteShift({
      shiftDate: shift.shift_date,
      confirmationStatus: shift.confirmation_status,
      requestedAt: shift.requested_at ?? null,
      isPastShiftDate,
    })
  ) {
    return null;
  }

  if (isPastShiftDate(shift.shift_date)) {
    return "Vergangene Schichten können nicht mehr entfernt werden.";
  }

  const status = resolveEffectiveConfirmationStatus(
    shift.confirmation_status,
    shift.requested_at ?? null
  );
  return shiftDeleteBlockedActionError(status ?? "confirmed");
}

export async function removeShift(shiftId: string): Promise<ShiftActionResult> {
  try {
    const { organizationId, userId } = await requireManager();
    const db = await getDatabase();

    const shift = await db.getShiftRecordById(shiftId, organizationId);
    if (!shift) {
      return { ok: false, error: "Schicht nicht gefunden" };
    }
    const blockReason = resolveShiftDeletionBlockReason(shift);
    if (blockReason) {
      return { ok: false, error: blockReason };
    }

    await db.deleteShift(shiftId, organizationId, userId);

    if (shift.location_id) {
      revalidateShiftPaths({
        organizationId,
        locationId: shift.location_id,
        shiftDates: [shift.shift_date],
      });
    } else {
      revalidateShiftPaths();
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}

export async function removeShiftsAsManager(shiftIds: string[]): Promise<
  | {
      ok: true;
      deletedCount: number;
      failedCount: number;
      errors: string[];
    }
  | { ok: false; error: string }
> {
  try {
    const uniqueShiftIds = [...new Set(shiftIds.filter(Boolean))];
    if (!uniqueShiftIds.length) {
      return { ok: false, error: "Keine Schichten ausgewählt." };
    }

    const { organizationId, userId } = await requireManager();
    const db = await getDatabase();
    let deletedCount = 0;
    const errors: string[] = [];
    const revalidateByLocation = new Map<string | null, Set<string>>();

    for (const shiftId of uniqueShiftIds) {
      const shift = await db.getShiftRecordById(shiftId, organizationId);
      if (!shift) {
        errors.push("Schicht nicht gefunden");
        continue;
      }
      const blockReason = resolveShiftDeletionBlockReason(shift);
      if (blockReason) {
        errors.push(blockReason);
        continue;
      }

      await db.deleteShift(shiftId, organizationId, userId);
      deletedCount += 1;
      const dates = revalidateByLocation.get(shift.location_id) ?? new Set<string>();
      dates.add(shift.shift_date);
      revalidateByLocation.set(shift.location_id, dates);
    }

    for (const [locationId, shiftDates] of revalidateByLocation) {
      if (locationId) {
        revalidateShiftPaths({
          organizationId,
          locationId,
          shiftDates: [...shiftDates],
        });
      } else {
        revalidateShiftPaths();
      }
    }

    if (deletedCount === 0) {
      return { ok: false, error: errors[0] ?? "Löschen fehlgeschlagen." };
    }

    return {
      ok: true,
      deletedCount,
      failedCount: errors.length,
      errors,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Löschen fehlgeschlagen.",
    };
  }
}
