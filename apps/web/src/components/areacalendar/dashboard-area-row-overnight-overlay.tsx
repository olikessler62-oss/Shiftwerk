"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DashboardOvernightSpanCard,
  dashboardOvernightSpanRowHeightPx,
} from "@/components/dashboard/dashboard-overnight-span-card";
import {
  buildShiftCardDisplayContent,
} from "@/components/dashboard/dashboard-shift-card-view";
import {
  resolveJobLabelsForShiftAssignment,
} from "@/lib/shift-card-display-content";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { isPastCalendarDate } from "@/lib/dates";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import type { DashboardOvernightSpan } from "@/lib/dashboard-overnight-shift-display";
import { resolveDashboardOvernightSpanDisplayMode } from "@/lib/dashboard-overnight-shift-display";
import {
  dashboardCellDataAttribute,
  DASHBOARD_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,
  measureDashboardOvernightSpanGeometry,
  type DashboardOvernightSpanGeometry,
} from "@/lib/dashboard-overnight-span-layout";
import { PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX } from "@/lib/planning-calendar-layout";
import {
  dashboardEndDayServiceSpanMinutesForOvernightWidth,
  dashboardEndDayServiceSpanMinutesForOvernightWidthLocation,
  dashboardStartDayServiceSpanMinutesForOvernightWidth,
  dashboardStartDayServiceSpanMinutesForOvernightWidthLocation,
  resolveDashboardAreaServiceDayTimeline,
  resolveDashboardLocationServiceDayTimeline,
  resolveDashboardOvernightEndDayTimeline,
} from "@/lib/dashboard-service-day-timeline";
import { SHIFT_CARD_TWO_LINE_HEIGHT_PX, AREA_ROW_FOOTER_STRIP_PX } from "@/lib/shift-card-row-layout";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { LocationAreaStaffing } from "@schichtwerk/types";

type SpanLayout = DashboardOvernightSpanGeometry & {
  displayMode: "expanded" | "collapsed";
  topPx: number;
  heightPx: number;
};

type Props = {
  areaId: string;
  spans: readonly DashboardOvernightSpan[];
  dayColumnCount: number;
  gridRow: number;
  layoutActiveDayDates: ReadonlySet<string>;
  layoutActiveAreaIds: ReadonlySet<string>;
  todayISO: string;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  assignmentPresets: readonly DashboardAssignmentPreset[];
  profileQualificationIds: Record<string, string[]>;
  qualificationNameById: ReadonlyMap<string, string>;
  qualificationSortOrder: ReadonlyMap<string, number>;
  pending?: boolean;
  selectedShiftId?: string | null;
  onShiftClick?: (shift: DashboardOvernightSpan["shift"]) => void;
  onShiftContextMenu?: (
    shift: DashboardOvernightSpan["shift"],
    event: React.MouseEvent
  ) => void;
  /** Einfache Planung ohne Bereichs-Spalte — Bereich gilt immer als aufgeklappt. */
  forceAreaExpanded?: boolean;
  highlightedEmployeeId?: string | null;
};

function queryDashboardCell(areaId: string, date: string): HTMLElement | null {
  return document.querySelector(
    `[data-dashboard-cell="${dashboardCellDataAttribute(areaId, date)}"]`
  );
}

function queryOvernightAnchor(shiftId: string): HTMLElement | null {
  return document.querySelector(
    `[data-dashboard-overnight-span-anchor="${shiftId}"]`
  );
}

function clampCollapsedOvernightTopPx(
  topPx: number,
  heightPx: number,
  cell: HTMLElement,
  overlayRect: DOMRect
): number {
  const cellRect = cell.getBoundingClientRect();
  const footerInsetPx = cell.querySelector("[data-dashboard-area-cell-footer]")
    ? AREA_ROW_FOOTER_STRIP_PX
    : 0;
  const contentBottomPx =
    cellRect.bottom - overlayRect.top - footerInsetPx;
  return Math.max(0, Math.min(topPx, contentBottomPx - heightPx));
}

function resolveDashboardStartDayTimeline(
  dateISO: string,
  areaId: string,
  serviceHours: readonly AreaServiceHourRef[]
) {
  if (areaId) {
    return resolveDashboardAreaServiceDayTimeline(serviceHours, areaId, dateISO);
  }
  return resolveDashboardLocationServiceDayTimeline(serviceHours, dateISO);
}

function resolveDashboardEndDayTimeline(
  dateISO: string,
  areaId: string,
  serviceHours: readonly AreaServiceHourRef[]
) {
  return resolveDashboardOvernightEndDayTimeline(serviceHours, areaId, dateISO);
}

function resolveDashboardOvernightServiceSpans(
  areaId: string,
  startDate: string,
  endDate: string,
  serviceHours: readonly AreaServiceHourRef[]
): { startDayServiceSpanMin: number; endDayServiceSpanMin: number } {
  if (areaId) {
    return {
      startDayServiceSpanMin: dashboardStartDayServiceSpanMinutesForOvernightWidth(
        serviceHours,
        areaId,
        startDate
      ),
      endDayServiceSpanMin: dashboardEndDayServiceSpanMinutesForOvernightWidth(
        serviceHours,
        areaId,
        endDate
      ),
    };
  }
  return {
    startDayServiceSpanMin:
      dashboardStartDayServiceSpanMinutesForOvernightWidthLocation(
        serviceHours,
        startDate
      ),
    endDayServiceSpanMin:
      dashboardEndDayServiceSpanMinutesForOvernightWidthLocation(
        serviceHours,
        endDate
      ),
  };
}

const COLLAPSED_MARKER_HEIGHT_PX = Math.max(
  1,
  SHIFT_CARD_TWO_LINE_HEIGHT_PX + PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX
);

export function DashboardAreaRowOvernightOverlay({
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
      formatJobTooltipLine: (names: string) =>
        t("common.shiftCardTooltipJob", { names }),
    };
    const map = new Map<string, ReturnType<typeof buildShiftCardDisplayContent>>();
    for (const span of spans) {
      const jobsLabel = resolveJobLabelsForShiftAssignment(
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
        const startCell = queryDashboardCell(areaId, span.startDate);
        const endCell = queryDashboardCell(areaId, span.endDate);
        if (!startCell || !endCell) continue;

        const displayMode = resolveDashboardOvernightSpanDisplayMode(
          span,
          layoutActiveDayDates,
          layoutActiveAreaIds,
          { forceAreaExpanded }
        );
        const geometry = measureDashboardOvernightSpanGeometry(
          startCell.getBoundingClientRect(),
          endCell.getBoundingClientRect(),
          overlayRect,
          displayMode,
          displayMode === "expanded"
            ? {
                startTime: span.shift.startTime,
                endTime: span.shift.endTime,
                startTimeline: resolveDashboardStartDayTimeline(
                  span.startDate,
                  areaId,
                  serviceHours
                ),
                endTimeline: resolveDashboardEndDayTimeline(
                  span.endDate,
                  areaId,
                  serviceHours
                ),
                ...resolveDashboardOvernightServiceSpans(
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
        const expandedRowHeightPx = dashboardOvernightSpanRowHeightPx();

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
            (anchor?.closest("[data-dashboard-cell]") as HTMLElement | null) ??
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
      const startCell = queryDashboardCell(areaId, span.startDate);
      const endCell = queryDashboardCell(areaId, span.endDate);
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
      className="pointer-events-none relative z-30"
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
                  ? DASHBOARD_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX
                  : layout.widthPx,
              top: layout.topPx,
              height: layout.heightPx,
            }}
          >
            <DashboardOvernightSpanCard
              shift={span.shift}
              display={display}
              widthPx={layout.widthPx}
              displayMode={layout.displayMode}
              isPastDay={isPastDay}
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
