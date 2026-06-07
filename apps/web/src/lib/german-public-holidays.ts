import { parseISODate, toISODate } from "./dates";

type HolidayLabel = { de: string; en: string };

const FIXED_HOLIDAYS: Record<string, HolidayLabel> = {
  "01-01": { de: "Neujahr", en: "New Year's Day" },
  "05-01": { de: "Tag der Arbeit", en: "Labour Day" },
  "10-03": { de: "Tag der Deutschen Einheit", en: "German Unity Day" },
  "12-25": { de: "1. Weihnachtstag", en: "Christmas Day" },
  "12-26": { de: "2. Weihnachtstag", en: "Second Christmas Day" },
};

const MOVABLE_OFFSETS: { offset: number; label: HolidayLabel }[] = [
  { offset: -2, label: { de: "Karfreitag", en: "Good Friday" } },
  { offset: 1, label: { de: "Ostermontag", en: "Easter Monday" } },
  { offset: 39, label: { de: "Christi Himmelfahrt", en: "Ascension Day" } },
  { offset: 50, label: { de: "Pfingstmontag", en: "Whit Monday" } },
];

const yearCache = new Map<number, Map<string, HolidayLabel>>();

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function shiftIsoDate(isoDate: string, days: number): string {
  const date = parseISODate(isoDate);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function holidaysForYear(year: number): Map<string, HolidayLabel> {
  const map = new Map<string, HolidayLabel>();
  for (const [monthDay, label] of Object.entries(FIXED_HOLIDAYS)) {
    map.set(`${year}-${monthDay}`, label);
  }
  const easter = toISODate(easterSunday(year));
  for (const { offset, label } of MOVABLE_OFFSETS) {
    map.set(shiftIsoDate(easter, offset), label);
  }
  return map;
}

function holidayLabelForDate(
  isoDate: string,
  locale: "de" | "en"
): string | null {
  const year = Number.parseInt(isoDate.slice(0, 4), 10);
  let yearMap = yearCache.get(year);
  if (!yearMap) {
    yearMap = holidaysForYear(year);
    yearCache.set(year, yearMap);
  }
  const label = yearMap.get(isoDate);
  return label ? label[locale] : null;
}

/** Bundesweite gesetzliche Feiertage in Deutschland. */
export function getGermanPublicHolidayName(
  isoDate: string,
  locale: "de" | "en" = "de"
): string | null {
  return holidayLabelForDate(isoDate, locale);
}

export function isGermanPublicHoliday(isoDate: string): boolean {
  return holidayLabelForDate(isoDate, "de") !== null;
}

export function buildHolidayNamesByDate(
  dates: string[],
  locale: "de" | "en" = "de"
): Record<string, string> {
  const names: Record<string, string> = {};
  for (const date of dates) {
    const name = holidayLabelForDate(date, locale);
    if (name) names[date] = name;
  }
  return names;
}
