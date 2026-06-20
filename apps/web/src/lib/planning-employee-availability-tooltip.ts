import { sortProfileRecurringAvailabilityBySchedule } from "@schichtwerk/database";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";

import {
  formatAvailabilityTimeRange,
  weekdayAbbrev,
} from "@/lib/profile-availability-label";

export type PlanningEmployeeAvailabilityTooltipRow = {
  weekday: string;
  timeRange: string;
};

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
  return sortProfileRecurringAvailabilityBySchedule(slots).map((item) => ({
    weekday: `${weekdayAbbrev(item.weekday, locale)}:`,
    timeRange: formatAvailabilityTimeRange(
      item.start_time,
      item.end_time,
      locale
    ),
  }));
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
