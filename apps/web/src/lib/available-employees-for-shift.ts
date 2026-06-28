import {
  absenceRequestToRange,
  isDateWithinAbsenceRange,
  parseAvailabilityTimeRange,
  profileEligibleForShiftConfirmationAssignment,
  timeToMinutes,
  shiftWindowFitsAvailabilitySlot as shiftWindowFitsAvailabilitySlotFromDb,
  validateEmployeeDayShiftAssignments,
  type AbsenceRange,
} from "@schichtwerk/database";
import type { AbsenceRequest, Profile, ProfileRecurringAvailability } from "@schichtwerk/types";
import {
  serviceWeekdayForDate,
  weekdayIndexFromDate,
} from "@/lib/location-staffing-client";
import { areaCalendarShiftWindowsOverlap } from "@/lib/shift-overlap";

const MINUTES_PER_DAY = 24 * 60;

type TimeSegment = { start: number; end: number };

function availabilitySegments(start_time: string, end_time: string): TimeSegment[] {
  const startM = timeToMinutes(start_time);
  const endM = timeToMinutes(end_time);
  if (endM > startM) {
    return [{ start: startM, end: endM }];
  }
  if (endM < startM) {
    return [
      { start: startM, end: MINUTES_PER_DAY },
      { start: 0, end: endM },
    ];
  }
  return [];
}

/** Innerer Zeitraum liegt vollständig im äußeren Zeitraum. */
export function availabilityRangeContainedInWindow(
  innerStart: string,
  innerEnd: string,
  outerStart: string,
  outerEnd: string
): boolean {
  const outer = availabilitySegments(outerStart, outerEnd);
  const inner = availabilitySegments(innerStart, innerEnd);
  if (!inner.length || !outer.length) return false;

  for (const segInner of inner) {
    let contained = false;
    for (const segOuter of outer) {
      if (segInner.start >= segOuter.start && segInner.end <= segOuter.end) {
        contained = true;
        break;
      }
    }
    if (!contained) return false;
  }
  return true;
}

/** Schicht-Zeitfenster liegt vollständig in einer Verfügbarkeit des Mitarbeiters. */
export function shiftWindowFitsAvailabilitySlot(
  shiftStart: string,
  shiftEnd: string,
  slotStart: string,
  slotEnd: string
): boolean {
  return shiftWindowFitsAvailabilitySlotFromDb(
    areaCalendarTimeKey(shiftStart),
    areaCalendarTimeKey(shiftEnd),
    slotStart,
    slotEnd
  );
}

export function areAreaCalendarShiftTimesComplete(
  startTime: string,
  endTime: string
): boolean {
  return parseAvailabilityTimeRange({
    start_time: areaCalendarTimeKey(startTime),
    end_time: areaCalendarTimeKey(endTime),
  }).ok;
}

export function areaCalendarTimeKey(raw: string): string {
  const trimmed = raw.trim();
  const parts = trimmed.split(":");
  const hRaw = parts[0] ?? "00";
  const mRaw = (parts[1] ?? "00").slice(0, 2);
  return `${hRaw.padStart(2, "0")}:${mRaw.padStart(2, "0")}`;
}

export function normalizeAreaCalendarShiftTime(raw: string): string {
  return areaCalendarTimeKey(raw);
}

function normalizeProfileAvailabilityWeekday(weekday: number | string): number {
  const value = typeof weekday === "number" ? weekday : Number.parseInt(String(weekday), 10);
  return Number.isInteger(value) ? value : -1;
}

export function profileAvailabilitiesForWeekday<
  T extends { weekday: number | string },
>(availabilities: readonly T[], weekday: number): T[] {
  return availabilities.filter(
    (slot) => normalizeProfileAvailabilityWeekday(slot.weekday) === weekday
  );
}

export function filterEmployeesAvailableOnWeekday(
  profiles: readonly Profile[],
  availability: readonly ProfileRecurringAvailability[],
  weekday: number,
  organizationId?: string
): Profile[] {
  const profileIdsWithSlot = new Set(
    availability
      .filter((slot) => normalizeProfileAvailabilityWeekday(slot.weekday) === weekday)
      .map((slot) => slot.profile_id)
  );

  return profiles.filter(
    (profile) =>
      (organizationId
        ? profileCanReceiveShiftAssignment(profile, organizationId)
        : profile.is_active && profile.schedulable) &&
      profileIdsWithSlot.has(profile.id)
  );
}

/** Aktive, planbare Profile (inkl. Admins/Manager mit schedulable). */
export function filterProfilesForShiftAssignment(
  profiles: readonly Profile[],
  organizationId: string
): Profile[] {
  return profiles.filter((profile) =>
    profileCanReceiveShiftAssignment(profile, organizationId)
  );
}

/** Gleiche Kriterien wie die Bereich-Kalender-Mitarbeiterliste (planbar + aktiv). */
export function profileCanReceiveShiftAssignment(
  profile:
    | Pick<Profile, "organization_id" | "is_active" | "schedulable">
    | null
    | undefined,
  organizationId: string
): boolean {
  return (
    !!profile &&
    profile.organization_id === organizationId &&
    profile.is_active &&
    profile.schedulable
  );
}

/** Filtert MA ohne App-Registrierung wenn Schichtbestätigung aktiv (Spec 008). */
export function filterProfilesForShiftConfirmationAssign(
  profiles: readonly Profile[],
  shiftConfirmationEnabled: boolean,
  relaxAppRegistrationGate = false
): Profile[] {
  if (!shiftConfirmationEnabled || relaxAppRegistrationGate) {
    return [...profiles];
  }
  return profiles.filter((profile) =>
    profileEligibleForShiftConfirmationAssignment(profile)
  );
}

export function filterEmployeesNotAbsentOnDate(
  profiles: readonly Profile[],
  absences: readonly AbsenceRequest[],
  dateISO: string
): Profile[] {
  const absentIds = new Set<string>();
  for (const absence of absences) {
    if (absence.status !== "approved") continue;
    const range = absenceRequestToRange(absence);
    if (isDateWithinAbsenceRange(range, dateISO)) {
      absentIds.add(absence.employee_id);
    }
  }
  return profiles.filter((profile) => !absentIds.has(profile.id));
}

export function employeeMatchesAreaCalendarShiftWindow(
  profileId: string,
  availability: readonly ProfileRecurringAvailability[],
  weekday: number,
  windowStart: string,
  windowEnd: string
): boolean {
  return availability.some(
    (slot) =>
      slot.profile_id === profileId &&
      normalizeProfileAvailabilityWeekday(slot.weekday) === weekday &&
      shiftWindowFitsAvailabilitySlot(
        windowStart,
        windowEnd,
        slot.start_time,
        slot.end_time
      )
  );
}

type AreaCalendarShiftAssignAvailability = {
  weekday: number | string;
  start_time: string;
  end_time: string;
};

function availabilitySlotCoversShiftWindow(
  slot: AreaCalendarShiftAssignAvailability,
  windowStart: string,
  windowEnd: string
): boolean {
  return shiftWindowFitsAvailabilitySlot(
    windowStart,
    windowEnd,
    slot.start_time,
    slot.end_time
  );
}

export function employeeMatchesAreaCalendarShiftAssignWindow(
  availabilities: readonly AreaCalendarShiftAssignAvailability[],
  weekday: number,
  windowStart: string,
  windowEnd: string
): boolean {
  return availabilities.some(
    (slot) =>
      normalizeProfileAvailabilityWeekday(slot.weekday) === weekday &&
      availabilitySlotCoversShiftWindow(slot, windowStart, windowEnd)
  );
}

export function filterAreaCalendarShiftAssignEmployeesByWindow<
  T extends {
    id: string;
    availabilities: readonly AreaCalendarShiftAssignAvailability[];
  },
>(
  employees: readonly T[],
  weekday: number,
  windowStart: string,
  windowEnd: string
): T[] {
  if (!areAreaCalendarShiftTimesComplete(windowStart, windowEnd)) return [];
  return employees.filter((employee) =>
    employeeMatchesAreaCalendarShiftAssignWindow(
      employee.availabilities,
      weekday,
      windowStart,
      windowEnd
    )
  );
}

type AreaCalendarAreaAssignmentWindow = {
  employeeId: string;
  startTime: string;
  endTime: string;
};

export function filterAreaCalendarShiftAssignEmployeesByWindowWithoutOverlap<
  T extends {
    id: string;
    availabilities: readonly AreaCalendarShiftAssignAvailability[];
  },
>(
  employees: readonly T[],
  weekday: number,
  windowStart: string,
  windowEnd: string,
  shiftDate: string,
  areaAssignments: readonly AreaCalendarAreaAssignmentWindow[],
  timeZone?: string
): T[] {
  const available = filterAreaCalendarShiftAssignEmployeesByWindow(
    employees,
    weekday,
    windowStart,
    windowEnd
  );
  if (!areAreaCalendarShiftTimesComplete(windowStart, windowEnd)) return [];

  return available.filter(
    (employee) =>
      !areaAssignments.some(
        (assignment) =>
          assignment.employeeId === employee.id &&
          areaCalendarShiftWindowsOverlap(
            shiftDate,
            windowStart,
            windowEnd,
            assignment.startTime,
            assignment.endTime,
            timeZone
          )
      )
  );
}

export type BulkShiftEmployeeAssignmentContext = {
  shiftDate: string;
  countryCode: string;
  timeZone: string;
  areaAssignments: readonly AreaCalendarAreaAssignmentWindow[];
  otherAreaAssignments: readonly AreaCalendarAreaAssignmentWindow[];
};

function assignmentWindowsForEmployee(
  employeeId: string,
  assignments: readonly AreaCalendarAreaAssignmentWindow[]
): { startTime: string; endTime: string }[] {
  return assignments
    .filter(
      (assignment) =>
        assignment.employeeId === employeeId &&
        areAreaCalendarShiftTimesComplete(assignment.startTime, assignment.endTime)
    )
    .map((assignment) => ({
      startTime: assignment.startTime,
      endTime: assignment.endTime,
    }));
}

/** Verfügbarkeit, keine Überschneidung, Tages-Compliance inkl. anderer Bereiche. */
export function employeeEligibleForBulkShiftAssignment(
  employeeId: string,
  windowStart: string,
  windowEnd: string,
  context: BulkShiftEmployeeAssignmentContext
): boolean {
  if (!areAreaCalendarShiftTimesComplete(windowStart, windowEnd)) return false;

  const sameAreaWindows = assignmentWindowsForEmployee(
    employeeId,
    context.areaAssignments
  );

  for (const existing of sameAreaWindows) {
    if (
      areaCalendarShiftWindowsOverlap(
        context.shiftDate,
        windowStart,
        windowEnd,
        existing.startTime,
        existing.endTime,
        context.timeZone
      )
    ) {
      return false;
    }
  }

  for (const existing of context.otherAreaAssignments) {
    if (existing.employeeId !== employeeId) continue;
    if (
      areaCalendarShiftWindowsOverlap(
        context.shiftDate,
        windowStart,
        windowEnd,
        existing.startTime,
        existing.endTime,
        context.timeZone
      )
    ) {
      return false;
    }
  }

  const otherAreaWindows = assignmentWindowsForEmployee(
    employeeId,
    context.otherAreaAssignments
  );
  const proposed = { startTime: windowStart, endTime: windowEnd };
  const allWindows = [...sameAreaWindows, proposed, ...otherAreaWindows];
  const requiresDayLevelCheck = allWindows.length >= 2;

  const result = validateEmployeeDayShiftAssignments({
    countryCode: context.countryCode,
    shiftDate: context.shiftDate,
    weekday: weekdayIndexFromDate(context.shiftDate),
    windows: requiresDayLevelCheck ? allWindows : [proposed],
  });

  return result.ok;
}

export function filterBulkShiftAssignEmployeesForRow<
  T extends {
    id: string;
    availabilities: readonly AreaCalendarShiftAssignAvailability[];
  },
>(
  employees: readonly T[],
  profileAvailabilityWeekday: number,
  windowStart: string,
  windowEnd: string,
  context: BulkShiftEmployeeAssignmentContext
): T[] {
  const available = filterAreaCalendarShiftAssignEmployeesByWindow(
    employees,
    profileAvailabilityWeekday,
    windowStart,
    windowEnd
  );
  if (!areAreaCalendarShiftTimesComplete(windowStart, windowEnd)) return [];

  return available.filter((employee) =>
    employeeEligibleForBulkShiftAssignment(
      employee.id,
      windowStart,
      windowEnd,
      context
    )
  );
}

/**
 * Tag ohne Servicezeit: MA mit Verfügbarkeit am Wochentag (Liste ist bereits
 * ohne Abwesenheiten), bevor Von/Bis gesetzt sind.
 */
export function filterBulkShiftAssignEmployeesWithoutTimeWindow<
  T extends {
    id: string;
    availabilities: readonly AreaCalendarShiftAssignAvailability[];
  },
>(employees: readonly T[], weekday: number): T[] {
  return employees.filter(
    (employee) =>
      profileAvailabilitiesForWeekday(employee.availabilities, weekday).length >
      0
  );
}

export function dedupeAreaCalendarAssignmentWindows<
  T extends AreaCalendarAreaAssignmentWindow,
>(assignments: readonly T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const assignment of assignments) {
    const key = `${assignment.employeeId}|${assignment.startTime.slice(0, 5)}|${assignment.endTime.slice(0, 5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(assignment);
  }
  return deduped;
}

export function pickEmployeeLongestWithoutShift<
  T extends { id: string; last_shift_date: string | null },
>(employees: readonly T[]): T | null {
  if (!employees.length) return null;

  return [...employees].sort((a, b) => {
    if (!a.last_shift_date && !b.last_shift_date) {
      return a.id.localeCompare(b.id);
    }
    if (!a.last_shift_date) return -1;
    if (!b.last_shift_date) return 1;
    const byDate = a.last_shift_date.localeCompare(b.last_shift_date);
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  })[0];
}

export type ShiftAssignmentRequestWindow = {
  startTime: string;
  endTime: string;
  requestedStartTime?: string;
  requestedEndTime?: string;
};

/** Angeforderte Schichtzeit (Personalbedarf/Von-Bis), nicht Verfügbarkeitsfenster. */
export function resolveShiftAssignmentRequestWindow(
  row: ShiftAssignmentRequestWindow
): { startTime: string; endTime: string } {
  if (
    row.requestedStartTime &&
    row.requestedEndTime &&
    areAreaCalendarShiftTimesComplete(row.requestedStartTime, row.requestedEndTime)
  ) {
    return {
      startTime: row.requestedStartTime,
      endTime: row.requestedEndTime,
    };
  }
  return { startTime: row.startTime, endTime: row.endTime };
}

export function filterEmployeesEligibleForShiftAssignment<
  T extends {
    id: string;
    availabilities: readonly AreaCalendarShiftAssignAvailability[];
  },
>(
  employees: readonly T[],
  weekday: number,
  requestWindow: ShiftAssignmentRequestWindow,
  shiftDate: string,
  areaAssignments: readonly AreaCalendarAreaAssignmentWindow[],
  qualificationId: string,
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>
): T[] {
  const { startTime, endTime } = resolveShiftAssignmentRequestWindow(requestWindow);
  const byWindow = filterAreaCalendarShiftAssignEmployeesByWindowWithoutOverlap(
    employees,
    weekday,
    startTime,
    endTime,
    shiftDate,
    areaAssignments
  );
  return filterEmployeesByQualificationForShift(
    byWindow,
    qualificationId,
    profileQualificationIds
  );
}

function filterEmployeesByQualificationForShift<
  T extends { id: string },
>(
  employees: readonly T[],
  qualificationId: string,
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>
): T[] {
  if (!qualificationId) return [...employees];
  return employees.filter((employee) =>
    profileQualificationIds.get(employee.id)?.has(qualificationId)
  );
}

/** Schichtplan „Schicht hinzufügen“: Verfügbarkeit + ausgewählter Job (Abwesenheit bereits in der Liste). */
export function filterPlanningAssignShiftEmployees<
  T extends {
    id: string;
    availabilities: readonly AreaCalendarShiftAssignAvailability[];
  },
>(
  employees: readonly T[],
  weekday: number,
  windowStart: string,
  windowEnd: string,
  options: {
    simplePlanning: boolean;
    qualificationId: string;
    profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
    shiftDate?: string;
    organizationDayAssignments?: readonly AreaCalendarAreaAssignmentWindow[];
    timeZone?: string;
  }
): T[] {
  if (!areAreaCalendarShiftTimesComplete(windowStart, windowEnd)) return [];

  let available = filterAreaCalendarShiftAssignEmployeesByWindow(
    employees,
    weekday,
    windowStart,
    windowEnd
  );

  if (options.shiftDate && options.organizationDayAssignments?.length) {
    available = filterAreaCalendarShiftAssignEmployeesByWindowWithoutOverlap(
      available,
      weekday,
      windowStart,
      windowEnd,
      options.shiftDate,
      options.organizationDayAssignments,
      options.timeZone
    );
  }

  if (options.simplePlanning) return available;
  if (!options.qualificationId) return [];

  return filterEmployeesByQualificationForShift(
    available,
    options.qualificationId,
    options.profileQualificationIds
  );
}

export function weekdayFromAreaCalendarDate(dateISO: string): number {
  return serviceWeekdayForDate(dateISO);
}

/** Mo=0 … So=6, Feiertage=7 (wie Servicezeiten). */
export function profileAvailabilityWeekdayFromAreaCalendarDate(
  dateISO: string
): number {
  return serviceWeekdayForDate(dateISO);
}
