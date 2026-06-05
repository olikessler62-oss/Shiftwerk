/** Mo=0 … So=6, 7 Zeichen aus '0' und '1'. */
export const ACTIVE_WEEKDAYS_LENGTH = 7;

export type WeekdayAbbrevLocale = "de" | "en";

const WEEKDAY_ABBREVS: Record<WeekdayAbbrevLocale, readonly string[]> = {
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

export function isValidActiveWeekdays(mask: string): boolean {
  return (
    mask.length === ACTIVE_WEEKDAYS_LENGTH && /^[01]{7}$/.test(mask)
  );
}

export function activeWeekdaysToBooleans(mask: string): boolean[] {
  if (!isValidActiveWeekdays(mask)) {
    return [true, true, true, true, true, false, false];
  }
  return mask.split("").map((c) => c === "1");
}

export function booleansToActiveWeekdays(days: boolean[]): string {
  const padded = [...days];
  while (padded.length < ACTIVE_WEEKDAYS_LENGTH) padded.push(false);
  return padded
    .slice(0, ACTIVE_WEEKDAYS_LENGTH)
    .map((on) => (on ? "1" : "0"))
    .join("");
}

export function formatActiveWeekdaysLabel(
  mask: string,
  locale: WeekdayAbbrevLocale = "de"
): string {
  if (!isValidActiveWeekdays(mask)) return "—";
  const abbrevs = WEEKDAY_ABBREVS[locale];
  const parts: string[] = [];
  for (let i = 0; i < ACTIVE_WEEKDAYS_LENGTH; i++) {
    if (mask[i] === "1") parts.push(abbrevs[i]);
  }
  return parts.length > 0 ? parts.join(",") : "—";
}

/** Arbeitstage-Anzeige; bei Feiertags-Flag wird holidaySuffix angehängt (z. B. „Mo, Di, Feiertage“). */
export function formatLocationOpenDaysLabel(
  mask: string,
  onHolidayOpen: boolean,
  holidaySuffix: string,
  locale: WeekdayAbbrevLocale = "de"
): string {
  const parts: string[] = [];
  if (isValidActiveWeekdays(mask)) {
    const abbrevs = WEEKDAY_ABBREVS[locale];
    for (let i = 0; i < ACTIVE_WEEKDAYS_LENGTH; i++) {
      if (mask[i] === "1") parts.push(abbrevs[i]);
    }
  }
  if (onHolidayOpen) parts.push(holidaySuffix);
  return parts.length > 0 ? parts.join(", ") : "—";
}

export function validateActiveWeekdaysField(
  mask: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (!isValidActiveWeekdays(mask)) {
    return {
      ok: false,
      error: "Arbeitstage müssen eine 7-stellige Bitmaske aus 0 und 1 sein.",
    };
  }
  if (!mask.includes("1")) {
    return {
      ok: false,
      error: "Mindestens ein Arbeitstag muss ausgewählt sein.",
    };
  }
  return { ok: true, value: mask };
}
