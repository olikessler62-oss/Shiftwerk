import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import type { PlanningShift } from "@/lib/planning-shift-card";

/** Temporär: Simple-Kalender (nur erste Schicht pro Mitarbeiter/Tag). */
export const SIMPLE_CALENDAR_FIRST_SHIFT_ONLY_STORAGE_KEY =
  "shiftwerk.dev.simpleCalendarFirstShiftOnly";

export function readSimpleCalendarFirstShiftOnlyPreference(
  fallback: boolean
): boolean {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(
    SIMPLE_CALENDAR_FIRST_SHIFT_ONLY_STORAGE_KEY
  );
  if (stored === "true") return true;
  if (stored === "false") return false;
  return fallback;
}

export function writeSimpleCalendarFirstShiftOnlyPreference(
  enabled: boolean
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SIMPLE_CALENDAR_FIRST_SHIFT_ONLY_STORAGE_KEY,
    enabled ? "true" : "false"
  );
}

function compareShiftStartThenId(
  a: { startTime: string; id: string },
  b: { startTime: string; id: string }
): number {
  const startDiff = a.startTime.localeCompare(b.startTime);
  if (startDiff !== 0) return startDiff;
  return a.id.localeCompare(b.id);
}

/** Simple-Modus: früheste Schicht pro Mitarbeiter und Tag. */
export function pickFirstPlanningShiftPerEmployeeDay(
  shifts: readonly PlanningShift[]
): PlanningShift[] {
  const byKey = new Map<string, PlanningShift>();
  for (const shift of shifts) {
    const key = `${shift.employee_id}:${shift.shift_date}`;
    const existing = byKey.get(key);
    if (!existing || compareShiftStartThenId(shift, existing) < 0) {
      byKey.set(key, shift);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const dateDiff = a.shift_date.localeCompare(b.shift_date);
    if (dateDiff !== 0) return dateDiff;
    const employeeDiff = a.employee_id.localeCompare(b.employee_id);
    if (employeeDiff !== 0) return employeeDiff;
    return compareShiftStartThenId(a, b);
  });
}

/** Simple-Modus im Dashboard: früheste Schicht pro Mitarbeiter und Tag. */
export function pickFirstDashboardShiftPerEmployeeDay(
  shifts: readonly DashboardShiftCard[]
): DashboardShiftCard[] {
  const byKey = new Map<string, DashboardShiftCard>();
  for (const shift of shifts) {
    const key = `${shift.employeeId}:${shift.shift_date}`;
    const existing = byKey.get(key);
    if (!existing || compareShiftStartThenId(shift, existing) < 0) {
      byKey.set(key, shift);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const dateDiff = a.shift_date.localeCompare(b.shift_date);
    if (dateDiff !== 0) return dateDiff;
    const employeeDiff = a.employeeId.localeCompare(b.employeeId);
    if (employeeDiff !== 0) return employeeDiff;
    return compareShiftStartThenId(a, b);
  });
}

export function filterDashboardShiftsByAreaDateFirstOnly(
  byAreaDate: ReadonlyMap<string, readonly DashboardShiftCard[]>
): Map<string, DashboardShiftCard[]> {
  const filtered = new Map<string, DashboardShiftCard[]>();
  for (const [key, list] of byAreaDate) {
    const next = pickFirstDashboardShiftPerEmployeeDay(list);
    if (next.length > 0) filtered.set(key, next);
  }
  return filtered;
}

export function filterDashboardShiftsByDateFirstOnly(
  shiftsByDate: ReadonlyMap<string, readonly DashboardShiftCard[]>
): Map<string, DashboardShiftCard[]> {
  const filtered = new Map<string, DashboardShiftCard[]>();
  for (const [date, list] of shiftsByDate) {
    const next = pickFirstDashboardShiftPerEmployeeDay(list);
    if (next.length > 0) filtered.set(date, next);
  }
  return filtered;
}
