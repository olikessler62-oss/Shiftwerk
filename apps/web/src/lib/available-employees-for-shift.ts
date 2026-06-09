import {
  isDateWithinAbsenceRange,
  parseAvailabilityTimeRange,
  timeToMinutes,
  type AbsenceRange,
} from "@schichtwerk/database";
import type { AbsenceRequest, Profile, ProfileRecurringAvailability } from "@schichtwerk/types";
import {
  serviceWeekdayForDate,
  weekdayIndexFromDate,
} from "@/lib/location-staffing-client";
import { dashboardShiftWindowsOverlap } from "@/lib/shift-overlap";

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
  return availabilityRangeContainedInWindow(
    dashboardTimeKey(shiftStart),
    dashboardTimeKey(shiftEnd),
    dashboardTimeKey(slotStart),
    dashboardTimeKey(slotEnd)
  );
}

export function areDashboardShiftTimesComplete(
  startTime: string,
  endTime: string
): boolean {
  return parseAvailabilityTimeRange({
    start_time: dashboardTimeKey(startTime),
    end_time: dashboardTimeKey(endTime),
  }).ok;
}

function dashboardTimeKey(raw: string): string {
  const trimmed = raw.trim();
  const parts = trimmed.split(":");
  const hRaw = parts[0] ?? "00";
  const mRaw = (parts[1] ?? "00").slice(0, 2);
  return `${hRaw.padStart(2, "0")}:${mRaw.padStart(2, "0")}`;
}

export function normalizeDashboardShiftTime(raw: string): string {
  return dashboardTimeKey(raw);
}

function normalizeProfileAvailabilityWeekday(weekday: number | string): number {
  const value = typeof weekday === "number" ? weekday : Number.parseInt(String(weekday), 10);
  return Number.isInteger(value) ? value : -1;
}

export function filterEmployeesAvailableOnWeekday(
  profiles: readonly Profile[],
  availability: readonly ProfileRecurringAvailability[],
  weekday: number
): Profile[] {
  const profileIdsWithSlot = new Set(
    availability
      .filter((slot) => normalizeProfileAvailabilityWeekday(slot.weekday) === weekday)
      .map((slot) => slot.profile_id)
  );

  return profiles.filter(
    (profile) =>
      profile.is_active &&
      profile.schedulable &&
      profileIdsWithSlot.has(profile.id)
  );
}

/** Gleiche Kriterien wie die Dashboard-Mitarbeiterliste (planbar + aktiv). */
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

export function filterEmployeesNotAbsentOnDate(
  profiles: readonly Profile[],
  absences: readonly AbsenceRequest[],
  dateISO: string
): Profile[] {
  const absentIds = new Set<string>();
  for (const absence of absences) {
    if (absence.status !== "approved") continue;
    const range: AbsenceRange = {
      employee_id: absence.employee_id,
      start_date: absence.start_date,
      end_date: absence.end_date,
    };
    if (isDateWithinAbsenceRange(range, dateISO)) {
      absentIds.add(absence.employee_id);
    }
  }
  return profiles.filter((profile) => !absentIds.has(profile.id));
}

export function employeeMatchesDashboardShiftWindow(
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

type DashboardShiftAssignAvailability = {
  weekday: number | string;
  start_time: string;
  end_time: string;
  shift_type_id?: string | null;
};

type ShiftTypeTimeRef = {
  id: string;
  start_time: string;
  end_time: string;
};

function availabilitySlotTimeWindows(
  slot: DashboardShiftAssignAvailability,
  shiftTypes?: readonly ShiftTypeTimeRef[]
): { start: string; end: string }[] {
  const windows: { start: string; end: string }[] = [
    { start: slot.start_time, end: slot.end_time },
  ];
  if (slot.shift_type_id && shiftTypes) {
    const type = shiftTypes.find((entry) => entry.id === slot.shift_type_id);
    if (type) {
      windows.push({ start: type.start_time, end: type.end_time });
    }
  }
  return windows;
}

function availabilitySlotCoversShiftWindow(
  slot: DashboardShiftAssignAvailability,
  windowStart: string,
  windowEnd: string,
  shiftTypes?: readonly ShiftTypeTimeRef[]
): boolean {
  return availabilitySlotTimeWindows(slot, shiftTypes).some((window) =>
    shiftWindowFitsAvailabilitySlot(
      windowStart,
      windowEnd,
      window.start,
      window.end
    )
  );
}

export function employeeMatchesDashboardShiftAssignWindow(
  availabilities: readonly DashboardShiftAssignAvailability[],
  weekday: number,
  windowStart: string,
  windowEnd: string,
  shiftTypes?: readonly ShiftTypeTimeRef[]
): boolean {
  return availabilities.some(
    (slot) =>
      normalizeProfileAvailabilityWeekday(slot.weekday) === weekday &&
      availabilitySlotCoversShiftWindow(slot, windowStart, windowEnd, shiftTypes)
  );
}

export function filterDashboardShiftAssignEmployeesByWindow<
  T extends {
    id: string;
    availabilities: readonly DashboardShiftAssignAvailability[];
  },
>(
  employees: readonly T[],
  weekday: number,
  windowStart: string,
  windowEnd: string,
  shiftTypes?: readonly ShiftTypeTimeRef[]
): T[] {
  if (!areDashboardShiftTimesComplete(windowStart, windowEnd)) return [];
  return employees.filter((employee) =>
    employeeMatchesDashboardShiftAssignWindow(
      employee.availabilities,
      weekday,
      windowStart,
      windowEnd,
      shiftTypes
    )
  );
}

type DashboardAreaAssignmentWindow = {
  employeeId: string;
  startTime: string;
  endTime: string;
};

export function filterDashboardShiftAssignEmployeesByWindowWithoutOverlap<
  T extends {
    id: string;
    availabilities: readonly DashboardShiftAssignAvailability[];
  },
>(
  employees: readonly T[],
  weekday: number,
  windowStart: string,
  windowEnd: string,
  shiftDate: string,
  areaAssignments: readonly DashboardAreaAssignmentWindow[],
  shiftTypes?: readonly ShiftTypeTimeRef[]
): T[] {
  const available = filterDashboardShiftAssignEmployeesByWindow(
    employees,
    weekday,
    windowStart,
    windowEnd,
    shiftTypes
  );
  if (!areDashboardShiftTimesComplete(windowStart, windowEnd)) return [];

  return available.filter(
    (employee) =>
      !areaAssignments.some(
        (assignment) =>
          assignment.employeeId === employee.id &&
          dashboardShiftWindowsOverlap(
            shiftDate,
            windowStart,
            windowEnd,
            assignment.startTime,
            assignment.endTime
          )
      )
  );
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

export function resolveShiftTypeIdFromTimes(
  startTime: string,
  endTime: string,
  shiftTypes: readonly { id: string; start_time: string; end_time: string }[]
): string | null {
  if (!areDashboardShiftTimesComplete(startTime, endTime)) return null;

  const start = dashboardTimeKey(startTime);
  const end = dashboardTimeKey(endTime);

  return (
    shiftTypes.find(
      (type) =>
        dashboardTimeKey(type.start_time) === start &&
        dashboardTimeKey(type.end_time) === end
    )?.id ?? null
  );
}

export function weekdayFromDashboardDate(dateISO: string): number {
  return serviceWeekdayForDate(dateISO);
}

/** Profil-Verfügbarkeiten sind Mo–So (0–6), nicht Feiertags-Spalte 7. */
export function profileAvailabilityWeekdayFromDashboardDate(
  dateISO: string
): number {
  return weekdayIndexFromDate(dateISO);
}
