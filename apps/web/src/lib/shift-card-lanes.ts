import { parseClockTimeToMinutes } from "@/lib/shift-card-time-gradient";

const MINUTES_PER_DAY = 24 * 60;

export type ShiftCardLaneInput = {
  id: string;
  startTime: string;
  endTime: string;
};

type MinuteRange = {
  startMin: number;
  endMin: number;
};

function toMinuteRange(startTime: string, endTime: string): MinuteRange {
  const startMin = parseClockTimeToMinutes(startTime);
  let endMin = parseClockTimeToMinutes(endTime);
  if (endMin <= startMin) {
    endMin += MINUTES_PER_DAY;
  }
  return { startMin, endMin };
}

/** [start, end): Randberührung zählt nicht als Überlappung. */
export function shiftClockWindowsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a = toMinuteRange(startA, endA);
  const b = toMinuteRange(startB, endB);
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function rangesOverlap(a: MinuteRange, b: MinuteRange): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function compareShiftStart(a: ShiftCardLaneInput, b: ShiftCardLaneInput): number {
  const startA = parseClockTimeToMinutes(a.startTime);
  const startB = parseClockTimeToMinutes(b.startTime);
  if (startA !== startB) return startA - startB;
  const endA = parseClockTimeToMinutes(a.endTime);
  const endB = parseClockTimeToMinutes(b.endTime);
  if (endA !== endB) return endA - endB;
  return a.id.localeCompare(b.id);
}

export type ShiftCardVisualLaneInput = ShiftCardLaneInput & {
  marginLeftPx: number;
  widthPx: number;
};

function visualRangesOverlap(
  a: { left: number; right: number },
  b: { left: number; right: number }
): boolean {
  return a.left < b.right && b.left < a.right;
}

/**
 * Lanes nach tatsächlicher Kartenposition (left + width), nicht nur Schichtzeit.
 * Verhindert, dass breite Mindestbreite-Karten andere Karten in derselben Zeile verdecken.
 */
export function assignShiftCardVisualLanes(
  shifts: readonly ShiftCardVisualLaneInput[]
): Map<string, number> {
  const laneBounds: { left: number; right: number }[][] = [];
  const result = new Map<string, number>();

  const sorted = [...shifts].sort((a, b) => {
    const leftDiff = a.marginLeftPx - b.marginLeftPx;
    if (leftDiff !== 0) return leftDiff;
    return compareShiftStart(a, b);
  });

  for (const shift of sorted) {
    const bounds = {
      left: shift.marginLeftPx,
      right: shift.marginLeftPx + Math.max(shift.widthPx, 1),
    };
    let laneIndex = -1;

    for (let i = 0; i < laneBounds.length; i++) {
      const overlaps = laneBounds[i]!.some((existing) =>
        visualRangesOverlap(bounds, existing)
      );
      if (!overlaps) {
        laneIndex = i;
        laneBounds[i]!.push(bounds);
        break;
      }
    }

    if (laneIndex === -1) {
      laneIndex = laneBounds.length;
      laneBounds.push([bounds]);
    }

    result.set(shift.id, laneIndex);
  }

  return result;
}

export function countShiftCardVisualLanes(
  shifts: readonly ShiftCardVisualLaneInput[]
): number {
  if (shifts.length === 0) return 0;
  const lanes = assignShiftCardVisualLanes(shifts);
  let maxLane = 0;
  for (const laneIndex of lanes.values()) {
    maxLane = Math.max(maxLane, laneIndex);
  }
  return maxLane + 1;
}

export function packShiftCardVisualSubRows(
  shifts: readonly ShiftCardVisualLaneInput[]
): Map<string, number> {
  const subRowBounds: { left: number; right: number }[][] = [];
  const result = new Map<string, number>();

  const sorted = [...shifts].sort((a, b) => {
    const leftDiff = a.marginLeftPx - b.marginLeftPx;
    if (leftDiff !== 0) return leftDiff;
    return compareShiftStart(a, b);
  });

  for (const shift of sorted) {
    const bounds = {
      left: shift.marginLeftPx,
      right: shift.marginLeftPx + Math.max(shift.widthPx, 1),
    };
    let subRowIndex = -1;

    for (let i = 0; i < subRowBounds.length; i++) {
      const overlaps = subRowBounds[i]!.some((existing) =>
        visualRangesOverlap(bounds, existing)
      );
      if (!overlaps) {
        subRowIndex = i;
        subRowBounds[i]!.push(bounds);
        break;
      }
    }

    if (subRowIndex === -1) {
      subRowIndex = subRowBounds.length;
      subRowBounds.push([bounds]);
    }

    result.set(shift.id, subRowIndex);
  }

  return result;
}

export function countShiftCardVisualSubRows(
  shifts: readonly ShiftCardVisualLaneInput[]
): number {
  if (shifts.length === 0) return 0;
  const subRows = packShiftCardVisualSubRows(shifts);
  let max = 0;
  for (const index of subRows.values()) {
    max = Math.max(max, index);
  }
  return max + 1;
}

/**
 * Zeit-Lanes: nicht überlappende Schichtzeiten teilen sich eine Zeile.
 */
export function assignShiftCardLanes(
  shifts: readonly ShiftCardLaneInput[]
): Map<string, number> {
  const laneRanges: MinuteRange[][] = [];
  const result = new Map<string, number>();

  const sorted = [...shifts].sort(compareShiftStart);

  for (const shift of sorted) {
    const range = toMinuteRange(shift.startTime, shift.endTime);
    let laneIndex = -1;

    for (let i = 0; i < laneRanges.length; i++) {
      const lane = laneRanges[i]!;
      const overlaps = lane.some((existing) => rangesOverlap(range, existing));
      if (!overlaps) {
        laneIndex = i;
        lane.push(range);
        break;
      }
    }

    if (laneIndex === -1) {
      laneIndex = laneRanges.length;
      laneRanges.push([range]);
    }

    result.set(shift.id, laneIndex);
  }

  return result;
}

export function countShiftCardLanes(shifts: readonly ShiftCardLaneInput[]): number {
  if (shifts.length === 0) return 0;
  const lanes = assignShiftCardLanes(shifts);
  let maxLane = 0;
  for (const laneIndex of lanes.values()) {
    maxLane = Math.max(maxLane, laneIndex);
  }
  return maxLane + 1;
}
