import {
  parseClockTimeToMinutes,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";

export const MINUTES_PER_DAY = 24 * 60;

const SHIFT_CARD_ABSOLUTE_MIN_WIDTH_PX =
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX + 24;

/** Mindestbreite für Overnight-Span-Karten (Lesbarkeit über zwei Tage). */
export const SHIFT_CARD_OVERNIGHT_MIN_WIDTH_PX = 96;

export function shiftClockDurationMinutes(
  startTime: string,
  endTime: string
): number {
  const startMin = parseClockTimeToMinutes(startTime);
  let endMin = parseClockTimeToMinutes(endTime);
  if (endMin <= startMin) {
    endMin += MINUTES_PER_DAY;
  }
  return endMin - startMin;
}

export function widthFrom24hDurationPx(
  durationMin: number,
  referenceWidthPx: number
): number {
  if (referenceWidthPx <= 0 || durationMin <= 0) return 0;
  return (durationMin / MINUTES_PER_DAY) * referenceWidthPx;
}

/**
 * Dashboard Overnight-Span: Dauer / 24 h × kombinierte Zellbreite, mit MIN.
 */
export function resolveOvernightSpanWidthPx(options: {
  startTime: string;
  endTime: string;
  combinedCellWidthPx: number;
}): number {
  const { startTime, endTime, combinedCellWidthPx } = options;
  if (combinedCellWidthPx <= 0) return 1;

  const durationMin = shiftClockDurationMinutes(startTime, endTime);
  const proportionalPx = widthFrom24hDurationPx(
    durationMin,
    combinedCellWidthPx
  );

  return Math.max(
    SHIFT_CARD_OVERNIGHT_MIN_WIDTH_PX,
    proportionalPx,
    SHIFT_CARD_ABSOLUTE_MIN_WIDTH_PX
  );
}
