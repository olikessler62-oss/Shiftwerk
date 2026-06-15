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

/** Eingeklappt: 6px breit, zentriert auf der Tagesgrenzlinie. */
export function measureCollapsedOvernightSpanGeometry(
  startCellRect: DOMRect,
  endCellRect: DOMRect,
  overlayRect: DOMRect
): PlanningOvernightSpanGeometry {
  const borderCenterX = dayBorderCenterX(startCellRect, endCellRect);
  return {
    leftPx:
      borderCenterX -
      overlayRect.left -
      PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX / 2,
    widthPx: PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,
  };
}

export function measureOvernightSpanGeometry(
  startCellRect: DOMRect,
  endCellRect: DOMRect,
  overlayRect: DOMRect,
  mode: PlanningOvernightSpanDisplayMode
): PlanningOvernightSpanGeometry {
  return mode === "expanded"
    ? measureExpandedOvernightSpanGeometry(startCellRect, endCellRect, overlayRect)
    : measureCollapsedOvernightSpanGeometry(startCellRect, endCellRect, overlayRect);
}

export function planningCellDataAttribute(employeeId: string, date: string): string {
  return `${employeeId}:${date}`;
}
