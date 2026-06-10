import { parseServiceHourTimeToMinutes } from "@schichtwerk/database";
import { capStaffingWindowDuration } from "@/lib/staffing-window-limits";
import type {
  AreaShiftTemplateWithBreaks,
  LocationAreaServiceHour,
  LocationAreaStaffing,
} from "@schichtwerk/types";

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";
const DAY_START_MINUTES = 6 * 60;
const DAY_END_MINUTES = 22 * 60;
const MIN_GAP_MINUTES = 60;
const SERVICE_HOUR_WEEKDAY_COUNT = 8;

export type StaffingCreateWindowSuggestion = {
  weekday: number;
  start_time: string;
  end_time: string;
  templateId: string;
  dayFullyBooked: boolean;
};

type TimeWindow = {
  start_time: string;
  end_time: string;
};

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  const aStart = parseServiceHourTimeToMinutes(timeFieldValue(a.start_time));
  const aEnd = parseServiceHourTimeToMinutes(timeFieldValue(a.end_time));
  const bStart = parseServiceHourTimeToMinutes(timeFieldValue(b.start_time));
  const bEnd = parseServiceHourTimeToMinutes(timeFieldValue(b.end_time));
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) {
    return false;
  }
  return aStart < bEnd && bStart < aEnd;
}

function staffedServiceHourIds(staffing: readonly LocationAreaStaffing[]): Set<string> {
  const ids = new Set<string>();
  for (const rule of staffing) {
    if (rule.required_count > 0) ids.add(rule.service_hour_id);
  }
  return ids;
}

function blockedContextForWeekday(
  weekday: number,
  serviceHours: readonly LocationAreaServiceHour[],
  staffedIds: ReadonlySet<string>
) {
  const windows = serviceHours
    .filter((hour) => hour.weekday === weekday)
    .map((hour) => ({
      start_time: hour.start_time,
      end_time: hour.end_time,
    }));

  const staffedExact = new Set<string>();
  for (const hour of serviceHours) {
    if (hour.weekday !== weekday || !staffedIds.has(hour.id)) continue;
    staffedExact.add(
      `${timeFieldValue(hour.start_time)}|${timeFieldValue(hour.end_time)}`
    );
  }

  return { windows, staffedExact };
}

function isCandidateBlocked(
  candidate: TimeWindow,
  blocked: readonly TimeWindow[],
  staffedExact: ReadonlySet<string>
): boolean {
  const key = `${timeFieldValue(candidate.start_time)}|${timeFieldValue(
    candidate.end_time
  )}`;
  if (staffedExact.has(key)) return true;
  return blocked.some((window) => windowsOverlap(candidate, window));
}

function sortedTemplates(
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[]
): AreaShiftTemplateWithBreaks[] {
  return [...shiftTemplates].sort((a, b) => a.sort_order - b.sort_order);
}

function mergeBlockedWindows(
  blocked: readonly TimeWindow[]
): { start: number; end: number }[] {
  const merged: { start: number; end: number }[] = [];

  for (const window of blocked) {
    const start = parseServiceHourTimeToMinutes(timeFieldValue(window.start_time));
    const end = parseServiceHourTimeToMinutes(timeFieldValue(window.end_time));
    if (start == null || end == null) continue;

    const last = merged[merged.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      merged.push({ start, end });
    }
  }

  merged.sort((a, b) => a.start - b.start);
  return merged;
}

/** Lücken ohne Schichtvorlage: zuerst nach bestehenden Fenstern, zuletzt davor. */
function findGapWithoutTemplate(
  blocked: readonly TimeWindow[]
): { start_time: string; end_time: string } | null {
  const merged = mergeBlockedWindows(blocked);
  if (merged.length === 0) return null;

  const toGap = (gapStart: number, gapEnd: number) =>
    capStaffingWindowDuration(
      minutesToTime(gapStart),
      minutesToTime(gapEnd)
    );

  for (let index = 0; index < merged.length - 1; index++) {
    const gapStart = merged[index]!.end;
    const gapEnd = merged[index + 1]!.start;
    if (gapEnd - gapStart >= MIN_GAP_MINUTES) {
      return toGap(gapStart, gapEnd);
    }
  }

  const lastEnd = merged[merged.length - 1]!.end;
  if (DAY_END_MINUTES - lastEnd >= MIN_GAP_MINUTES) {
    return toGap(lastEnd, DAY_END_MINUTES);
  }

  const firstStart = merged[0]!.start;
  if (firstStart - DAY_START_MINUTES >= MIN_GAP_MINUTES) {
    return toGap(DAY_START_MINUTES, firstStart);
  }

  return null;
}

function emptyDaySuggestion(
  weekday: number,
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[]
): StaffingCreateWindowSuggestion {
  const firstTemplate = sortedTemplates(shiftTemplates)[0];
  if (firstTemplate) {
    return {
      weekday,
      start_time: timeFieldValue(firstTemplate.start_time),
      end_time: timeFieldValue(firstTemplate.end_time),
      templateId: firstTemplate.id,
      dayFullyBooked: false,
    };
  }
  return {
    weekday,
    start_time: DEFAULT_START,
    end_time: DEFAULT_END,
    templateId: "",
    dayFullyBooked: false,
  };
}

function suggestForWeekday(
  weekday: number,
  serviceHours: readonly LocationAreaServiceHour[],
  staffing: readonly LocationAreaStaffing[],
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[]
): StaffingCreateWindowSuggestion | null {
  const staffedIds = staffedServiceHourIds(staffing);
  const { windows, staffedExact } = blockedContextForWeekday(
    weekday,
    serviceHours,
    staffedIds
  );

  if (windows.length === 0) {
    return emptyDaySuggestion(weekday, shiftTemplates);
  }

  for (const template of sortedTemplates(shiftTemplates)) {
    const candidate: TimeWindow = {
      start_time: timeFieldValue(template.start_time),
      end_time: timeFieldValue(template.end_time),
    };
    if (!isCandidateBlocked(candidate, windows, staffedExact)) {
      return {
        weekday,
        start_time: candidate.start_time,
        end_time: candidate.end_time,
        templateId: template.id,
        dayFullyBooked: false,
      };
    }
  }

  const gap = findGapWithoutTemplate(windows);
  if (gap) {
    return {
      weekday,
      start_time: gap.start_time,
      end_time: gap.end_time,
      templateId: "",
      dayFullyBooked: false,
    };
  }

  return null;
}

export function isShiftTemplateBlockedOnWeekday(
  template: Pick<AreaShiftTemplateWithBreaks, "start_time" | "end_time">,
  weekday: number,
  serviceHours: readonly LocationAreaServiceHour[],
  staffing: readonly LocationAreaStaffing[]
): boolean {
  const staffedIds = staffedServiceHourIds(staffing);
  const { windows, staffedExact } = blockedContextForWeekday(
    weekday,
    serviceHours,
    staffedIds
  );
  return isCandidateBlocked(
    {
      start_time: timeFieldValue(template.start_time),
      end_time: timeFieldValue(template.end_time),
    },
    windows,
    staffedExact
  );
}

export function suggestStaffingCreateWindow(
  serviceHours: readonly LocationAreaServiceHour[],
  staffing: readonly LocationAreaStaffing[],
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[],
  options?: { weekday?: number; searchAllWeekdays?: boolean }
): StaffingCreateWindowSuggestion {
  const weekdays =
    options?.searchAllWeekdays === false && options.weekday !== undefined
      ? [options.weekday]
      : options?.weekday !== undefined
        ? [
            options.weekday,
            ...Array.from({ length: SERVICE_HOUR_WEEKDAY_COUNT }, (_, index) => index).filter(
              (day) => day !== options.weekday
            ),
          ]
        : Array.from({ length: SERVICE_HOUR_WEEKDAY_COUNT }, (_, index) => index);

  for (const weekday of weekdays) {
    const suggestion = suggestForWeekday(
      weekday,
      serviceHours,
      staffing,
      shiftTemplates
    );
    if (suggestion) return suggestion;
  }

  const fallbackWeekday = options?.weekday ?? 0;
  return {
    weekday: fallbackWeekday,
    start_time: DEFAULT_START,
    end_time: DEFAULT_END,
    templateId: "",
    dayFullyBooked: true,
  };
}
