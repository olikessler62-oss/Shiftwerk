import { getISOWeek, parseISODate, startOfWeek, toISODate } from "@/lib/dates";
import { isGermanPublicHoliday } from "@/lib/german-public-holidays";

export type PlanningWeekPickerDayCell = {
  dateISO: string;
  dayNumber: number;
  weekdayShort: string;
  inMonth: boolean;
  isSunday: boolean;
  isHoliday: boolean;
  isToday: boolean;
};

export type PlanningWeekPickerWeekRow = {
  weekStartISO: string;
  calendarWeek: number;
  days: PlanningWeekPickerDayCell[];
};

function weekdayShortLabel(date: Date, locale: "de" | "en"): string {
  const label = date
    .toLocaleDateString(locale === "en" ? "en-GB" : "de-DE", { weekday: "short" })
    .replace(/\.$/, "");
  return locale === "en" ? label : label.slice(0, 2);
}

/** Kalenderwochen-Zeilen für einen Monat (Mo–So, KW in ISO-Wochenlogik). */
export function buildPlanningWeekPickerWeeks(
  year: number,
  month: number,
  todayISO: string,
  locale: "de" | "en" = "de"
): PlanningWeekPickerWeekRow[] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const firstWeekMonday = startOfWeek(firstOfMonth);
  const lastWeekMonday = startOfWeek(lastOfMonth);

  const weeks: PlanningWeekPickerWeekRow[] = [];
  const cursor = new Date(firstWeekMonday);

  while (cursor <= lastWeekMonday) {
    const weekStartISO = toISODate(cursor);
    const days: PlanningWeekPickerDayCell[] = Array.from({ length: 7 }, (_, index) => {
      const dayDate = new Date(cursor);
      dayDate.setDate(cursor.getDate() + index);
      const dateISO = toISODate(dayDate);
      return {
        dateISO,
        dayNumber: dayDate.getDate(),
        weekdayShort: weekdayShortLabel(dayDate, locale),
        inMonth: dayDate.getMonth() === month,
        isSunday: dayDate.getDay() === 0,
        isHoliday: isGermanPublicHoliday(dateISO),
        isToday: dateISO === todayISO,
      };
    });

    weeks.push({
      weekStartISO,
      calendarWeek: getISOWeek(parseISODate(weekStartISO)),
      days,
    });

    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

/** Monatszeile — bei sichtbarem Jahreswechsel im Raster „alt – neu“, sonst Fokus-Monat. */
export function resolvePlanningWeekPickerMonthRangeLabel(
  weeks: readonly PlanningWeekPickerWeekRow[],
  viewMonth: { year: number; month: number },
  intlLocale: string
): string {
  const formatter = new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
  });

  const primaryLabel = formatter.format(
    new Date(viewMonth.year, viewMonth.month, 1)
  );

  if (weeks.length === 0) return primaryLabel;

  const years = new Set<number>();
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const week of weeks) {
    for (const day of week.days) {
      const date = parseISODate(day.dateISO);
      years.add(date.getFullYear());
      const time = date.getTime();
      if (time < minTime) minTime = time;
      if (time > maxTime) maxTime = time;
    }
  }

  if (years.size < 2) {
    return primaryLabel;
  }

  return `${formatter.format(new Date(minTime))} – ${formatter.format(new Date(maxTime))}`;
}
