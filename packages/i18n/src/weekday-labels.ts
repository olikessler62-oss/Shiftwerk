/** Mo=0 … So=6 */
export const ENGLISH_WEEKDAY_ABBREVS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export const GERMAN_WEEKDAY_ABBREVS = [
  "Mo.",
  "Di.",
  "Mi.",
  "Do.",
  "Fr.",
  "Sa.",
  "So.",
] as const;

export type WeekdayLabelLocale = "de" | "en";

const ENGLISH_WEEKDAY_INDEX: Record<string, number> = {
  mon: 0,
  monday: 0,
  tue: 1,
  tues: 1,
  tuesday: 1,
  wed: 2,
  weds: 2,
  wednesday: 2,
  thu: 3,
  thur: 3,
  thurs: 3,
  thursday: 3,
  fri: 4,
  friday: 4,
  sat: 5,
  saturday: 5,
  sun: 6,
  sunday: 6,
};

const GERMAN_WEEKDAY_INDEX: Record<string, number> = {
  mo: 0,
  montag: 0,
  di: 1,
  dienstag: 1,
  mi: 2,
  mittwoch: 2,
  do: 3,
  donnerstag: 3,
  fr: 4,
  freitag: 4,
  sa: 5,
  samstag: 5,
  sonnabend: 5,
  so: 6,
  sonntag: 6,
};

/** Englische Kurzform: drei Buchstaben, erster groß (Eingabe case-insensitive). */
export function formatEnglishWeekdayAbbrev(value: string): string {
  const normalized = value.trim().replace(/\./g, "").toLowerCase();
  const index = ENGLISH_WEEKDAY_INDEX[normalized];
  if (index !== undefined) {
    return ENGLISH_WEEKDAY_ABBREVS[index]!;
  }

  const letters = normalized.replace(/[^a-z]/g, "");
  if (letters.length >= 1) {
    const head = letters.slice(0, 3);
    return head.charAt(0).toUpperCase() + head.slice(1);
  }

  return value.trim();
}

/** Deutsche Kurzform: zwei Buchstaben + Punkt, erster groß (Eingabe case-insensitive). */
export function formatGermanWeekdayAbbrev(value: string): string {
  const normalized = value.trim().replace(/\./g, "").toLowerCase();
  const index = GERMAN_WEEKDAY_INDEX[normalized];
  if (index !== undefined) {
    return GERMAN_WEEKDAY_ABBREVS[index]!;
  }

  const letters = normalized.replace(/[^a-zäöüß]/gi, "");
  if (letters.length >= 2) {
    const head = letters.slice(0, 2);
    return `${head.charAt(0).toUpperCase()}${head.slice(1).toLowerCase()}.`;
  }
  if (letters.length === 1) {
    return `${letters.charAt(0).toUpperCase()}.`;
  }

  return value.trim();
}

export function weekdayAbbrevFromIndex(
  weekday: number,
  locale: WeekdayLabelLocale = "de"
): string {
  if (weekday < 0 || weekday > 6) return "?";
  return locale === "en"
    ? ENGLISH_WEEKDAY_ABBREVS[weekday]!
    : GERMAN_WEEKDAY_ABBREVS[weekday]!;
}

/** Abkürzung aus übersetztem Vollnamen (DE: 2 Zeichen + Punkt, EN: 3 Zeichen Title Case). */
export function weekdayAbbrevFromTranslatedName(
  fullName: string,
  locale: WeekdayLabelLocale
): string {
  if (locale === "en") return formatEnglishWeekdayAbbrev(fullName);
  return formatGermanWeekdayAbbrev(fullName);
}

export function isEnglishIntlLocale(intlLocale: string): boolean {
  return intlLocale.toLowerCase().startsWith("en");
}

export function isGermanIntlLocale(intlLocale: string): boolean {
  return intlLocale.toLowerCase().startsWith("de");
}
