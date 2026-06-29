import { areAreaCalendarShiftTimesComplete } from "@/lib/available-employees-for-shift";
import { buildShiftTimestamps, getISOWeek, parseISODate } from "@/lib/dates";
import {
  shiftWorkHoursFromRef,
  shiftWorkMinutesFromRef,
  type ShiftWorkHoursRef,
} from "@/lib/shift-work-hours";
import {
  resolveProfileWeeklyHoursTarget,
  timeToMinutes,
  weekdayIndexFromDate,
  type ShiftTypeBreakInput,
} from "@schichtwerk/database";
import {
  isEnglishIntlLocale,
  isGermanIntlLocale,
  weekdayAbbrevFromIndex,
} from "@schichtwerk/i18n";

export type PlanningShiftRef = ShiftWorkHoursRef & {
  employee_id: string;
  shift_date: string;
};

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function planningHoursUnitLabel(locale: string): "Std" | "h" {
  return locale.startsWith("de") ? "Std" : "h";
}

export function formatPlanningHoursRatio(
  current: number,
  target: number,
  locale: string
): string {
  return `${current}/${target} ${planningHoursUnitLabel(locale)}`;
}

export function formatPlanningHoursInParens(
  hours: number,
  locale: string
): string {
  return `(${hours} ${planningHoursUnitLabel(locale)})`;
}

export function shiftHours(timeWindow: {
  start_time: string;
  end_time: string;
}): number {
  return shiftHoursFromWindow(timeWindow.start_time, timeWindow.end_time);
}

export function shiftHoursFromWindow(
  startTime: string,
  endTime: string,
  breaks?: readonly ShiftTypeBreakInput[]
): number {
  return shiftWorkHoursFromRef({ startTime, endTime, breaks });
}

export function weeklyAssignedMinutesByEmployeeId(
  shifts: readonly PlanningShiftRef[],
  weekDates: readonly string[],
  options?: {
    breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>;
  }
): Map<string, number> {
  const weekDateSet = new Set(weekDates);
  const totals = new Map<string, number>();

  for (const shift of shifts) {
    if (!weekDateSet.has(shift.shift_date)) continue;
    if (!areAreaCalendarShiftTimesComplete(shift.startTime, shift.endTime)) {
      continue;
    }
    const minutes = shiftWorkMinutesFromRef(shift, options);
    totals.set(
      shift.employee_id,
      (totals.get(shift.employee_id) ?? 0) + minutes
    );
  }

  return totals;
}

export function buildEmployeeWeeklyHoursTooltipLabels(
  employees: readonly { id: string; weekly_hours?: number | null }[],
  assignedMinutesByEmployeeId: ReadonlyMap<string, number>,
  locale: string
): Map<string, string> {
  const tooltipLocale = locale.startsWith("de") ? "de" : "en";
  const labels = new Map<string, string>();

  for (const employee of employees) {
    const assignedMinutes = assignedMinutesByEmployeeId.get(employee.id) ?? 0;
    const assignedHours = Math.round((assignedMinutes / 60) * 10) / 10;
    const targetHours = resolveProfileWeeklyHoursTarget(
      employee.weekly_hours ?? null
    );
    labels.set(
      employee.id,
      formatPlanningHoursRatio(assignedHours, targetHours, tooltipLocale)
    );
  }

  return labels;
}

export function employeeWeekHours(
  employeeId: string,
  shifts: readonly PlanningShiftRef[],
  options?: {
    breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>;
  }
): number {
  let total = 0;
  for (const shift of shifts) {
    if (shift.employee_id !== employeeId) continue;
    total += shiftWorkHoursFromRef(shift, options);
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

/** Datumszeile im Planungs-Header (detailliertes Wochenintervall + KW; monthYearLabel kompakt). */
export function getAreaCalendarWeekHeaderParts(
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
  const dayMonthYearFmt = new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const monthFmt = new Intl.DateTimeFormat(intlLocale, { month: "long" });
  const monthYearFmt = new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
  });

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = startYear === endYear;

  let monthYearLabel: string;
  if (sameMonth && sameYear) {
    monthYearLabel = monthYearFmt.format(start);
  } else if (sameYear) {
    monthYearLabel = `${monthFmt.format(start)}/${monthFmt.format(end)} ${startYear}`;
  } else {
    monthYearLabel = `${monthYearFmt.format(start)}/${monthYearFmt.format(end)}`;
  }

  const rangeLabel = sameYear
    ? `${dayMonthFmt.format(start)} – ${dayMonthYearFmt.format(end)}`
    : `${dayMonthYearFmt.format(start)} – ${dayMonthYearFmt.format(end)}`;

  const compactDayMonthFmt = new Intl.DateTimeFormat(intlLocale, {
    day: "2-digit",
    month: "2-digit",
  });
  const compactRangeLabel =
    startYear !== endYear
      ? `${compactDayMonthFmt.format(start)}-${compactDayMonthFmt.format(end)}${new Intl.DateTimeFormat(intlLocale, { year: "2-digit" }).format(end)}`
      : `${compactDayMonthFmt.format(start)}-${compactDayMonthFmt.format(end)}`;

  return {
    rangeLabel,
    compactRangeLabel,
    monthYearLabel,
    year: startYear,
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
  let weekday: string;
  if (weekdayStyle === "long") {
    weekday = new Intl.DateTimeFormat(intlLocale, { weekday: "long" }).format(d);
  } else if (isEnglishIntlLocale(intlLocale)) {
    weekday = weekdayAbbrevFromIndex(weekdayIndexFromDate(dateISO), "en");
  } else if (isGermanIntlLocale(intlLocale)) {
    weekday = weekdayAbbrevFromIndex(weekdayIndexFromDate(dateISO), "de");
  } else {
    weekday = new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(d);
  }
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
  shifts: PlanningShiftRef[],
  dates: string[]
): PlanningWarning[] {
  const warnings: PlanningWarning[] = [];

  for (const emp of employees) {
    const hours = employeeWeekHours(emp.id, shifts);
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
  shifts: PlanningShiftRef[],
  employees: { weekly_hours: number | null }[]
) {
  const plannedHours = shifts.reduce(
    (sum, shift) => sum + shiftWorkHoursFromRef(shift),
    0
  );

  const targetHours = employees.reduce((sum, e) => sum + (e.weekly_hours ?? 40), 0);
  const openSlots = Math.max(0, employees.length * 5 - shifts.length);

  return {
    plannedHours: Math.round(plannedHours * 10) / 10,
    targetHours,
    openShifts: openSlots,
    estimatedCost: Math.round(plannedHours * 14.5),
  };
}

export type PlanningWeeklySummary = ReturnType<typeof weeklySummary>;
