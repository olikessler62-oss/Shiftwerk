import type { AreaShiftTemplateWithBreaks, LocationAreaServiceHour } from "@schichtwerk/types";
import { resolvePresetIdFromTimes } from "@/lib/dashboard-assignment-presets";

export const SERVICE_HOUR_WEEKDAY_COUNT = 8;

export type ServiceHourEntry = {
  id: string;
  weekdays: Set<number>;
  templateId: string;
  start_time: string;
  end_time: string;
};

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

function timeToInput(value: string): string {
  const parts = value.trim().split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = (parts[1] ?? "00").padStart(2, "0").slice(0, 2);
  return `${h}:${m}`;
}

export function createDefaultServiceHourEntry(): ServiceHourEntry {
  return {
    id: crypto.randomUUID(),
    weekdays: new Set<number>(),
    templateId: "",
    start_time: DEFAULT_START,
    end_time: DEFAULT_END,
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

export function weekdayChipLabel(weekday: number, t: (key: string) => string): string {
  if (weekday === 7) return "FT";
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
  return t(`locations.weekdays.${key}`).slice(0, 2);
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
