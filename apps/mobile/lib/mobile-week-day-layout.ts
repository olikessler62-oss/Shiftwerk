export type WeekDayShiftsLayout = "single" | "pair" | "triple" | "grid";

export function getWeekDayShiftsLayout(shiftCount: number): WeekDayShiftsLayout {
  if (shiftCount <= 1) return "single";
  if (shiftCount === 2) return "pair";
  if (shiftCount === 3) return "triple";
  return "grid";
}

export function isWeekDayRowLayout(layout: WeekDayShiftsLayout): boolean {
  return layout === "pair" || layout === "triple";
}

/** Zeilenhöhe in Basiseinheiten (1 = normale Tagzeile). */
export function getWeekDayHeightUnits(shiftCount: number): number {
  if (shiftCount <= 2) return 1;
  if (shiftCount === 3) return 1.35;
  return Math.ceil(shiftCount / 2);
}

export function getWeekDayGridRowCount(shiftCount: number): number {
  return Math.ceil(shiftCount / 2);
}

export const WEEK_DAY_SHIFT_CARD_AREA_HEIGHT_RATIO = 0.95;

export const WEEK_DAY_GRID_CARD_WIDTH_PERCENT = "49.5%";

export function resolveWeekDaySlotHeightForContent(contentHeight: number): number {
  return Math.ceil(contentHeight / WEEK_DAY_SHIFT_CARD_AREA_HEIGHT_RATIO);
}

export function resolveWeekDaySlotHeights(
  shiftCounts: readonly number[],
  viewportHeight: number
): { heights: number[]; scrollable: boolean } {
  if (viewportHeight <= 0 || shiftCounts.length === 0) {
    return { heights: shiftCounts.map(() => 0), scrollable: false };
  }

  const unitHeight = Math.floor(viewportHeight / 7);
  const rawHeights = shiftCounts.map((count) =>
    unitHeight * getWeekDayHeightUnits(count)
  );
  const totalRaw = rawHeights.reduce((sum, height) => sum + height, 0);

  if (totalRaw <= viewportHeight) {
    const scale = viewportHeight / totalRaw;
    return {
      heights: rawHeights.map((height) => Math.floor(height * scale)),
      scrollable: false,
    };
  }

  return { heights: rawHeights, scrollable: true };
}
