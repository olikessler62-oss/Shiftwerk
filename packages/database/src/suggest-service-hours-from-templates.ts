import type { AreaPlanningMode } from "./area-planning-mode";
import { timeToMinutes } from "./profile-availability-validation";

export type TemplateTimeRef = {
  start_time: string;
  end_time: string;
};

export type SuggestedServiceHourSlot = {
  weekday: number;
  start_time: string;
  end_time: string;
};

export type SuggestServiceHoursFromTemplatesInput = {
  templates: TemplateTimeRef[];
  planningMode: AreaPlanningMode;
  existingServiceHours: { weekday: number }[];
};

/** Mo–Fr, wenn noch keine Servicezeiten hinterlegt sind */
const DEFAULT_EMPTY_WEEKDAYS = [0, 1, 2, 3, 4];

function formatTimeHHMM(raw: string): string {
  const parts = raw.trim().split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = (parts[1] ?? "00").padStart(2, "0").slice(0, 2);
  return `${h}:${m}`;
}

function minutesToTimeHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function sortTemplatesByStart(templates: TemplateTimeRef[]): TemplateTimeRef[] {
  return [...templates].sort((a, b) =>
    formatTimeHHMM(a.start_time).localeCompare(formatTimeHHMM(b.start_time))
  );
}

export function resolveTargetWeekdaysForServiceHourSuggestion(
  existingServiceHours: { weekday: number }[]
): number[] {
  const fromHours = [
    ...new Set(
      existingServiceHours
        .map((hour) => hour.weekday)
        .filter((weekday) => weekday >= 0 && weekday <= 7)
    ),
  ].sort((a, b) => a - b);
  if (fromHours.length > 0) return fromHours;
  return [...DEFAULT_EMPTY_WEEKDAYS];
}

function templateSlotsForPlanningMode(
  templates: TemplateTimeRef[],
  planningMode: AreaPlanningMode
): { start_time: string; end_time: string }[] {
  const sorted = sortTemplatesByStart(templates);
  if (sorted.length === 0) return [];

  if (planningMode === "simple") {
    let minStart = timeToMinutes(sorted[0]!.start_time);
    let maxEnd = timeToMinutes(sorted[0]!.end_time);
    for (const template of sorted) {
      minStart = Math.min(minStart, timeToMinutes(template.start_time));
      maxEnd = Math.max(maxEnd, timeToMinutes(template.end_time));
    }
    return [
      {
        start_time: minutesToTimeHHMM(minStart),
        end_time: minutesToTimeHHMM(maxEnd),
      },
    ];
  }

  const seen = new Set<string>();
  const slots: { start_time: string; end_time: string }[] = [];
  for (const template of sorted) {
    const start_time = formatTimeHHMM(template.start_time);
    const end_time = formatTimeHHMM(template.end_time);
    const key = `${start_time}|${end_time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ start_time, end_time });
  }
  return slots;
}

export function suggestServiceHoursFromTemplates(
  input: SuggestServiceHoursFromTemplatesInput
): SuggestedServiceHourSlot[] {
  const { templates, planningMode, existingServiceHours } = input;
  if (templates.length === 0) return [];

  const weekdays = resolveTargetWeekdaysForServiceHourSuggestion(
    existingServiceHours
  );
  const slots = templateSlotsForPlanningMode(templates, planningMode);

  return weekdays.flatMap((weekday) =>
    slots.map((slot) => ({
      weekday,
      start_time: slot.start_time,
      end_time: slot.end_time,
    }))
  );
}

/** Eindeutige Zeitfenster für die Vorschau (ohne Wochentag-Duplikate). */
export function uniqueSuggestedServiceHourSlots(
  rows: SuggestedServiceHourSlot[]
): { start_time: string; end_time: string }[] {
  const seen = new Set<string>();
  const slots: { start_time: string; end_time: string }[] = [];
  for (const row of rows) {
    const key = `${row.start_time}|${row.end_time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ start_time: row.start_time, end_time: row.end_time });
  }
  return slots;
}

export function hasConfiguredServiceHours(
  hours: { weekday: number }[]
): boolean {
  return hours.length > 0;
}

export function shouldOfferServiceHoursFromTemplates(input: {
  previousMode: AreaPlanningMode;
  newMode: AreaPlanningMode;
  templates: TemplateTimeRef[];
}): boolean {
  return (
    input.previousMode !== input.newMode && input.templates.length > 0
  );
}
