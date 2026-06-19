import type { PlanningOvernightSpanDisplayMode } from "@/lib/planning-overnight-span-layout";

import { PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX } from "@/lib/planning-overnight-span-layout";

import { SHIFT_CARD_CELL_PADDING_PX } from "@/lib/shift-card-cell-layout";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import { timelineLeftPx } from "@/lib/shift-card-service-timeline";
import {
  SHIFT_CARD_OVERNIGHT_MIN_WIDTH_PX,
  shiftClockDurationMinutes,
} from "@/lib/shift-card-proportional-width";



export {

  PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX as AREA_CALENDAR_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,

};



/** Entspricht `p-2` in Bereich-Kalenderzellen. */

export const DASHBOARD_CELL_PADDING_PX = 8;



export type AreaCalendarOvernightSpanGeometry = {

  leftPx: number;

  widthPx: number;

};



export type AreaCalendarOvernightSpanTimeLayout = {
  startTime: string;
  endTime: string;
  startTimeline: ShiftCardServiceTimeline;
  endTimeline: ShiftCardServiceTimeline;
  startDayServiceSpanMin: number;
  endDayServiceSpanMin: number;
};



function areaCalendarCellContentWidthPx(cellRect: DOMRect): number {

  return Math.max(0, cellRect.width - DASHBOARD_CELL_PADDING_PX * 2);

}



/** Zeitpunkt auf der Servicezeit-Timeline innerhalb der Zelle (px ab Zellenrand). */

export function areaCalendarTimeOffsetInCellPx(

  time: string,

  cellContentWidthPx: number,

  timeline: ShiftCardServiceTimeline

): number {

  const padding = SHIFT_CARD_CELL_PADDING_PX;

  const trackWidthPx = Math.max(0, cellContentWidthPx - padding * 2);

  return timelineLeftPx(time, trackWidthPx, timeline, padding);

}



/**
 * Aufgeklappt: Start wie reguläre Schichtkarte (Starttag-Timeline),
 * Ende an der Endzeit auf der Folgetag-Timeline (00:00–Serviceende).
 */
export function computeAreaCalendarExpandedOvernightSpanGeometry(
  startCellRect: DOMRect,
  endCellRect: DOMRect,
  overlayRect: DOMRect,
  layout: AreaCalendarOvernightSpanTimeLayout
): AreaCalendarOvernightSpanGeometry {
  const startContentWidthPx = areaCalendarCellContentWidthPx(startCellRect);
  const endContentWidthPx = areaCalendarCellContentWidthPx(endCellRect);

  const startOffsetPx = areaCalendarTimeOffsetInCellPx(
    layout.startTime,
    startContentWidthPx,
    layout.startTimeline
  );
  const startX =
    startCellRect.left + DASHBOARD_CELL_PADDING_PX + startOffsetPx;

  const endOffsetPx = areaCalendarTimeOffsetInCellPx(
    layout.endTime,
    endContentWidthPx,
    layout.endTimeline
  );
  const endX = endCellRect.left + DASHBOARD_CELL_PADDING_PX + endOffsetPx;

  const measuredWidthPx = Math.max(1, endX - startX);
  const durationMin = shiftClockDurationMinutes(
    layout.startTime,
    layout.endTime
  );
  const widthPx =
    durationMin <= 2 * 60
      ? Math.max(measuredWidthPx, SHIFT_CARD_OVERNIGHT_MIN_WIDTH_PX)
      : measuredWidthPx;

  return {
    leftPx: startX - overlayRect.left,
    widthPx,
  };
}



function dayBorderCenterX(startCellRect: DOMRect, endCellRect: DOMRect): number {

  return (startCellRect.right + endCellRect.left) / 2;

}



/** Eingeklappt: 6px breit, zentriert auf der Tagesgrenzlinie. */

export function measureAreaCalendarCollapsedOvernightSpanGeometry(

  startCellRect: DOMRect,

  endCellRect: DOMRect,

  overlayRect: DOMRect

): AreaCalendarOvernightSpanGeometry {

  const borderCenterX = dayBorderCenterX(startCellRect, endCellRect);

  return {

    leftPx:

      borderCenterX -

      overlayRect.left -

      PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX / 2,

    widthPx: PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,

  };

}



export function measureAreaCalendarOvernightSpanGeometry(

  startCellRect: DOMRect,

  endCellRect: DOMRect,

  overlayRect: DOMRect,

  mode: PlanningOvernightSpanDisplayMode,

  timeLayout?: AreaCalendarOvernightSpanTimeLayout

): AreaCalendarOvernightSpanGeometry {

  if (mode === "expanded") {

    if (!timeLayout) {

      throw new Error("timeLayout required for expanded area calendar overnight span");

    }

    return computeAreaCalendarExpandedOvernightSpanGeometry(

      startCellRect,

      endCellRect,

      overlayRect,

      timeLayout

    );

  }

  return measureAreaCalendarCollapsedOvernightSpanGeometry(

    startCellRect,

    endCellRect,

    overlayRect

  );

}



export function areaCalendarCellDataAttribute(areaId: string, date: string): string {

  return `${areaId}:${date}`;

}


