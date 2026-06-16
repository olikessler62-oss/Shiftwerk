import { PLANNING_CELL_PADDING_PX } from "@/lib/planning-calendar-layout";

export type PlanningOvernightSpanGeometry = {
  leftPx: number;
  widthPx: number;
};

export type PlanningOvernightSpanDisplayMode = "expanded" | "collapsed";

/** Breite des eingeklappten Nachtschicht-Balkens über der Tagesgrenze. */
export const PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX = 6;

function cellContentMidpointX(rect: DOMRect): number {
  return rect.left + PLANNING_CELL_PADDING_PX + (rect.width - PLANNING_CELL_PADDING_PX * 2) / 2;
}

function dayBorderCenterX(startCellRect: DOMRect, endCellRect: DOMRect): number {
  return (startCellRect.right + endCellRect.left) / 2;
}

/** Aufgeklappt: von Mitte Starttag bis Mitte Folgetag (wie bisherige Halbkarten). */
export function measureExpandedOvernightSpanGeometry(
  startCellRect: DOMRect,
  endCellRect: DOMRect,
  overlayRect: DOMRect
): PlanningOvernightSpanGeometry {
  const leftPx = cellContentMidpointX(startCellRect) - overlayRect.left;
  const rightPx = cellContentMidpointX(endCellRect) - overlayRect.left;
  return {
    leftPx,
    widthPx: Math.max(1, rightPx - leftPx),
  };
}

const OVERNIGHT_DAY_CELL_ADJACENCY_TOLERANCE_PX = 2;

/** Start- und Endtag liegen nebeneinander (nicht mitten in einer Grid-Animation). */
export function planningOvernightDayCellsLookAdjacent(
  startCellRect: DOMRect,
  endCellRect: DOMRect
): boolean {
  const gapPx = endCellRect.left - startCellRect.right;
  return (
    gapPx >= -OVERNIGHT_DAY_CELL_ADJACENCY_TOLERANCE_PX &&
    gapPx <= 8
  );
}

/** Eingeklappt: schmaler Balken, zentriert auf der Tagesgrenzlinie. */
export function measureCollapsedOvernightSpanGeometry(
  startCellRect: DOMRect,
  endCellRect: DOMRect,
  overlayRect: DOMRect,
  markerWidthPx: number = PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX
): PlanningOvernightSpanGeometry {
  const borderCenterX = dayBorderCenterX(startCellRect, endCellRect);
  const widthPx = Math.max(1, markerWidthPx);
  return {
    leftPx: borderCenterX - overlayRect.left - widthPx / 2,
    widthPx,
  };
}

export function measureOvernightSpanGeometry(
  startCellRect: DOMRect,
  endCellRect: DOMRect,
  overlayRect: DOMRect,
  mode: PlanningOvernightSpanDisplayMode,
  collapsedMarkerWidthPx?: number
): PlanningOvernightSpanGeometry {
  return mode === "expanded"
    ? measureExpandedOvernightSpanGeometry(startCellRect, endCellRect, overlayRect)
    : measureCollapsedOvernightSpanGeometry(
        startCellRect,
        endCellRect,
        overlayRect,
        collapsedMarkerWidthPx
      );
}

export function planningCellDataAttribute(employeeId: string, date: string): string {
  return `${employeeId}:${date}`;
}

export function queryPlanningOvernightSpanAnchor(
  root: ParentNode,
  shiftId: string
): HTMLElement | null {
  return root.querySelector(
    `[data-planning-overnight-span-anchor="${shiftId}"]`
  );
}

export function queryPlanningCellInRoot(
  root: ParentNode,
  employeeId: string,
  date: string
): HTMLElement | null {
  return root.querySelector(
    `[data-planning-cell="${planningCellDataAttribute(employeeId, date)}"]`
  );
}

/** Nur für gleich breite Spalten — bei gemischten Breiten unzuverlässig. */
export function computeCollapsedOvernightSpanLeftPxFromDayIndices(
  overlayWidthPx: number,
  dayColumnCount: number,
  startDayIndex: number,
  markerWidthPx: number
): number {
  if (dayColumnCount <= 0 || overlayWidthPx <= 0) return 0;
  const columnWidthPx = overlayWidthPx / dayColumnCount;
  const borderCenterX = (startDayIndex + 1) * columnWidthPx;
  return Math.max(0, borderCenterX - markerWidthPx / 2);
}
