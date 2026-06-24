"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AreaCalendarOvernightSpanCard,
  areaCalendarOvernightSpanRowHeightPx,
} from "@/components/areacalendar/areacalendar-overnight-span-card";
import {
  buildShiftCardDisplayContent,
} from "@/components/areacalendar/areacalendar-shift-card-view";
import {
  resolveJobLabelsForShiftAssignment,
} from "@/lib/shift-card-display-content";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { isPastCalendarDate } from "@/lib/dates";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import type { AreaCalendarOvernightSpan } from "@/lib/areacalendar-overnight-shift-display";
import { resolveAreaCalendarOvernightSpanDisplayMode } from "@/lib/areacalendar-overnight-shift-display";
import {
  areaCalendarCellDataAttribute,
  AREA_CALENDAR_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,
  measureAreaCalendarOvernightSpanGeometry,
  type AreaCalendarOvernightSpanGeometry,
} from "@/lib/areacalendar-overnight-span-layout";
import { PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX } from "@/lib/planning-calendar-layout";
import {
  areaCalendarEndDayServiceSpanMinutesForOvernightWidth,
  areaCalendarEndDayServiceSpanMinutesForOvernightWidthLocation,
  areaCalendarStartDayServiceSpanMinutesForOvernightWidth,
  areaCalendarStartDayServiceSpanMinutesForOvernightWidthLocation,
  resolveAreaCalendarAreaServiceDayTimeline,
  resolveAreaCalendarLocationServiceDayTimeline,
  resolveAreaCalendarOvernightEndDayTimeline,
} from "@/lib/areacalendar-service-day-timeline";
import { AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX, AREA_ROW_FOOTER_STRIP_PX } from "@/lib/shift-card-row-layout";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { LocationAreaStaffing } from "@schichtwerk/types";

type SpanLayout = AreaCalendarOvernightSpanGeometry & {
  displayMode: "expanded" | "collapsed";
  topPx: number;
  heightPx: number;
};

type Props = {
  areaId: string;
  spans: readonly AreaCalendarOvernightSpan[];
  dayColumnCount: number;
  gridRow: number;
  layoutActiveDayDates: ReadonlySet<string>;
  layoutActiveAreaIds: ReadonlySet<string>;
  todayISO: string;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  profileQualificationIds: Record<string, string[]>;
  qualificationNameById: ReadonlyMap<string, string>;
  qualificationSortOrder: ReadonlyMap<string, number>;
  pending?: boolean;
  selectedShiftId?: string | null;
  onShiftClick?: (shift: AreaCalendarOvernightSpan["shift"]) => void;
  onShiftContextMenu?: (
    shift: AreaCalendarOvernightSpan["shift"],
    event: React.MouseEvent
  ) => void;
  /** Einfache Planung ohne Bereichs-Spalte — Bereich gilt immer als aufgeklappt. */
  forceAreaExpanded?: boolean;
  highlightedEmployeeId?: string | null;
};

function queryAreaCalendarCell(areaId: string, date: string): HTMLElement | null {
  return document.querySelector(
    `[data-areacalendar-cell="${areaCalendarCellDataAttribute(areaId, date)}"]`
  );
}

function queryOvernightAnchor(shiftId: string): HTMLElement | null {
  return document.querySelector(
    `[data-areacalendar-overnight-span-anchor="${shiftId}"]`
  );
}

function clampCollapsedOvernightTopPx(
  topPx: number,
  heightPx: number,
  cell: HTMLElement,
  overlayRect: DOMRect
): number {
  const cellRect = cell.getBoundingClientRect();
  const footerInsetPx = cell.querySelector("[data-areacalendar-area-cell-footer]")
    ? AREA_ROW_FOOTER_STRIP_PX
    : 0;
  const contentBottomPx =
    cellRect.bottom - overlayRect.top - footerInsetPx;
  return Math.max(0, Math.min(topPx, contentBottomPx - heightPx));
}

function resolveAreaCalendarStartDayTimeline(
  dateISO: string,
  areaId: string,
  serviceHours: readonly AreaServiceHourRef[]
) {
  if (areaId) {
    return resolveAreaCalendarAreaServiceDayTimeline(serviceHours, areaId, dateISO);
  }
  return resolveAreaCalendarLocationServiceDayTimeline(serviceHours, dateISO);
}

function resolveAreaCalendarEndDayTimeline(
  dateISO: string,
  areaId: string,
  serviceHours: readonly AreaServiceHourRef[]
) {
  return resolveAreaCalendarOvernightEndDayTimeline(serviceHours, areaId, dateISO);
}

function resolveAreaCalendarOvernightServiceSpans(
  areaId: string,
  startDate: string,
  endDate: string,
  serviceHours: readonly AreaServiceHourRef[]
): { startDayServiceSpanMin: number; endDayServiceSpanMin: number } {
  if (areaId) {
    return {
      startDayServiceSpanMin: areaCalendarStartDayServiceSpanMinutesForOvernightWidth(
        serviceHours,
        areaId,
        startDate
      ),
      endDayServiceSpanMin: areaCalendarEndDayServiceSpanMinutesForOvernightWidth(
        serviceHours,
        areaId,
        endDate
      ),
    };
  }
  return {
    startDayServiceSpanMin:
      areaCalendarStartDayServiceSpanMinutesForOvernightWidthLocation(
        serviceHours,
        startDate
      ),
    endDayServiceSpanMin:
      areaCalendarEndDayServiceSpanMinutesForOvernightWidthLocation(
        serviceHours,
        endDate
      ),
  };
}

const COLLAPSED_MARKER_HEIGHT_PX = Math.max(
  1,
  AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX + PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX
);

export function AreaCalendarAreaRowOvernightOverlay({
  areaId,
  spans,
  dayColumnCount,
  gridRow,
  layoutActiveDayDates,
  layoutActiveAreaIds,
  todayISO,
  serviceHours,
  staffingRules,
  assignmentPresets,
  profileQualificationIds,
  qualificationNameById,
  qualificationSortOrder,
  pending = false,
  selectedShiftId = null,
  onShiftClick,
  onShiftContextMenu,
  forceAreaExpanded = false,
  highlightedEmployeeId = null,
}: Props) {
  const t = useTranslations();
  const areaRowExpanded =
    forceAreaExpanded || layoutActiveAreaIds.has(areaId);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [layoutsByShiftId, setLayoutsByShiftId] = useState<
    Map<string, SpanLayout>
  >(() => new Map());

  const displayByShiftId = useMemo(() => {
    const tooltipOptions = {
      assignmentPresets,
      formatShiftTooltipLine: (name: string) =>
        t("common.shiftCardTooltipShift", { name }),
      formatDeploymentTimeTooltipLine: () =>
        t("common.shiftCardTooltipDeploymentTimeLabel"),
      formatJobTooltipLine: (names: string) =>
        t("common.shiftCardTooltipJob", { names }),
    };
    const map = new Map<string, ReturnType<typeof buildShiftCardDisplayContent>>();
    for (const span of spans) {
      const jobsLabel =
        span.shift.jobName?.trim() ??
        resolveJobLabelsForShiftAssignment(
          span.shift.employeeId,
          span.shift.locationAreaId ?? areaId,
          span.startDate,
          span.shift.startTime,
          span.shift.endTime,
          staffingRules,
          serviceHours,
          assignmentPresets,
          profileQualificationIds,
          qualificationNameById,
          qualificationSortOrder
        );
      map.set(
        span.shift.id,
        buildShiftCardDisplayContent(span.shift, jobsLabel, tooltipOptions)
      );
    }
    return map;
  }, [
    spans,
    areaId,
    serviceHours,
    staffingRules,
    assignmentPresets,
    profileQualificationIds,
    qualificationNameById,
    qualificationSortOrder,
    t,
  ]);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || spans.length === 0 || !areaRowExpanded) {
      setLayoutsByShiftId(new Map());
      return;
    }

    function measure() {
      if (!overlay) return;
      const overlayRect = overlay.getBoundingClientRect();
      const next = new Map<string, SpanLayout>();

      for (const span of spans) {
        const startCell = queryAreaCalendarCell(areaId, span.startDate);
        const endCell = queryAreaCalendarCell(areaId, span.endDate);
        if (!startCell || !endCell) continue;

        const displayMode = resolveAreaCalendarOvernightSpanDisplayMode(
          span,
          layoutActiveDayDates,
          layoutActiveAreaIds,
          { forceAreaExpanded }
        );
        const geometry = measureAreaCalendarOvernightSpanGeometry(
          startCell.getBoundingClientRect(),
          endCell.getBoundingClientRect(),
          overlayRect,
          displayMode,
          displayMode === "expanded"
            ? {
                startTime: span.shift.startTime,
                endTime: span.shift.endTime,
                startTimeline: resolveAreaCalendarStartDayTimeline(
                  span.startDate,
                  areaId,
                  serviceHours
                ),
                endTimeline: resolveAreaCalendarEndDayTimeline(
                  span.endDate,
                  areaId,
                  serviceHours
                ),
                ...resolveAreaCalendarOvernightServiceSpans(
                  areaId,
                  span.startDate,
                  span.endDate,
                  serviceHours
                ),
              }
            : undefined
        );

        const anchor = queryOvernightAnchor(span.shift.id);
        const anchorRect = anchor?.getBoundingClientRect();
        const expandedRowHeightPx = areaCalendarOvernightSpanRowHeightPx();

        let topPx: number;
        let heightPx: number;

        if (anchorRect) {
          if (displayMode === "expanded") {
            topPx = anchorRect.top - overlayRect.top;
            heightPx = expandedRowHeightPx;
          } else {
            topPx =
              anchorRect.top +
              anchorRect.height / 2 -
              overlayRect.top -
              COLLAPSED_MARKER_HEIGHT_PX / 2;
            heightPx = COLLAPSED_MARKER_HEIGHT_PX;
          }
        } else if (displayMode === "expanded") {
          topPx = 0;
          heightPx = expandedRowHeightPx;
        } else {
          topPx = 0;
          heightPx = COLLAPSED_MARKER_HEIGHT_PX;
        }

        if (displayMode === "collapsed") {
          const clampCell =
            (anchor?.closest("[data-areacalendar-cell]") as HTMLElement | null) ??
            startCell ??
            endCell;
          if (clampCell) {
            topPx = clampCollapsedOvernightTopPx(
              topPx,
              heightPx,
              clampCell,
              overlayRect
            );
          }
        }

        next.set(span.shift.id, {
          ...geometry,
          displayMode,
          topPx,
          heightPx,
        });
      }

      setLayoutsByShiftId(next);
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(overlay);

    for (const span of spans) {
      const startCell = queryAreaCalendarCell(areaId, span.startDate);
      const endCell = queryAreaCalendarCell(areaId, span.endDate);
      const anchor = queryOvernightAnchor(span.shift.id);
      if (startCell) observer.observe(startCell);
      if (endCell) observer.observe(endCell);
      if (anchor) observer.observe(anchor);
    }

    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
    };
  }, [
    areaId,
    spans,
    layoutActiveDayDates,
    layoutActiveAreaIds,
    forceAreaExpanded,
    serviceHours,
    areaRowExpanded,
  ]);

  if (spans.length === 0 || !areaRowExpanded) return null;

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none relative z-50 min-h-0 self-stretch"
      style={{
        gridColumn: `2 / span ${dayColumnCount}`,
        gridRow,
      }}
    >
      {spans.map((span) => {
        const layout = layoutsByShiftId.get(span.shift.id);
        const display = displayByShiftId.get(span.shift.id);
        if (!layout || !display) return null;

        const isPastDay =
          isPastCalendarDate(span.startDate, todayISO) &&
          isPastCalendarDate(span.endDate, todayISO);
        const isSelected = selectedShiftId === span.shift.id;

        return (
          <div
            key={span.shift.id}
            className={cn(
              "pointer-events-auto absolute min-w-0",
              layout.displayMode === "expanded"
                ? "flex items-start"
                : "flex items-center"
            )}
            style={{
              left: layout.leftPx,
              width:
                layout.displayMode === "collapsed"
                  ? AREA_CALENDAR_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX
                  : layout.widthPx,
              top: layout.topPx,
              height: layout.heightPx,
            }}
          >
            <AreaCalendarOvernightSpanCard
              shift={span.shift}
              display={display}
              widthPx={layout.widthPx}
              displayMode={layout.displayMode}
              isPastDay={isPastDay}
              cellDate={span.startDate}
              pending={pending}
              isSelected={isSelected}
              employeeHighlighted={
                layout.displayMode === "expanded" &&
                highlightedEmployeeId !== null &&
                span.shift.employeeId === highlightedEmployeeId
              }
              onShiftClick={() => onShiftClick?.(span.shift)}
              onShiftContextMenu={
                onShiftContextMenu
                  ? (event) => onShiftContextMenu(span.shift, event)
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
