import { sortProfileRecurringAvailabilityBySchedule } from "@schichtwerk/database";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";

import {
  formatAvailabilityTimeRange,
  PROFILE_AVAILABILITY_HOLIDAY_WEEKDAY,
  weekdayAbbrev,
} from "@/lib/profile-availability-label";
import { formatTime } from "@/lib/planning-utils";

export type PlanningEmployeeAvailabilityTooltipRow = {
  weekday: string;
  timeRange: string;
};

function availabilityTimeKey(startTime: string, endTime: string): string {
  return `${formatTime(startTime)}|${formatTime(endTime)}`;
}

function weekdayAbbrevCompact(
  weekday: number,
  locale: "de" | "en"
): string {
  const abbrev = weekdayAbbrev(weekday, locale);
  if (weekday === PROFILE_AVAILABILITY_HOLIDAY_WEEKDAY) {
    return abbrev;
  }
  return abbrev.replace(/\.$/, "");
}

export function formatAvailabilityWeekdayRangeLabel(
  startWeekday: number,
  endWeekday: number,
  locale: "de" | "en"
): string {
  if (startWeekday === endWeekday) {
    return weekdayAbbrevCompact(startWeekday, locale);
  }
  return `${weekdayAbbrevCompact(startWeekday, locale)}-${weekdayAbbrevCompact(endWeekday, locale)}`;
}

function buildConsecutiveWeekdayRuns(
  weekdays: readonly number[]
): { start: number; end: number }[] {
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const runs: { start: number; end: number }[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let index = 1; index < sorted.length; index += 1) {
    const weekday = sorted[index];
    if (weekday === previous + 1) {
      previous = weekday;
      continue;
    }
    runs.push({ start, end: previous });
    start = weekday;
    previous = weekday;
  }

  runs.push({ start, end: previous });
  return runs;
}

function buildGroupedAvailabilityTooltipRows(
  slots: readonly ProfileRecurringAvailability[],
  locale: "de" | "en"
): PlanningEmployeeAvailabilityTooltipRow[] {
  const byTime = new Map<
    string,
    { startTime: string; endTime: string; weekdays: number[] }
  >();

  for (const slot of slots) {
    const key = availabilityTimeKey(slot.start_time, slot.end_time);
    const entry = byTime.get(key) ?? {
      startTime: slot.start_time,
      endTime: slot.end_time,
      weekdays: [],
    };
    entry.weekdays.push(slot.weekday);
    byTime.set(key, entry);
  }

  const groups = [...byTime.values()].sort((left, right) => {
    const leftMin = Math.min(...left.weekdays);
    const rightMin = Math.min(...right.weekdays);
    return leftMin - rightMin;
  });

  const rows: PlanningEmployeeAvailabilityTooltipRow[] = [];

  for (const group of groups) {
    const timeRange = formatAvailabilityTimeRange(
      group.startTime,
      group.endTime,
      locale
    );
    const runs = buildConsecutiveWeekdayRuns(group.weekdays);

    for (const run of runs) {
      rows.push({
        weekday: formatAvailabilityWeekdayRangeLabel(
          run.start,
          run.end,
          locale
        ),
        timeRange,
      });
    }
  }

  return rows;
}

export function groupRecurringAvailabilityByProfileId(
  availability: readonly ProfileRecurringAvailability[]
): ReadonlyMap<string, ProfileRecurringAvailability[]> {
  const grouped = new Map<string, ProfileRecurringAvailability[]>();
  for (const slot of availability) {
    const list = grouped.get(slot.profile_id) ?? [];
    list.push(slot);
    grouped.set(slot.profile_id, list);
  }
  return grouped;
}

export function buildPlanningEmployeeAvailabilityTooltipRows(
  slots: readonly ProfileRecurringAvailability[],
  locale: "de" | "en"
): PlanningEmployeeAvailabilityTooltipRow[] {
  const sorted = sortProfileRecurringAvailabilityBySchedule(slots);
  return buildGroupedAvailabilityTooltipRows(sorted, locale);
}

export function resolvePlanningEmployeeJobsTooltipLabel(
  employeeId: string,
  profileQualificationIds: Record<string, string[]>,
  qualificationNameById: ReadonlyMap<string, string>,
  qualificationSortOrder: ReadonlyMap<string, number>
): string {
  const ids = profileQualificationIds[employeeId] ?? [];
  return ids
    .slice()
    .sort(
      (a, b) =>
        (qualificationSortOrder.get(a) ?? 0) -
          (qualificationSortOrder.get(b) ?? 0) ||
        (qualificationNameById.get(a) ?? "").localeCompare(
          qualificationNameById.get(b) ?? "",
          "de"
        )
    )
    .map((id) => qualificationNameById.get(id))
    .filter((name): name is string => Boolean(name?.trim()))
    .join(", ");
}

export function resolvePlanningEmployeeJobsTooltipLabelFromMap(
  employeeId: string,
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>,
  qualificationNameById: ReadonlyMap<string, string>,
  qualificationSortOrder: ReadonlyMap<string, number>
): string {
  const record: Record<string, string[]> = {};
  profileQualificationIds.forEach((qualificationIds, profileId) => {
    record[profileId] = [...qualificationIds];
  });
  return resolvePlanningEmployeeJobsTooltipLabel(
    employeeId,
    record,
    qualificationNameById,
    qualificationSortOrder
  );
}
