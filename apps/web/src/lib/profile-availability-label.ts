import {
  isOvernightAvailability,
  sortProfileRecurringAvailabilityBySchedule,
  sortProfileShiftPreferencesBySchedule,
} from "@schichtwerk/database";
import {
  weekdayAbbrevFromIndex,
  type WeekdayLabelLocale,
} from "@schichtwerk/i18n";
import type {
  ProfileRecurringAvailability,
  ProfileShiftPreference,
} from "@schichtwerk/types";
import { formatTime } from "@/lib/planning-utils";

export const PROFILE_AVAILABILITY_HOLIDAY_WEEKDAY = 7;

const WEEKDAY_LONG = {
  de: [
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
    "Sonntag",
  ],
  en: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],
} as const;

const HOLIDAY_ABBREV = "FT";
const HOLIDAY_LONG = {
  de: "Feiertag",
  en: "Public holiday",
} as const;

export type WeekdayLabelStyle = "short" | "long";
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

export function weekdayLabel(
  weekday: number,
  locale: WeekdayLabelLocale,
  style: WeekdayLabelStyle = "short"
): string {
  if (weekday === PROFILE_AVAILABILITY_HOLIDAY_WEEKDAY) {
    return style === "long" ? HOLIDAY_LONG[locale] : HOLIDAY_ABBREV;
  }
  if (style === "short") {
    return weekdayAbbrevFromIndex(weekday, locale);
  }
  return WEEKDAY_LONG[locale][weekday] ?? "?";
}

export function weekdayAbbrev(weekday: number, locale: WeekdayLabelLocale): string {
  return weekdayLabel(weekday, locale, "short");
}

/** z. B. Montag 22:00 bis Dienstag 06:00 (über Mitternacht). */
export function formatOvernightAvailabilitySpan(
  weekday: number,
  start_time: string,
  end_time: string,
  locale: "de" | "en" = "de"
): string {
  const startDay = weekdayLabel(weekday, locale, "long");
  const endDay = weekdayLabel((weekday + 1) % 7, locale, "long");
  const start = formatTime(start_time);
  const end = formatTime(end_time);
  if (locale === "en") {
    return `${startDay} ${start} to ${endDay} ${end}`;
  }
  return `${startDay} ${start} bis ${endDay} ${end}`;
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
  return `${day} ${formatAvailabilityTimeRange(item.start_time, item.end_time, locale)}`;
}

export function formatProfileAvailabilitySummaryLabels(
  items: readonly ProfileRecurringAvailability[],
  locale: "de" | "en" = "de"
): string[] {
  return sortProfileRecurringAvailabilityBySchedule(items).map((item) =>
    formatProfileAvailabilitySummaryLabel(item, locale)
  );
}

export function formatProfileShiftPreferenceSummaryLabel(
  item: ProfileShiftPreference,
  locale: "de" | "en" = "de",
  emptyTimeLabel = "—"
): string {
  if (
    item.weekday == null ||
    item.start_time == null ||
    item.end_time == null
  ) {
    return emptyTimeLabel;
  }
  const day = `${weekdayAbbrev(item.weekday, locale)}:`;
  return `${day} ${formatAvailabilityTimeRange(item.start_time, item.end_time, locale)}`;
}

export function formatProfileShiftPreferenceSummaryLabels(
  items: readonly ProfileShiftPreference[],
  locale: "de" | "en" = "de"
): string[] {
  return sortProfileShiftPreferencesBySchedule(items).map((item) =>
    formatProfileShiftPreferenceSummaryLabel(item, locale)
  );
}
