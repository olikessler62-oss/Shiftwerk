import type { ShiftCardDensity } from "@/lib/shift-card-display-content";
import { SHIFT_CARD_COMPACT_MIN_FALLBACK_PX } from "@/lib/shift-card-display-content";
import { SHIFT_CARD_EXTRA_WIDTH_PX } from "@/lib/shift-card-row-layout";
import { shiftClockDurationMinutes } from "@/lib/shift-card-proportional-width";
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

/** Mindestbreite einer Schichtkarte relativ zur Tageszellenbreite (Bereich-Kalender). */
export const SHIFT_CARD_MIN_CELL_WIDTH_RATIO = 0.23;

export function shiftCardMinWidthFromCellPx(cellWidthPx: number): number {
  if (cellWidthPx <= 0) return SHIFT_CARD_ABSOLUTE_MIN_WIDTH_PX;
  return Math.max(
    SHIFT_CARD_ABSOLUTE_MIN_WIDTH_PX,
    cellWidthPx * SHIFT_CARD_MIN_CELL_WIDTH_RATIO
  );
}

/** Untergrenze für compact-Dichte (Inhalt + Mitarbeiterstreifen). */
export const SHIFT_CARD_COMPACT_READABLE_WIDTH_PX =
  SHIFT_CARD_COMPACT_MIN_FALLBACK_PX + SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX;

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
/** Schmale Balken in zugeklappten Tages-Spalten (nicht volle Timeline-Breite). */
export const COLLAPSED_DAY_COLUMN_LINE_MAX_WIDTH_PX = 6;
export const COLLAPSED_SHIFT_PIXEL_SIZE_PX = 1;
export const COLLAPSED_PAST_DAY_SHIFT_COLOR = "#94a3b8";
export const COLLAPSED_PAST_AREA_PIXEL_COLOR = "#64748b";

/** Ab 3 h skaliert die Kartenbreite proportional mit der Schichtdauer. */
export const SHIFT_CARD_FULL_DURATION_TIER_MINUTES = 3 * 60;

/** Unter-3-h-Schichten (1 h, 2 h, …): einheitliche Breite als Anteil der 3-h-Referenz. */
export const SHORT_SHIFT_WIDTH_RATIO_OF_THREE_HOURS = 0.88;

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

/** Timeline-Breite einer 3-h-Referenzschicht (Positions-unabhängig). */
export function timelineThreeHourReferenceWidthPx(
  trackWidthPx: number,
  timeline: ShiftCardServiceTimeline
): number {
  if (trackWidthPx <= 0 || timeline.durationMin <= 0) return 0;
  return (
    (SHIFT_CARD_FULL_DURATION_TIER_MINUTES / timeline.durationMin) * trackWidthPx
  );
}

/** Effektive 3-h-Breite inkl. Lesbarkeits-Untergrenze — Basis für Unter-3-h-Anteil. */
export function resolveThreeHourTierDisplayWidthPx(
  trackWidthPx: number,
  timeline: ShiftCardServiceTimeline
): number {
  return Math.max(
    timelineThreeHourReferenceWidthPx(trackWidthPx, timeline),
    SHIFT_CARD_COMPACT_READABLE_WIDTH_PX
  );
}

/** Zielbreite für alle Unter-3-h-Schichten (1 h = 2 h), relativ zur sichtbaren 3-h-Karte. */
export function resolveSubThreeHourUniformTargetWidthPx(
  trackWidthPx: number,
  timeline: ShiftCardServiceTimeline
): number {
  const threeHourDisplayPx = resolveThreeHourTierDisplayWidthPx(
    trackWidthPx,
    timeline
  );
  const threeHourTimelinePx = timelineThreeHourReferenceWidthPx(
    trackWidthPx,
    timeline
  );
  const readabilityTargetPx =
    threeHourDisplayPx * SHORT_SHIFT_WIDTH_RATIO_OF_THREE_HOURS;
  const timelineTargetPx =
    threeHourTimelinePx * SHORT_SHIFT_WIDTH_RATIO_OF_THREE_HOURS;

  return Math.max(
    SHIFT_CARD_ABSOLUTE_MIN_WIDTH_PX,
    Math.min(readabilityTargetPx, timelineTargetPx)
  );
}

/**
 * Kartenbreite nach Dauer-Stufe:
 * - unter 3 h: einheitlich (1 h = 2 h), etwas schmaler als 3 h
 * - ab 3 h: proportional zur Schichtdauer auf der Timeline
 */
export function resolveShiftCardDurationWidthPx(
  startTime: string,
  endTime: string,
  trackWidthPx: number,
  timeline: ShiftCardServiceTimeline
): number {
  const durationMin = shiftClockDurationMinutes(startTime, endTime);
  const proportional = timelineDurationWidthPx(
    startTime,
    endTime,
    trackWidthPx,
    timeline
  );

  if (durationMin < SHIFT_CARD_FULL_DURATION_TIER_MINUTES) {
    return Math.max(
      proportional,
      resolveSubThreeHourUniformTargetWidthPx(trackWidthPx, timeline)
    );
  }

  const subThreeHourReferencePx = resolveSubThreeHourUniformTargetWidthPx(
    trackWidthPx,
    timeline
  );
  const durationScaledFromTwoHoursPx =
    subThreeHourReferencePx * (durationMin / (2 * 60));

  if (proportional >= durationScaledFromTwoHoursPx) {
    return Math.max(
      proportional,
      resolveThreeHourTierDisplayWidthPx(trackWidthPx, timeline)
    );
  }

  return durationScaledFromTwoHoursPx;
}

function isSubThreeHourShift(startTime: string, endTime: string): boolean {
  return (
    shiftClockDurationMinutes(startTime, endTime) <
    SHIFT_CARD_FULL_DURATION_TIER_MINUTES
  );
}

function clampShiftCardLayoutToCell(
  cellWidthPx: number,
  startTime: string,
  trackWidthPx: number,
  timeline: ShiftCardServiceTimeline,
  padding: number,
  layout: ShiftCardCellLayout,
  widthHintPx: number
): void {
  layout.marginLeftPx = resolveShiftCardMarginLeftPx(
    cellWidthPx,
    startTime,
    trackWidthPx,
    timeline,
    padding,
    widthHintPx
  );

  const availableWidthPx = Math.max(
    0,
    cellWidthPx - padding - layout.marginLeftPx
  );
  const cellMinWidthPx = shiftCardMinWidthFromCellPx(cellWidthPx);
  layout.widthPx = clamp(
    layout.widthPx + SHIFT_CARD_EXTRA_WIDTH_PX,
    cellMinWidthPx + SHIFT_CARD_EXTRA_WIDTH_PX,
    availableWidthPx + SHIFT_CARD_EXTRA_WIDTH_PX
  );
}

function finalizeShiftCardCellLayout(
  cellWidthPx: number,
  startTime: string,
  trackWidthPx: number,
  timeline: ShiftCardServiceTimeline,
  padding: number,
  layout: ShiftCardCellLayout
): void {
  const cellMinWidthPx = shiftCardMinWidthFromCellPx(cellWidthPx);
  layout.widthPx = Math.max(layout.widthPx, cellMinWidthPx);
  clampShiftCardLayoutToCell(
    cellWidthPx,
    startTime,
    trackWidthPx,
    timeline,
    padding,
    layout,
    layout.widthPx
  );
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
  const subThreeHourShift = isSubThreeHourShift(startTime, endTime);
  const cellMinWidthPx = shiftCardMinWidthFromCellPx(cellWidthPx);

  const durationWidthPx = resolveShiftCardDurationWidthPx(
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
  const widthHintPx = options.uniformShiftDurationWidth
    ? Math.min(
        trackWidthPx,
        Math.max(durationWidthPx, cellMinWidthPx)
      )
    : Math.min(
        trackWidthPx,
        Math.max(
          durationWidthPx,
          fairSharePx,
          readableMinWidthPx,
          cellMinWidthPx
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
    cellMinWidthPx
  );

  if (options.uniformShiftDurationWidth) {
    if (subThreeHourShift) {
      widthPx = Math.max(
        resolveSubThreeHourUniformTargetWidthPx(trackWidthPx, timeline),
        cellMinWidthPx
      );
    } else {
      widthPx = Math.max(
        durationWidthPx,
        SHIFT_CARD_COMPACT_READABLE_WIDTH_PX,
        cellMinWidthPx
      );
    }
  } else if (widthPx < readableCapPx) {
    widthPx = readableCapPx;
  }

  const layout: ShiftCardCellLayout = { widthPx, marginLeftPx, density };
  finalizeShiftCardCellLayout(
    cellWidthPx,
    startTime,
    trackWidthPx,
    timeline,
    padding,
    layout
  );

  return layout;
}

/**
 * Alle Unter-3-h-Schichten einer Zelle auf dieselbe Zielbreite setzen.
 * Berücksichtigt die engste verfügbare Zellbreite, damit 1 h und 2 h identisch bleiben.
 */
export function applySubThreeHourUniformShiftCardWidths(
  cellWidthPx: number,
  items: readonly ShiftCardLayoutWidthInput[],
  timeline: ShiftCardServiceTimeline
): void {
  if (items.length === 0 || cellWidthPx <= 0) return;

  const padding = SHIFT_CARD_CELL_PADDING_PX;
  const trackWidthPx = Math.max(0, cellWidthPx - padding * 2);
  const shortItems = items.filter((item) =>
    isSubThreeHourShift(item.startTime, item.endTime)
  );
  if (shortItems.length === 0) return;

  let uniformWidthPx = Math.max(
    resolveSubThreeHourUniformTargetWidthPx(trackWidthPx, timeline),
    shiftCardMinWidthFromCellPx(cellWidthPx)
  );

  for (const item of shortItems) {
    const marginLeftPx = resolveShiftCardMarginLeftPx(
      cellWidthPx,
      item.startTime,
      trackWidthPx,
      timeline,
      padding,
      uniformWidthPx
    );
    const availableWidthPx = Math.max(
      0,
      cellWidthPx - padding - marginLeftPx
    );
    uniformWidthPx = Math.min(
      uniformWidthPx,
      availableWidthPx + SHIFT_CARD_EXTRA_WIDTH_PX
    );
  }

  for (const item of shortItems) {
    item.layout.widthPx = uniformWidthPx;
    clampShiftCardLayoutToCell(
      cellWidthPx,
      item.startTime,
      trackWidthPx,
      timeline,
      padding,
      item.layout,
      uniformWidthPx
    );
  }
}

export type ShiftCardLayoutWidthInput = {
  layout: ShiftCardCellLayout;
  startTime: string;
  endTime: string;
};

/**
 * Längere Schichten mindestens so breit wie kürzere (nach Dauer sortiert).
 * Passt bei Bedarf marginLeft an, damit breitere Karten noch in die Zelle passen.
 */
export function applyDurationMonotonicShiftCardWidths(
  cellWidthPx: number,
  items: readonly ShiftCardLayoutWidthInput[],
  timeline: ShiftCardServiceTimeline
): void {
  if (items.length <= 1 || cellWidthPx <= 0) return;

  const padding = SHIFT_CARD_CELL_PADDING_PX;
  const trackWidthPx = Math.max(0, cellWidthPx - padding * 2);

  const sorted = items
    .map((item) => ({
      item,
      durationMin: shiftClockDurationMinutes(item.startTime, item.endTime),
    }))
    .sort((a, b) => a.durationMin - b.durationMin);

  let widthFloorPx = shiftCardMinWidthFromCellPx(cellWidthPx);
  for (const { item } of sorted) {
    widthFloorPx = Math.max(widthFloorPx, item.layout.widthPx);
    if (item.layout.widthPx >= widthFloorPx) continue;

    item.layout.widthPx = widthFloorPx;
    clampShiftCardLayoutToCell(
      cellWidthPx,
      item.startTime,
      trackWidthPx,
      timeline,
      padding,
      item.layout,
      widthFloorPx
    );
  }
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

/** Einheitliche schmale Breite für zugeklappte Tages-Spalten (aktuell, Zukunft, Vergangenheit). */
export function computeCollapsedDayColumnLineWidthPx(
  cellWidthPx: number,
  shifts: readonly CollapsedShiftTimeWindow[],
  timeline: ShiftCardServiceTimeline
): number {
  const durationBased = computePastDayUniformLineWidthPx(
    cellWidthPx,
    shifts,
    timeline
  );
  return Math.min(durationBased, COLLAPSED_DAY_COLUMN_LINE_MAX_WIDTH_PX);
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
