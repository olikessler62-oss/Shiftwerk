import type { AreaShiftTemplateWithBreaks, LocationAreaServiceHour } from "@schichtwerk/types";
import {
  weekdayAbbrevFromIndex,
  weekdayAbbrevFromTranslatedName,
  type WeekdayLabelLocale,
} from "@schichtwerk/i18n";
import { resolvePresetIdFromTimes } from "@/lib/areacalendar-assignment-presets";

export const SERVICE_HOUR_WEEKDAY_COUNT = 8;

/** Mo=0 … So=6, Feiertage=7 */
export const SERVICE_HOUR_WEEKDAY_PRESETS = {
  monFri: [0, 1, 2, 3, 4],
  monSat: [0, 1, 2, 3, 4, 5],
  monSun: [0, 1, 2, 3, 4, 5, 6],
  satSun: [5, 6],
  all: [0, 1, 2, 3, 4, 5, 6, 7],
} as const;

export type ServiceHourWeekdayPresetKey = keyof typeof SERVICE_HOUR_WEEKDAY_PRESETS;

export type ServiceHourEntry = {
  id: string;
  weekdays: Set<number>;
  templateId: string;
  start_time: string;
  end_time: string;
};

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";
const MINUTES_PER_DAY = 24 * 60;
const LATE_EVENING_START_MINUTES = 23 * 60;
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

function timeToInput(value: string): string {
  const parts = value.trim().split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = (parts[1] ?? "00").padStart(2, "0").slice(0, 2);
  return `${h}:${m}`;
}

function parseTimeToMinutes(time: string): number | null {
  const trimmed = timeToInput(time);
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  const [h, m] = trimmed.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToTimeInput(minutes: number): string {
  const dayMinutes =
    ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(dayMinutes / 60);
  const m = dayMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function endTimeAbsoluteMinutes(start_time: string, end_time: string): number {
  const startMin = parseTimeToMinutes(start_time);
  const endMin = parseTimeToMinutes(end_time);
  if (startMin == null || endMin == null) return -1;
  if (endMin > startMin) return endMin;
  return endMin + MINUTES_PER_DAY;
}

function suggestEndMinutesFromStart(vonMin: number): number {
  if (vonMin === LAST_MINUTE_OF_DAY) {
    return 60;
  }
  if (vonMin >= LATE_EVENING_START_MINUTES) {
    return vonMin + 1;
  }
  return vonMin + 60;
}

export function suggestNextServiceHourEntryTimes(
  existing: readonly Pick<ServiceHourEntry, "start_time" | "end_time">[]
): { start_time: string; end_time: string } {
  if (existing.length === 0) {
    return { start_time: DEFAULT_START, end_time: DEFAULT_END };
  }

  let latestEnd = -1;
  let latestEndTime = DEFAULT_START;
  for (const entry of existing) {
    const absoluteEnd = endTimeAbsoluteMinutes(entry.start_time, entry.end_time);
    if (absoluteEnd > latestEnd) {
      latestEnd = absoluteEnd;
      latestEndTime = timeToInput(entry.end_time);
    }
  }

  const vonMin = parseTimeToMinutes(latestEndTime);
  if (vonMin == null) {
    return { start_time: DEFAULT_START, end_time: DEFAULT_END };
  }

  const bisMin = suggestEndMinutesFromStart(vonMin);
  return {
    start_time: minutesToTimeInput(vonMin),
    end_time: minutesToTimeInput(bisMin),
  };
}

export function createDefaultServiceHourEntry(
  existing: readonly Pick<ServiceHourEntry, "start_time" | "end_time">[] = []
): ServiceHourEntry {
  const times = suggestNextServiceHourEntryTimes(existing);
  return {
    id: crypto.randomUUID(),
    weekdays: new Set<number>(),
    templateId: "",
    start_time: times.start_time,
    end_time: times.end_time,
  };
}

export function buildServiceHourEntriesFromHours(
  hours: LocationAreaServiceHour[],
  templates: readonly AreaShiftTemplateWithBreaks[] = []
): ServiceHourEntry[] {
  if (hours.length === 0) {
    return [createDefaultServiceHourEntry()];
  }

  const grouped = new Map<string, ServiceHourEntry>();

  for (const hour of hours) {
    const start_time = timeToInput(hour.start_time);
    const end_time = timeToInput(hour.end_time);
    const key = `${start_time}|${end_time}`;
    let entry = grouped.get(key);
    if (!entry) {
      const templateId =
        resolvePresetIdFromTimes(start_time, end_time, templates) ?? "";
      entry = {
        id: crypto.randomUUID(),
        weekdays: new Set<number>(),
        templateId,
        start_time,
        end_time,
      };
      grouped.set(key, entry);
    }
    entry.weekdays.add(hour.weekday);
  }

  return [...grouped.values()].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );
}

export function buildServiceHourPayloadFromEntries(
  entries: ServiceHourEntry[]
): { weekday: number; start_time: string; end_time: string }[] {
  return entries.flatMap((entry) =>
    [...entry.weekdays].map((weekday) => ({
      weekday,
      start_time: entry.start_time,
      end_time: entry.end_time,
    }))
  );
}

export function buildHoursFromEntries(
  areaId: string,
  entries: ServiceHourEntry[]
): LocationAreaServiceHour[] {
  return entries.flatMap((entry) =>
    [...entry.weekdays].map((weekday) => ({
      id: crypto.randomUUID(),
      location_area_id: areaId,
      weekday,
      start_time: timeToInput(entry.start_time) + ":00",
      end_time: timeToInput(entry.end_time) + ":00",
    }))
  );
}

export function weekdayChipLabel(
  weekday: number,
  t: (key: string) => string,
  locale: WeekdayLabelLocale = "de"
): string {
  if (weekday === 7) return "FT";
  if (locale === "en") return weekdayAbbrevFromIndex(weekday, "en");
  const keys = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ] as const;
  const key = keys[weekday];
  if (!key) return String(weekday);
  return weekdayAbbrevFromTranslatedName(t(`locations.weekdays.${key}`), "de");
}

export function weekdayChipTooltipLabel(
  weekday: number,
  t: (key: string) => string
): string {
  if (weekday === 7) return t("locations.weekdays.holidayPlural");
  const keys = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ] as const;
  const key = keys[weekday];
  if (!key) return String(weekday);
  return t(`locations.weekdays.${key}`);
}
