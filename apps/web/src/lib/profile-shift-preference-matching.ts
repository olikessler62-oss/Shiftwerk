import { shiftClockRangesOverlapMinutes } from "./bulk-staffing-header";

export type ProfileShiftPreferenceMatchEntry = {
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  location_id: string | null;
  location_area_id: string | null;
  qualification_id: string | null;
  priority: number;
};

export type ShiftWishMatchContext = {
  weekday: number;
  demandStart: string;
  demandEnd: string;
  areaId: string;
  locationId: string | null;
  qualificationId: string | null;
};

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

function wishHasAnyDimension(wish: ProfileShiftPreferenceMatchEntry): boolean {
  const hasTime =
    wish.weekday != null &&
    wish.start_time != null &&
    wish.end_time != null;
  return (
    hasTime ||
    wish.location_id != null ||
    wish.location_area_id != null ||
    wish.qualification_id != null
  );
}

function wishMatchesShift(
  wish: ProfileShiftPreferenceMatchEntry,
  context: ShiftWishMatchContext
): { matches: boolean; score: number } {
  if (wish.weekday != null && wish.weekday !== context.weekday) {
    return { matches: false, score: 0 };
  }

  let score = wish.priority;

  if (wish.start_time != null && wish.end_time != null) {
    const overlap = shiftClockRangesOverlapMinutes(
      context.demandStart,
      context.demandEnd,
      timeFieldValue(wish.start_time),
      timeFieldValue(wish.end_time)
    );
    if (overlap <= 0) return { matches: false, score: 0 };
    score += overlap * 100;
  }

  if (wish.location_area_id != null) {
    if (wish.location_area_id !== context.areaId) {
      return { matches: false, score: 0 };
    }
    score += 1000;
  }

  if (wish.location_id != null) {
    if (wish.location_id !== context.locationId) {
      return { matches: false, score: 0 };
    }
    score += 500;
  }

  if (wish.qualification_id != null) {
    if (wish.qualification_id !== context.qualificationId) {
      return { matches: false, score: 0 };
    }
    score += 300;
  }

  return { matches: true, score };
}

export function employeeWishScore(
  employeeId: string,
  context: ShiftWishMatchContext,
  preferences: Readonly<Record<string, ProfileShiftPreferenceMatchEntry[]>>
): number {
  const wishes = preferences[employeeId] ?? [];
  let best = 0;
  for (const wish of wishes) {
    if (!wishHasAnyDimension(wish)) continue;
    const result = wishMatchesShift(wish, context);
    if (result.matches) {
      best = Math.max(best, result.score);
    }
  }
  return best;
}

export function employeeHasApplicableWishes(
  employeeId: string,
  context: ShiftWishMatchContext,
  preferences: Readonly<Record<string, ProfileShiftPreferenceMatchEntry[]>>
): boolean {
  const wishes = preferences[employeeId] ?? [];
  return wishes.some((wish) => {
    if (!wishHasAnyDimension(wish)) return false;
    if (wish.weekday != null && wish.weekday !== context.weekday) return false;
    return true;
  });
}

export function isEmployeeWishFulfilled(
  employeeId: string,
  context: ShiftWishMatchContext,
  preferences: Readonly<Record<string, ProfileShiftPreferenceMatchEntry[]>>
): boolean {
  if (!employeeHasApplicableWishes(employeeId, context, preferences)) {
    return true;
  }
  return employeeWishScore(employeeId, context, preferences) > 0;
}

export type PickEmployeeForBulkPrefillResult = {
  employee: { id: string; full_name: string } | null;
  wishFulfilled: boolean;
};

export function pickEmployeeForBulkPrefill<
  T extends { id: string; full_name: string; last_shift_date?: string | null },
>(
  candidates: readonly T[],
  context: ShiftWishMatchContext,
  preferences: Readonly<Record<string, ProfileShiftPreferenceMatchEntry[]>>
): PickEmployeeForBulkPrefillResult {
  if (!candidates.length) {
    return { employee: null, wishFulfilled: true };
  }

  const ranked = [...candidates].sort((a, b) => {
    const wishDiff =
      employeeWishScore(b.id, context, preferences) -
      employeeWishScore(a.id, context, preferences);
    if (wishDiff !== 0) return wishDiff;

    if (!a.last_shift_date && !b.last_shift_date) {
      return a.full_name.localeCompare(b.full_name, "de");
    }
    if (!a.last_shift_date) return -1;
    if (!b.last_shift_date) return 1;
    const byDate = a.last_shift_date.localeCompare(b.last_shift_date);
    if (byDate !== 0) return byDate;
    return a.full_name.localeCompare(b.full_name, "de");
  });

  const employee = ranked[0] ?? null;
  if (!employee) {
    return { employee: null, wishFulfilled: true };
  }

  return {
    employee,
    wishFulfilled: isEmployeeWishFulfilled(employee.id, context, preferences),
  };
}
