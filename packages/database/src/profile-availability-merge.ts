import {
  isOvernightAvailability,
  sortProfileRecurringAvailabilityBySchedule,
  timeToMinutes,
} from "./profile-availability-validation";

export type ProfileAvailabilityMergeSlot = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

export type ProfileAvailabilityMergePlan = {
  keepId: string;
  deleteIds: string[];
  weekday: number;
  start_time: string;
  end_time: string;
};

export function areAdjacentAvailabilitySlots(
  earlier: Pick<ProfileAvailabilityMergeSlot, "start_time" | "end_time">,
  later: Pick<ProfileAvailabilityMergeSlot, "start_time" | "end_time">
): boolean {
  if (isOvernightAvailability(earlier.start_time, earlier.end_time)) {
    return false;
  }
  if (isOvernightAvailability(later.start_time, later.end_time)) {
    return false;
  }
  return timeToMinutes(earlier.end_time) === timeToMinutes(later.start_time);
}

export function planAdjacentProfileAvailabilityMerges<
  T extends ProfileAvailabilityMergeSlot,
>(slots: readonly T[]): ProfileAvailabilityMergePlan[] {
  const byWeekday = new Map<number, T[]>();
  for (const slot of slots) {
    const weekdaySlots = byWeekday.get(slot.weekday) ?? [];
    weekdaySlots.push(slot);
    byWeekday.set(slot.weekday, weekdaySlots);
  }

  const plans: ProfileAvailabilityMergePlan[] = [];

  for (const weekdaySlots of byWeekday.values()) {
    const sorted = sortProfileRecurringAvailabilityBySchedule(weekdaySlots);
    if (sorted.length <= 1) continue;

    let chain: T[] = [sorted[0]!];

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = chain[chain.length - 1]!;
      const next = sorted[index]!;
      if (areAdjacentAvailabilitySlots(previous, next)) {
        chain.push(next);
        continue;
      }

      if (chain.length > 1) {
        plans.push(createMergePlanFromChain(chain));
      }
      chain = [next];
    }

    if (chain.length > 1) {
      plans.push(createMergePlanFromChain(chain));
    }
  }

  return plans;
}

function createMergePlanFromChain<T extends ProfileAvailabilityMergeSlot>(
  chain: readonly T[]
): ProfileAvailabilityMergePlan {
  const first = chain[0]!;
  const last = chain[chain.length - 1]!;
  return {
    keepId: first.id,
    deleteIds: chain.slice(1).map((slot) => slot.id),
    weekday: first.weekday,
    start_time: first.start_time,
    end_time: last.end_time,
  };
}
