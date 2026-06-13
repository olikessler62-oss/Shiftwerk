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

export type CollapsedShiftLineLayout = {
  marginLeftPx: number;
  widthPx: number;
  heightPx: number;
};

export const COLLAPSED_SHIFT_LINE_MIN_WIDTH_PX = 2;
export const COLLAPSED_SHIFT_PIXEL_SIZE_PX = 1;
export const COLLAPSED_PAST_DAY_SHIFT_COLOR = "#94a3b8";
export const COLLAPSED_PAST_AREA_PIXEL_COLOR = "#64748b";

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

/** Schicht-Vorschau in zugeklappten Tagen: Position/Breite wie bei aufgeklappten Karten. */
export function computeCollapsedShiftLineLayout(
  cellWidthPx: number,
  startTime: string,
  endTime: string,
  timeline: ShiftCardServiceTimeline,
  heightPx: number
): CollapsedShiftLineLayout {
  if (cellWidthPx <= 0 || heightPx <= 0) {
    return { marginLeftPx: 0, widthPx: 0, heightPx: 0 };
  }

  const padding = SHIFT_CARD_CELL_PADDING_PX;
  const trackWidthPx = Math.max(0, cellWidthPx - padding * 2);
  const widthPx = Math.max(
    COLLAPSED_SHIFT_LINE_MIN_WIDTH_PX,
    timelineDurationWidthPx(startTime, endTime, trackWidthPx, timeline)
  );
  const marginLeftPx = resolveShiftCardMarginLeftPx(
    cellWidthPx,
    startTime,
    trackWidthPx,
    timeline,
    padding,
    widthPx
  );

  return { marginLeftPx, widthPx, heightPx };
}

/** Kleinste Timeline-Breite über alle Schichten eines vergangenen Tages (standortweit). */
export function computePastDayUniformLineWidthPx(
  cellWidthPx: number,
  shifts: readonly CollapsedShiftTimeWindow[],
  timeline: ShiftCardServiceTimeline
): number {
  if (cellWidthPx <= 0 || shifts.length === 0) {
    return COLLAPSED_SHIFT_LINE_MIN_WIDTH_PX;
  }

  const padding = SHIFT_CARD_CELL_PADDING_PX;
  const trackWidthPx = Math.max(0, cellWidthPx - padding * 2);

  let minWidthPx = Number.POSITIVE_INFINITY;
  for (const shift of shifts) {
    const widthPx = Math.max(
      COLLAPSED_SHIFT_LINE_MIN_WIDTH_PX,
      timelineDurationWidthPx(
        shift.startTime,
        shift.endTime,
        trackWidthPx,
        timeline
      )
    );
    minWidthPx = Math.min(minWidthPx, widthPx);
  }

  return Number.isFinite(minWidthPx)
    ? minWidthPx
    : COLLAPSED_SHIFT_LINE_MIN_WIDTH_PX;
}

export type CollapsedShiftTimeWindow = {
  startTime: string;
  endTime: string;
};

/** Zugeklappte Tage: Position wie Karten; bei Vergangenheit einheitliche kleinste Breite. */
export function computeCollapsedDayShiftLineLayouts(
  cellWidthPx: number,
  shifts: readonly CollapsedShiftTimeWindow[],
  timeline: ShiftCardServiceTimeline,
  heightPx: number,
  options: { uniformMinWidth?: boolean; uniformWidthPx?: number } = {}
): CollapsedShiftLineLayout[] {
  if (cellWidthPx <= 0 || heightPx <= 0 || shifts.length === 0) {
    return [];
  }

  if (!options.uniformMinWidth) {
    return shifts.map((shift) =>
      computeCollapsedShiftLineLayout(
        cellWidthPx,
        shift.startTime,
        shift.endTime,
        timeline,
        heightPx
      )
    );
  }

  const padding = SHIFT_CARD_CELL_PADDING_PX;
  const trackWidthPx = Math.max(0, cellWidthPx - padding * 2);

  const uniformWidthPx =
    options.uniformWidthPx ??
    computePastDayUniformLineWidthPx(cellWidthPx, shifts, timeline);

  return shifts.map((shift) => ({
    marginLeftPx: resolveShiftCardMarginLeftPx(
      cellWidthPx,
      shift.startTime,
      trackWidthPx,
      timeline,
      padding,
      uniformWidthPx
    ),
    widthPx: uniformWidthPx,
    heightPx,
  }));
}

/** Zugeklappte Bereiche: ein Pixel pro Schicht auf der Servicezeit-Timeline. */
export function computeCollapsedShiftPixelLeftPx(
  cellWidthPx: number,
  startTime: string,
  timeline: ShiftCardServiceTimeline
): number {
  if (cellWidthPx <= 0) return 0;

  const padding = SHIFT_CARD_CELL_PADDING_PX;
  const trackWidthPx = Math.max(0, cellWidthPx - padding * 2);

  return resolveShiftCardMarginLeftPx(
    cellWidthPx,
    startTime,
    trackWidthPx,
    timeline,
    padding,
    COLLAPSED_SHIFT_PIXEL_SIZE_PX
  );
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
