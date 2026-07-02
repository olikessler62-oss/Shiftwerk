import type { ProfileShiftPreferenceEntry } from "@/app/actions/areacalendar-shift-assign";
import type { AreaCalendarShiftAssignEmployee } from "@/app/actions/areacalendar-shift-assign";
import {
  areAreaCalendarShiftTimesComplete,
  excludeEmployeeFromReassignSuggestions,
  filterBulkShiftAssignEmployeesForRow,
  profileAvailabilityWeekdayFromAreaCalendarDate,
  resolveEmployeeIdForReassignShift,
  type BulkShiftEmployeeAssignmentContext,
} from "@/lib/available-employees-for-shift";
import {
  computeBulkStaffingHeaderEntries,
  computeBulkStaffingHeaderEntriesForShiftPriorityDay,
  staffingAssignmentsForAreaDay,
} from "@/lib/bulk-staffing-header";
import { resolveRemainingQualificationNeed, resolveRemainingStaffingNeed } from "@/lib/bulk-shift-staffing";
import {
  filterEmployeesByQualification,
  presetQualificationForServiceHour,
} from "@/lib/bulk-shift-qualification";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import {
  employeeWishScore,
  type ProfileShiftPreferenceMatchEntry,
  type ShiftWishMatchContext,
} from "@/lib/profile-shift-preference-matching";
import type { PlanningShift } from "@/lib/planning-shift-card";
import { weeklyAssignedMinutesByEmployeeId } from "@/lib/planning-utils";
import { staffingRulesWithOverridesForAreaDate } from "@/lib/staffing-rules-with-overrides";
import {
  filterEmployeesWithinWeeklyHoursForShift,
  type ShiftAssignWeekShiftRef,
} from "@/lib/shift-weekly-hours-validation-client";
import { resolveProfileWeeklyHoursTarget, timeToMinutes } from "@schichtwerk/database";
import type {
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  Qualification,
} from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";

export type DashboardStaffingCandidateSlot = {
  qualificationId: string | null;
  qualificationName: string;
  missingCount: number;
};

export type DashboardStaffingCandidateRow = {
  id: string;
  full_name: string;
};

export type ComputeDashboardStaffingCandidateSlotsInput = {
  areaId: string;
  dateISO: string;
  serviceHourId: string;
  simplePlanning: boolean;
  shifts: readonly PlanningShift[];
  staffingRules: readonly LocationAreaStaffing[];
  staffingOverrides: readonly LocationAreaStaffingOverride[];
  serviceHours: readonly AreaServiceHourRef[];
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  qualifications: readonly Qualification[];
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
  employeeNameById?: ReadonlyMap<string, string>;
  formatTimeLabel: (
    weekdayLabel: string,
    startTime: string,
    endTime: string
  ) => string;
  weekdayLabel: (weekdayIndex: number) => string;
  formatCalendarTimeLabel: (startTime: string, endTime: string) => string;
  headcountSectionLabel: string;
};

export type FilterDashboardStaffingCandidatesInput = {
  slot: DashboardStaffingCandidateSlot;
  row: {
    dateISO: string;
    timeFrom: string;
    timeTo: string;
  };
  areaId: string;
  locationId: string;
  simplePlanning: boolean;
  employees: readonly AreaCalendarShiftAssignEmployee[];
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
  profileShiftPreferences: Readonly<Record<string, ProfileShiftPreferenceEntry[]>>;
  areaShifts: readonly PlanningShift[];
  locationShifts: readonly PlanningShift[];
  weekDates: readonly string[];
  timeZone: string;
  countryCode: string;
  /** Bestehende Schicht ersetzen — MA dieser Schicht von Vorschlägen ausschließen. */
  reassignShiftId?: string | null;
};

function shiftDurationMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime.slice(0, 5));
  let end = timeToMinutes(endTime.slice(0, 5));
  if (end <= start) end += 24 * 60;
  return end - start;
}

export { weeklyAssignedMinutesByEmployeeId } from "@/lib/planning-utils";

export function filterEmployeesWithinWeeklyMinutesForShift<
  T extends { id: string; weekly_hours?: number | null },
>(
  employees: readonly T[],
  locationShifts: readonly PlanningShift[],
  weekDates: readonly string[],
  proposedStart: string,
  proposedEnd: string
): T[] {
  const assignedByEmployee = weeklyAssignedMinutesByEmployeeId(
    locationShifts,
    weekDates
  );
  const proposedMinutes = shiftDurationMinutes(proposedStart, proposedEnd);

  return employees.filter((employee) => {
    const assignedMinutes = assignedByEmployee.get(employee.id) ?? 0;
    const targetMinutes =
      resolveProfileWeeklyHoursTarget(employee.weekly_hours ?? null) * 60;
    return assignedMinutes + proposedMinutes <= targetMinutes;
  });
}

function qualificationNameById(
  qualificationId: string | null,
  qualifications: readonly Qualification[],
  fallback: string
): string {
  if (!qualificationId) return fallback;
  return qualifications.find((item) => item.id === qualificationId)?.name ?? fallback;
}

function aggregateMissingQualSlots(
  slots: DashboardStaffingCandidateSlot[]
): DashboardStaffingCandidateSlot[] {
  const byQualId = new Map<string, DashboardStaffingCandidateSlot>();

  for (const slot of slots) {
    const key = slot.qualificationId ?? "__headcount__";
    const existing = byQualId.get(key);
    if (!existing) {
      byQualId.set(key, { ...slot });
      continue;
    }
    existing.missingCount += slot.missingCount;
  }

  return [...byQualId.values()];
}

function findStaffingEntryForRow(
  input: ComputeDashboardStaffingCandidateSlotsInput
): TagAreaHeaderStaffingEntry | null {
  const areaShifts = input.shifts.filter(
    (shift) => shift.location_area_id === input.areaId
  );
  const rulesForDay = staffingRulesWithOverridesForAreaDate(
    input.staffingRules,
    input.staffingOverrides,
    input.areaId,
    input.dateISO
  );
  const entries = computeBulkStaffingHeaderEntries({
    staffingRules: rulesForDay,
    areaId: input.areaId,
    dateISO: input.dateISO,
    serviceHours: input.serviceHours,
    assignments: staffingAssignmentsForAreaDay(areaShifts, input.dateISO, input.areaId),
    assignmentPresets: input.assignmentPresets,
    qualifications: input.qualifications,
    profileQualificationIds: input.profileQualificationIds,
    employeeNameById: input.employeeNameById,
    formatTimeLabel: input.formatTimeLabel,
    weekdayLabel: input.weekdayLabel,
    formatCalendarTimeLabel: input.formatCalendarTimeLabel,
  });

  const matched =
    entries.find((entry) => entry.serviceHourId === input.serviceHourId) ?? null;
  if (matched) return matched;

  const shiftPriorityEntries = computeBulkStaffingHeaderEntriesForShiftPriorityDay({
    staffingRules: rulesForDay,
    areaId: input.areaId,
    dateISO: input.dateISO,
    serviceHours: input.serviceHours,
    assignments: staffingAssignmentsForAreaDay(areaShifts, input.dateISO, input.areaId),
    assignmentPresets: input.assignmentPresets,
    qualifications: input.qualifications,
    profileQualificationIds: input.profileQualificationIds,
    employeeNameById: input.employeeNameById,
    formatTimeLabel: input.formatTimeLabel,
    weekdayLabel: input.weekdayLabel,
    formatCalendarTimeLabel: input.formatCalendarTimeLabel,
  });

  return (
    shiftPriorityEntries.find(
      (entry) => entry.serviceHourId === input.serviceHourId
    ) ?? null
  );
}

export function computeDashboardStaffingCandidateSlots(
  input: ComputeDashboardStaffingCandidateSlotsInput
): DashboardStaffingCandidateSlot[] {
  const entry = findStaffingEntryForRow(input);
  if (!entry) return [];

  const qualifications =
    entry.qualifications?.filter((qualification) => qualification.required > 0) ?? [];

  if (qualifications.length > 0) {
    const slots: DashboardStaffingCandidateSlot[] = [];
    for (const qualification of qualifications) {
      const missingCount = resolveRemainingQualificationNeed(
        entry,
        qualification.qualificationId,
        []
      );
      if (missingCount <= 0) continue;
      slots.push({
        qualificationId: qualification.qualificationId,
        qualificationName: qualificationNameById(
          qualification.qualificationId,
          input.qualifications,
          qualification.qualificationId
        ),
        missingCount,
      });
    }
    return aggregateMissingQualSlots(slots);
  }

  const missingCount = resolveRemainingStaffingNeed(entry, []);
  if (missingCount <= 0) return [];

  const presetQualId = input.simplePlanning
    ? null
    : presetQualificationForServiceHour(
        input.staffingRules,
        input.areaId,
        input.serviceHourId
      );

  if (input.simplePlanning || !presetQualId) {
    return [
      {
        qualificationId: null,
        qualificationName: input.headcountSectionLabel,
        missingCount,
      },
    ];
  }

  return [
    {
      qualificationId: presetQualId,
      qualificationName: qualificationNameById(
        presetQualId,
        input.qualifications,
        presetQualId
      ),
      missingCount,
    },
  ];
}

function buildBulkAssignContext(input: {
  dateISO: string;
  areaId: string;
  locationShifts: readonly PlanningShift[];
  countryCode: string;
  timeZone: string;
  excludeShiftId?: string | null;
}): BulkShiftEmployeeAssignmentContext {
  const locationShifts = input.excludeShiftId
    ? input.locationShifts.filter((shift) => shift.id !== input.excludeShiftId)
    : input.locationShifts;
  const areaAssignments = locationShifts
    .filter(
      (shift) =>
        shift.shift_date === input.dateISO &&
        shift.location_area_id === input.areaId
    )
    .map((shift) => ({
      employeeId: shift.employee_id,
      startTime: shift.startTime,
      endTime: shift.endTime,
    }));

  const otherAreaAssignments = locationShifts
    .filter(
      (shift) =>
        shift.shift_date === input.dateISO &&
        shift.location_area_id &&
        shift.location_area_id !== input.areaId
    )
    .map((shift) => ({
      employeeId: shift.employee_id,
      startTime: shift.startTime,
      endTime: shift.endTime,
    }));

  return {
    shiftDate: input.dateISO,
    countryCode: input.countryCode,
    timeZone: input.timeZone,
    areaAssignments,
    otherAreaAssignments,
  };
}

function planningShiftsToWeekRefs(
  shifts: readonly PlanningShift[]
): ShiftAssignWeekShiftRef[] {
  return shifts.map((shift) => ({
    id: shift.id,
    employee_id: shift.employee_id,
    shift_date: shift.shift_date,
    startTime: shift.startTime,
    endTime: shift.endTime,
  }));
}

export function filterDashboardStaffingCandidates(
  input: FilterDashboardStaffingCandidatesInput
): DashboardStaffingCandidateRow[] {
  const { row, slot } = input;
  if (!areAreaCalendarShiftTimesComplete(row.timeFrom, row.timeTo)) {
    return [];
  }

  const weekday = profileAvailabilityWeekdayFromAreaCalendarDate(row.dateISO);
  const reassignExcludedEmployeeId = resolveEmployeeIdForReassignShift(
    input.reassignShiftId,
    input.locationShifts
  );
  const assignContext = buildBulkAssignContext({
    dateISO: row.dateISO,
    areaId: input.areaId,
    locationShifts: input.locationShifts,
    countryCode: input.countryCode,
    timeZone: input.timeZone,
    excludeShiftId: input.reassignShiftId,
  });

  let   eligible = filterBulkShiftAssignEmployeesForRow(
    input.employees,
    weekday,
    row.timeFrom,
    row.timeTo,
    assignContext
  );

  if (!input.simplePlanning && slot.qualificationId) {
    eligible = filterEmployeesByQualification(
      eligible,
      slot.qualificationId,
      input.profileQualificationIds
    );
  }

  const weekShiftRefs = planningShiftsToWeekRefs(input.locationShifts);
  eligible = filterEmployeesWithinWeeklyHoursForShift(eligible, {
    weekShifts: weekShiftRefs,
    shiftDate: row.dateISO,
    startTime: row.timeFrom,
    endTime: row.timeTo,
    timeZone: input.timeZone,
  });

  eligible = filterEmployeesWithinWeeklyMinutesForShift(
    eligible,
    input.locationShifts,
    input.weekDates,
    row.timeFrom,
    row.timeTo
  );

  return excludeEmployeeFromReassignSuggestions(
    eligible.map((employee) => ({
      id: employee.id,
      full_name: employee.full_name,
    })),
    reassignExcludedEmployeeId
  );
}

export function sortDashboardStaffingCandidates(
  candidates: readonly DashboardStaffingCandidateRow[],
  context: ShiftWishMatchContext,
  preferences: Readonly<Record<string, ProfileShiftPreferenceMatchEntry[]>>,
  weeklyAssignedMinutes: ReadonlyMap<string, number>
): DashboardStaffingCandidateRow[] {
  return [...candidates].sort((a, b) => {
    const wishDiff =
      employeeWishScore(b.id, context, preferences) -
      employeeWishScore(a.id, context, preferences);
    if (wishDiff !== 0) return wishDiff;

    const hoursDiff =
      (weeklyAssignedMinutes.get(a.id) ?? 0) -
      (weeklyAssignedMinutes.get(b.id) ?? 0);
    if (hoursDiff !== 0) return hoursDiff;

    return a.full_name.localeCompare(b.full_name, "de");
  });
}

export function resolveDashboardStaffingWishContext(input: {
  weekday: number;
  timeFrom: string;
  timeTo: string;
  areaId: string;
  locationId: string;
  qualificationId: string | null;
}): ShiftWishMatchContext {
  return {
    weekday: input.weekday,
    demandStart: input.timeFrom,
    demandEnd: input.timeTo,
    areaId: input.areaId,
    locationId: input.locationId,
    qualificationId: input.qualificationId,
  };
}
