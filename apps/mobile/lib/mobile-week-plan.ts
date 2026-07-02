import type { ConfirmationWeekItem, EmployeeWeekShiftDisplayItem, Shift } from "@schichtwerk/types";
import { isHiddenFromEmployeeWeekPlan } from "@/lib/employee-shift-dismiss";

export type WeekPlanDay = {
  dateISO: string;
  weekdayLabel: string;
  dateLabel: string;
  shifts: Array<{
    shift: Shift;
    display?: EmployeeWeekShiftDisplayItem;
    confirmation?: ConfirmationWeekItem;
  }>;
};

export type WeekPlanRow =
  | {
      kind: "day-header";
      id: string;
      dateISO: string;
      weekdayLabel: string;
      dateLabel: string;
    }
  | {
      kind: "shift";
      id: string;
      shift: Shift;
      display?: EmployeeWeekShiftDisplayItem;
      confirmation?: ConfirmationWeekItem;
    };

export type WeekRange = {
  from: string;
  to: string;
  dates: string[];
  weekLabel: string;
  calendarWeek: number;
  monday: Date;
};

export type WeekHeaderLeftParts = {
  monthYearLabel: string;
  calendarWeekNumber: number;
  accessibilityLabel: string;
};

function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function localDateISO(reference = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isTodayDateISO(dateISO: string, reference = new Date()): boolean {
  return dateISO === localDateISO(reference);
}

export function isPastDateISO(dateISO: string, reference = new Date()): boolean {
  return dateISO < localDateISO(reference);
}

function startOfWeekMonday(reference: Date, offsetWeeks: number): Date {
  const day = reference.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(reference.getDate() + diff + offsetWeeks * 7);
  return monday;
}

export function isoWeekNumber(date: Date): number {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((tmp.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

export function weekRangeForOffset(offsetWeeks: number, reference = new Date()): WeekRange {
  const monday = startOfWeekMonday(reference, offsetWeeks);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    dates.push(formatDateISO(day));
  }

  return {
    from: formatDateISO(monday),
    to: formatDateISO(sunday),
    dates,
    weekLabel: `KW ${isoWeekNumber(monday)}`,
    calendarWeek: isoWeekNumber(monday),
    monday,
  };
}

function weekSunday(monday: Date): Date {
  const sunday = new Date(monday);
  sunday.setHours(12, 0, 0, 0);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

/** Monatskürzel (3 Buchstaben) für den Wochenkopf — z. B. Jun, Dec. */
const MONTH_ABBREV_HEADER = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatWeekHeaderMonthYearLabel(weekMonday: Date): string {
  const start = new Date(weekMonday);
  start.setHours(12, 0, 0, 0);
  const end = weekSunday(start);

  const startMonth = MONTH_ABBREV_HEADER[start.getMonth()] ?? "???";
  const endMonth = MONTH_ABBREV_HEADER[end.getMonth()] ?? "???";
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (start.getMonth() === end.getMonth() && startYear === endYear) {
    return `${startMonth} ${startYear}`;
  }
  if (startYear === endYear) {
    return `${startMonth}/${endMonth} ${startYear}`;
  }
  return `${startMonth} ${startYear}/${endMonth} ${endYear}`;
}

export function getWeekHeaderLeftParts(weekRange: WeekRange): WeekHeaderLeftParts {
  const monthYearLabel = formatWeekHeaderMonthYearLabel(weekRange.monday);
  const calendarWeekNumber = weekRange.calendarWeek;

  return {
    monthYearLabel,
    calendarWeekNumber,
    accessibilityLabel: `${monthYearLabel}, KW ${calendarWeekNumber}`,
  };
}

export function formatDayHeaderParts(dateISO: string): {
  weekdayLabel: string;
  dateLabel: string;
} {
  const date = new Date(`${dateISO}T12:00:00`);
  const weekdayShort = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
  }).format(date);
  const weekdayLabel = weekdayShort.replace(/\.$/, "").toUpperCase();
  const dateLabel = formatDayHeaderDateLabel(date);

  return { weekdayLabel, dateLabel };
}

const MONTH_ABBREV_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
] as const;

export function formatDayHeaderDateLabel(date: Date): string {
  const day = date.getDate();
  const month = MONTH_ABBREV_DE[date.getMonth()] ?? "???";
  return `${day}. ${month}`;
}

export function buildWeekPlanDays(
  shifts: Shift[],
  weekDates: string[],
  displayByShiftId: Record<string, EmployeeWeekShiftDisplayItem>,
  confirmationByShiftId: Record<string, ConfirmationWeekItem>
): WeekPlanDay[] {
  const shiftsByDate = new Map<string, Shift[]>();

  for (const shift of shifts) {
    if (isHiddenFromEmployeeWeekPlan(shift)) continue;
    const bucket = shiftsByDate.get(shift.shift_date) ?? [];
    bucket.push(shift);
    shiftsByDate.set(shift.shift_date, bucket);
  }

  for (const dayShifts of shiftsByDate.values()) {
    dayShifts.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
  }

  return weekDates.map((dateISO) => {
    const { weekdayLabel, dateLabel } = formatDayHeaderParts(dateISO);
    const dayShifts = shiftsByDate.get(dateISO) ?? [];

    return {
      dateISO,
      weekdayLabel,
      dateLabel,
      shifts: dayShifts.map((shift) => ({
        shift,
        display: displayByShiftId[shift.id],
        confirmation: confirmationByShiftId[shift.id],
      })),
    };
  });
}

export function buildWeekPlanRows(
  shifts: Shift[],
  weekDates: string[]
): WeekPlanRow[] {
  const shiftsByDate = new Map<string, Shift[]>();

  for (const shift of shifts) {
    if (isHiddenFromEmployeeWeekPlan(shift)) continue;
    const bucket = shiftsByDate.get(shift.shift_date) ?? [];
    bucket.push(shift);
    shiftsByDate.set(shift.shift_date, bucket);
  }

  for (const dayShifts of shiftsByDate.values()) {
    dayShifts.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
  }

  const rows: WeekPlanRow[] = [];

  for (const dateISO of weekDates) {
    const { weekdayLabel, dateLabel } = formatDayHeaderParts(dateISO);
    rows.push({
      kind: "day-header",
      id: `header-${dateISO}`,
      dateISO,
      weekdayLabel,
      dateLabel,
    });

    const dayShifts = shiftsByDate.get(dateISO) ?? [];
    for (const shift of dayShifts) {
      rows.push({
        kind: "shift",
        id: shift.id,
        shift,
      });
    }
  }

  return rows;
}

export function attachDisplayToWeekPlanRows(
  rows: WeekPlanRow[],
  displayByShiftId: Record<string, EmployeeWeekShiftDisplayItem>
): WeekPlanRow[] {
  return rows.map((row) => {
    if (row.kind !== "shift") return row;
    return {
      ...row,
      display: displayByShiftId[row.shift.id],
    };
  });
}

export function attachConfirmationToWeekPlanRows(
  rows: WeekPlanRow[],
  confirmationByShiftId: Record<string, ConfirmationWeekItem>
): WeekPlanRow[] {
  return rows.map((row) => {
    if (row.kind !== "shift") return row;
    return {
      ...row,
      confirmation: confirmationByShiftId[row.shift.id],
    };
  });
}
