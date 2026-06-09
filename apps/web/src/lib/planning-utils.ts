import type { Shift, ShiftType } from "@schichtwerk/types";
import { buildShiftTimestamps, getISOWeek, parseISODate } from "@/lib/dates";

type ShiftWithType = Shift & {
  shift_types: { name: string; color: string } | null;
};

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function shiftHours(shiftType: Pick<ShiftType, "start_time" | "end_time">): number {
  const { starts_at, ends_at } = buildShiftTimestamps(
    "2000-01-01",
    shiftType.start_time,
    shiftType.end_time
  );
  const ms = new Date(ends_at).getTime() - new Date(starts_at).getTime();
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export function employeeWeekHours(
  employeeId: string,
  shifts: ShiftWithType[],
  shiftTypes: ShiftType[]
): number {
  const typeMap = new Map(shiftTypes.map((t) => [t.id, t]));
  let total = 0;
  for (const shift of shifts) {
    if (shift.employee_id !== employeeId) continue;
    const type = typeMap.get(shift.shift_type_id);
    if (type) total += shiftHours(type);
  }
  return Math.round(total * 10) / 10;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function avatarColor(name: string): string {
  const palette = [
    "#6366F1",
    "#0D9488",
    "#F59E0B",
    "#EC4899",
    "#8B5CF6",
    "#14B8A6",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function formatWeekRange(weekStartISO: string): string {
  const start = parseISODate(weekStartISO);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** Datumszeile im Dashboard-Header (Skizze: „1. Juni – 7. Juni“, Jahr, KW). */
export function getDashboardWeekHeaderParts(
  weekStartISO: string,
  intlLocale = "de-DE"
) {
  const start = parseISODate(weekStartISO);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const dayMonthFmt = new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "long",
  });
  return {
    rangeLabel: `${dayMonthFmt.format(start)} – ${dayMonthFmt.format(end)}`,
    year: start.getFullYear(),
    calendarWeek: getISOWeek(start),
  };
}

export type DayHeaderWeekdayStyle = "short" | "long";

export function formatDayHeader(
  dateISO: string,
  intlLocale = "de-DE",
  weekdayStyle: DayHeaderWeekdayStyle = "short"
): { weekday: string; label: string } {
  const d = parseISODate(dateISO);
  const weekday = new Intl.DateTimeFormat(intlLocale, {
    weekday: weekdayStyle === "long" ? "long" : "short",
  }).format(d);
  const label = new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "short",
  }).format(d);
  return { weekday, label };
}

export type PlanningWarning = {
  id: string;
  message: string;
  severity: "warning" | "info";
};

export function buildPlanningWarnings(
  employees: { id: string; full_name: string; weekly_hours: number | null }[],
  shifts: ShiftWithType[],
  shiftTypes: ShiftType[],
  dates: string[]
): PlanningWarning[] {
  const warnings: PlanningWarning[] = [];

  for (const emp of employees) {
    const hours = employeeWeekHours(emp.id, shifts, shiftTypes);
    const target = emp.weekly_hours ?? 40;
    if (hours > target) {
      warnings.push({
        id: `hours-${emp.id}`,
        message: `${emp.full_name} überschreitet die Wochenstunden um ${Math.round((hours - target) * 10) / 10} h.`,
        severity: "warning",
      });
    }
  }

  for (const date of dates) {
    const dayShifts = shifts.filter((s) => s.shift_date === date);
    if (employees.length > 0 && dayShifts.length < Math.ceil(employees.length / 3)) {
      const label = new Intl.DateTimeFormat("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "short",
      }).format(parseISODate(date));
      warnings.push({
        id: `staff-${date}`,
        message: `${label}: Unterbesetzung — nur ${dayShifts.length} Schichten geplant.`,
        severity: "warning",
      });
    }
  }

  return warnings.slice(0, 6);
}

export function weeklySummary(
  shifts: ShiftWithType[],
  shiftTypes: ShiftType[],
  employees: { weekly_hours: number | null }[]
) {
  const plannedHours = shifts.reduce((sum, shift) => {
    const type = shiftTypes.find((t) => t.id === shift.shift_type_id);
    return sum + (type ? shiftHours(type) : 0);
  }, 0);

  const targetHours = employees.reduce((sum, e) => sum + (e.weekly_hours ?? 40), 0);
  const openSlots = Math.max(0, employees.length * 5 - shifts.length);

  return {
    plannedHours: Math.round(plannedHours * 10) / 10,
    targetHours,
    openShifts: openSlots,
    estimatedCost: Math.round(plannedHours * 14.5),
  };
}
