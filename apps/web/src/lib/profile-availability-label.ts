import { isOvernightAvailability } from "@schichtwerk/database";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";
import { formatTime } from "@/lib/planning-utils";

export const PROFILE_AVAILABILITY_HOLIDAY_WEEKDAY = 7;

const WEEKDAY_ABBREVS = {
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
} as const;

const HOLIDAY_ABBREV = "FT";
const SHIFT_SUFFIX = "schicht";

/** z. B. Frühschicht → Früh, Spätschicht → Spät */
export function shortenShiftTypeDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (trimmed.toLowerCase().endsWith(SHIFT_SUFFIX)) {
    return trimmed.slice(0, -SHIFT_SUFFIX.length);
  }
  return trimmed;
}

/** Anzeige mit angehängtem „schicht“, z. B. Früh → Frühschicht */
export function shiftTypeNameWithSchicht(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (trimmed.toLowerCase().endsWith(SHIFT_SUFFIX)) return trimmed;
  return `${shortenShiftTypeDisplayName(trimmed)}${SHIFT_SUFFIX}`;
}

function weekdayAbbrev(weekday: number, locale: "de" | "en"): string {
  if (weekday === PROFILE_AVAILABILITY_HOLIDAY_WEEKDAY) return HOLIDAY_ABBREV;
  return WEEKDAY_ABBREVS[locale][weekday] ?? "?";
}

/** z. B. 08:00 – 17:00 oder 22:00 – 06:00 (+1) */
export function formatAvailabilityTimeRange(
  start_time: string,
  end_time: string,
  locale: "de" | "en" = "de"
): string {
  const start = formatTime(start_time);
  const end = formatTime(end_time);
  if (!isOvernightAvailability(start_time, end_time)) {
    return `${start} – ${end}`;
  }
  const suffix = locale === "en" ? " (+1 day)" : " (+1)";
  return `${start} – ${end}${suffix}`;
}

export function formatProfileAvailabilitySummaryLabel(
  item: ProfileRecurringAvailability,
  locale: "de" | "en" = "de"
): string {
  const day = `${weekdayAbbrev(item.weekday, locale)}:`;
  if (item.shift_type_id) {
    const name = item.shift_type_name?.trim();
    if (name) return `${day} ${shortenShiftTypeDisplayName(name)}`;
  }
  return `${day} ${formatAvailabilityTimeRange(item.start_time, item.end_time, locale)}`;
}

export function formatProfileAvailabilitySummaryLabels(
  items: readonly ProfileRecurringAvailability[],
  locale: "de" | "en" = "de"
): string[] {
  return items.map((item) =>
    formatProfileAvailabilitySummaryLabel(item, locale)
  );
}
