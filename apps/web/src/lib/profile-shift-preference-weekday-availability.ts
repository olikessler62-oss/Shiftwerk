import { sortProfileRecurringAvailabilityBySchedule } from "@schichtwerk/database";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";

export function groupProfileAvailabilityByWeekday(
  availability: readonly ProfileRecurringAvailability[]
): Map<number, ProfileRecurringAvailability[]> {
  const map = new Map<number, ProfileRecurringAvailability[]>();
  for (const slot of sortProfileRecurringAvailabilityBySchedule(availability)) {
    const list = map.get(slot.weekday) ?? [];
    list.push(slot);
    map.set(slot.weekday, list);
  }
  return map;
}

export function weekdaysWithProfileAvailability(
  availability: readonly ProfileRecurringAvailability[],
  weekdayCount: number
): Set<number> {
  const byWeekday = groupProfileAvailabilityByWeekday(availability);
  const result = new Set<number>();
  for (let weekday = 0; weekday < weekdayCount; weekday += 1) {
    if ((byWeekday.get(weekday)?.length ?? 0) > 0) {
      result.add(weekday);
    }
  }
  return result;
}

export function filterWeekdaysWithProfileAvailability(
  weekdays: readonly number[],
  availability: readonly ProfileRecurringAvailability[],
  weekdayCount: number
): number[] {
  const allowed = weekdaysWithProfileAvailability(availability, weekdayCount);
  return weekdays.filter((weekday) => allowed.has(weekday));
}
