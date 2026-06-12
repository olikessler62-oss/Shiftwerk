import type { ShiftCardDensity } from "@/lib/shift-card-display-content";
import { SHIFT_CARD_EXTRA_WIDTH_PX } from "@/lib/shift-card-row-layout";
import { SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX } from "@/lib/shift-card-time-gradient";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import {
  timelineDurationWidthPx,
  timelineLeftPx,
} from "@/lib/shift-card-service-timeline";

export const SHIFT_CARD_CELL_PADDING_PX = 4;
export const SHIFT_CARD_MARKER_WIDTH_PX = SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX;
export const SHIFT_CARD_ABSOLUTE_MIN_WIDTH_PX =
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX + 24;

export type ShiftCardCellLayout = {
  widthPx: number;
  marginLeftPx: number;
  density: ShiftCardDensity;
};

export type ShiftCardCellLayoutOptions = {
  /** Schichten in der Zelle — bei wenigen Zuweisungen breitere Karten. */
  shiftCountInCell?: number;
  /** Gleiche Schichtzeiten überall gleich breit (keine Fair-Share-Aufblähung). */
  uniformShiftDurationWidth?: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Großzügigere Mindestbreite, wenn nur wenige Schichten in einer breiten Zelle liegen. */
export function sparseCellFairShareWidthPx(
  trackWidthPx: number,
  shiftCountInCell: number
): number {
  const count = Math.max(1, Math.floor(shiftCountInCell));
  if (count >= 8 || trackWidthPx <= 0) return 0;
  const share = Math.min(0.78, 0.92 / count);
  return trackWidthPx * share;
}

export function computeShiftCardCellLayout(
  cellWidthPx: number,
  startTime: string,
  endTime: string,
  timeline: ShiftCardServiceTimeline,
  density: ShiftCardDensity,
  contentMinWidthPx: number,
  options: ShiftCardCellLayoutOptions = {}
): ShiftCardCellLayout {
  if (cellWidthPx <= 0) {
    return { widthPx: 0, marginLeftPx: 0, density: "marker" };
  }

  const padding = SHIFT_CARD_CELL_PADDING_PX;
  const trackWidthPx = Math.max(0, cellWidthPx - padding * 2);
  const shiftCount = options.shiftCountInCell ?? 1;

  const durationWidthPx = timelineDurationWidthPx(
    startTime,
    endTime,
    trackWidthPx,
    timeline
  );
  const fairSharePx = options.uniformShiftDurationWidth
    ? 0
    : sparseCellFairShareWidthPx(trackWidthPx, shiftCount);

  if (density === "marker") {
    const widthPx = SHIFT_CARD_MARKER_WIDTH_PX + SHIFT_CARD_EXTRA_WIDTH_PX;
    const marginLeftPx = resolveShiftCardMarginLeftPx(
      cellWidthPx,
      startTime,
      trackWidthPx,
      timeline,
      padding,
      widthPx
    );
    return { widthPx, marginLeftPx, density };
  }

  const readableMinWidthPx = contentMinWidthPx + SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX;
  const widthHintPx = Math.min(
    trackWidthPx,
    Math.max(
      durationWidthPx,
      fairSharePx,
      readableMinWidthPx,
      SHIFT_CARD_ABSOLUTE_MIN_WIDTH_PX
    )
  );

  const marginLeftPx = resolveShiftCardMarginLeftPx(
    cellWidthPx,
    startTime,
    trackWidthPx,
    timeline,
    padding,
    widthHintPx
  );

  const availableWidthPx = Math.max(0, cellWidthPx - padding - marginLeftPx);
  const readableCapPx = Math.min(readableMinWidthPx, availableWidthPx);

  let widthPx = Math.max(
    durationWidthPx,
    fairSharePx,
    SHIFT_CARD_ABSOLUTE_MIN_WIDTH_PX
  );

  if (widthPx < readableCapPx) {
    widthPx = readableCapPx;
  }

  widthPx = clamp(widthPx, SHIFT_CARD_ABSOLUTE_MIN_WIDTH_PX, availableWidthPx);
  widthPx = Math.min(widthPx + SHIFT_CARD_EXTRA_WIDTH_PX, availableWidthPx + SHIFT_CARD_EXTRA_WIDTH_PX);

  return { widthPx, marginLeftPx, density };
}

function resolveShiftCardMarginLeftPx(
  cellWidthPx: number,
  startTime: string,
  trackWidthPx: number,
  timeline: ShiftCardServiceTimeline,
  padding: number,
  cardWidthHintPx: number
): number {
  const leftIdealPx = timelineLeftPx(
    startTime,
    trackWidthPx,
    timeline,
    padding
  );
  const safeCardWidth = Math.max(
    SHIFT_CARD_MARKER_WIDTH_PX,
    Math.min(cardWidthHintPx, trackWidthPx)
  );

  return clamp(
    leftIdealPx,
    padding,
    Math.max(padding, cellWidthPx - padding - safeCardWidth)
  );
}

export {
  resolveAreaServiceDayTimeline,
  resolveLocationServiceDayTimeline,
  type ShiftCardServiceTimeline,
} from "@/lib/shift-card-service-timeline";
