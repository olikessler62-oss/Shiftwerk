"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { PlanningOvernightSpanCard } from "@/components/planning/planning-overnight-span-card";
import { cn } from "@/lib/cn";
import { isPastCalendarDate } from "@/lib/dates";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import type { PlanningShiftJobContext } from "@/lib/planning-shift-card-display";
import {
  PLANNING_CALENDAR_GRID_TRANSITION_DURATION_MS,
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_CELL_PADDING_PX,
  PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX,
  computePlanningCollapsedMarkerWidthPx,
} from "@/lib/planning-calendar-layout";
import type { PlanningOvernightSpan } from "@/lib/planning-overnight-shift-display";
import { resolveOvernightSpanDisplayMode } from "@/lib/planning-overnight-shift-display";
import {
  measureOvernightSpanGeometry,
  planningOvernightDayCellsLookAdjacent,
  queryPlanningCellInRoot,
  queryPlanningOvernightSpanAnchor,
  type PlanningOvernightSpanGeometry,
} from "@/lib/planning-overnight-span-layout";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import { SHIFT_CARD_TWO_LINE_HEIGHT_PX } from "@/lib/shift-card-row-layout";

type SpanLayout = PlanningOvernightSpanGeometry & {
  displayMode: "expanded" | "collapsed";
  topPx: number;
  heightPx: number;
  collapsedMarkerWidthPx: number;
};

type Props = {
  employeeId: string;
  employeeName: string;
  spans: readonly PlanningOvernightSpan[];
  dayColumnCount: number;
  gridRow: number;
  layoutActiveDayDates: ReadonlySet<string>;
  layoutTransitionEnabled?: boolean;
  employeeColor: string;
  todayISO: string;
  assignmentPresets: readonly DashboardAssignmentPreset[];
  shiftJobContextByDate: ReadonlyMap<string, PlanningShiftJobContext>;
  serviceTimelinesByDate: ReadonlyMap<string, ShiftCardServiceTimeline>;
  dayReferenceShiftTimesByDate: ReadonlyMap<
    string,
    readonly { startTime: string; endTime: string }[]
  >;
  pending: boolean;
  selectedShiftId: string | null;
  onShiftClick: (shiftId: string, startDate: string) => void;
  onShiftContextMenu?: (
    shiftId: string,
    startDate: string,
    event: React.MouseEvent
  ) => void;
  highlightedEmployeeId?: string | null;
};

const COLLAPSED_MARKER_HEIGHT_PX = Math.max(
  1,
  SHIFT_CARD_TWO_LINE_HEIGHT_PX + PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX
);

export function PlanningEmployeeRowOvernightOverlay({
  employeeId,
  employeeName,
  spans,
  dayColumnCount,
  gridRow,
  layoutActiveDayDates,
  layoutTransitionEnabled = false,
  employeeColor,
  todayISO,
  assignmentPresets,
  shiftJobContextByDate,
  serviceTimelinesByDate,
  dayReferenceShiftTimesByDate,
  pending,
  selectedShiftId,
  onShiftClick,
  onShiftContextMenu,
  highlightedEmployeeId = null,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const trackingColumnTransitionRef = useRef(false);
  const layoutDaysKeyRef = useRef<string | null>(null);
  const [layoutsByShiftId, setLayoutsByShiftId] = useState<
    Map<string, SpanLayout>
  >(() => new Map());

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || spans.length === 0) {
      setLayoutsByShiftId(new Map());
      return;
    }

    const calendarGrid = overlay.closest("[data-planning-calendar-grid]");
    const queryRoot: ParentNode = calendarGrid ?? document;

    function measure() {
      if (!overlay) return;
      const overlayRect = overlay.getBoundingClientRect();
      if (overlayRect.width <= 0) return;
      const trackTransition = trackingColumnTransitionRef.current;

      setLayoutsByShiftId((previousLayouts) => {
        const next = new Map<string, SpanLayout>();

        for (const span of spans) {
          const startCell = queryPlanningCellInRoot(
            queryRoot,
            employeeId,
            span.startDate
          );
          const endCell = queryPlanningCellInRoot(
            queryRoot,
            employeeId,
            span.endDate
          );
          if (!startCell || !endCell) continue;

          const displayMode = resolveOvernightSpanDisplayMode(
            span,
            layoutActiveDayDates
          );
          const startCellRect = startCell.getBoundingClientRect();
          const endCellRect = endCell.getBoundingClientRect();
          const serviceTimeline =
            serviceTimelinesByDate.get(span.startDate) ??
            serviceTimelinesByDate.values().next().value!;
          const collapsedMarkerWidthPx = computePlanningCollapsedMarkerWidthPx(
            Math.max(0, startCellRect.width - PLANNING_CELL_PADDING_PX * 2),
            dayReferenceShiftTimesByDate.get(span.startDate) ?? [
              {
                startTime: span.shift.startTime,
                endTime: span.shift.endTime,
              },
            ],
            serviceTimeline
          );

          if (
            !trackTransition &&
            displayMode === "collapsed" &&
            !planningOvernightDayCellsLookAdjacent(startCellRect, endCellRect)
          ) {
            const previous = previousLayouts.get(span.shift.id);
            if (previous) {
              next.set(span.shift.id, previous);
            }
            continue;
          }

          const geometry = measureOvernightSpanGeometry(
            startCellRect,
            endCellRect,
            overlayRect,
            displayMode,
            collapsedMarkerWidthPx
          );

          if (
            !trackTransition &&
            displayMode === "collapsed" &&
            (!Number.isFinite(geometry.leftPx) ||
              geometry.leftPx < -collapsedMarkerWidthPx ||
              geometry.leftPx > overlayRect.width)
          ) {
            const previous = previousLayouts.get(span.shift.id);
            if (previous) {
              next.set(span.shift.id, previous);
            }
            continue;
          }

          if (
            trackTransition &&
            displayMode === "collapsed" &&
            !Number.isFinite(geometry.leftPx)
          ) {
            continue;
          }

          const anchor = queryPlanningOvernightSpanAnchor(
            queryRoot,
            span.shift.id
          );
          const anchorRect = anchor?.getBoundingClientRect();

          let topPx: number;
          let heightPx: number;

          if (displayMode === "expanded") {
            topPx = PLANNING_CELL_PADDING_PX;
            heightPx = Math.max(
              PLANNING_CELL_HEIGHT_PX,
              startCellRect.height - PLANNING_CELL_PADDING_PX * 2
            );
          } else if (anchorRect) {
            topPx =
              anchorRect.top +
              anchorRect.height / 2 -
              overlayRect.top -
              COLLAPSED_MARKER_HEIGHT_PX / 2;
            heightPx = COLLAPSED_MARKER_HEIGHT_PX;
          } else {
            topPx =
              PLANNING_CELL_PADDING_PX +
              (PLANNING_CELL_HEIGHT_PX - COLLAPSED_MARKER_HEIGHT_PX) / 2;
            heightPx = COLLAPSED_MARKER_HEIGHT_PX;
          }

          next.set(span.shift.id, {
            ...geometry,
            displayMode,
            topPx,
            heightPx,
            collapsedMarkerWidthPx,
          });
        }

        return next;
      });
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(overlay);

    for (const span of spans) {
      const startCell = queryPlanningCellInRoot(
        queryRoot,
        employeeId,
        span.startDate
      );
      const endCell = queryPlanningCellInRoot(
        queryRoot,
        employeeId,
        span.endDate
      );
      const anchor = queryPlanningOvernightSpanAnchor(queryRoot, span.shift.id);
      if (startCell) observer.observe(startCell);
      if (endCell) observer.observe(endCell);
      if (anchor) observer.observe(anchor);
    }

    let transitionRafId = 0;
    let transitionTrackingStopped = false;

    function stopTransitionTracking() {
      if (transitionTrackingStopped) return;
      transitionTrackingStopped = true;
      trackingColumnTransitionRef.current = false;
      cancelAnimationFrame(transitionRafId);
      measure();
    }

    function startTransitionTracking(): (() => void) | undefined {
      if (!layoutTransitionEnabled || !calendarGrid) return undefined;

      transitionTrackingStopped = false;
      trackingColumnTransitionRef.current = true;

      const tick = () => {
        if (transitionTrackingStopped) return;
        measure();
        transitionRafId = requestAnimationFrame(tick);
      };

      transitionRafId = requestAnimationFrame(tick);

      const handleTransitionEnd = (event: TransitionEvent) => {
        if (event.target !== calendarGrid) return;
        if (
          event.propertyName === "grid-template-columns" ||
          event.propertyName === "min-width"
        ) {
          stopTransitionTracking();
        }
      };

      calendarGrid.addEventListener("transitionend", handleTransitionEnd);
      const fallbackTimer = window.setTimeout(
        stopTransitionTracking,
        PLANNING_CALENDAR_GRID_TRANSITION_DURATION_MS + 32
      );

      return () => {
        calendarGrid.removeEventListener("transitionend", handleTransitionEnd);
        window.clearTimeout(fallbackTimer);
        stopTransitionTracking();
      };
    }

    const layoutDaysKey = [...layoutActiveDayDates].sort().join("|");
    const shouldTrackColumnTransition =
      layoutTransitionEnabled &&
      layoutDaysKeyRef.current !== null &&
      layoutDaysKeyRef.current !== layoutDaysKey;
    layoutDaysKeyRef.current = layoutDaysKey;

    const stopTransitionTrackingCleanup = shouldTrackColumnTransition
      ? startTransitionTracking()
      : undefined;

    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      stopTransitionTrackingCleanup?.();
      stopTransitionTracking();
      window.removeEventListener("scroll", measure, true);
    };
  }, [
    employeeId,
    spans,
    layoutActiveDayDates,
    layoutTransitionEnabled,
    dayColumnCount,
    serviceTimelinesByDate,
    dayReferenceShiftTimesByDate,
  ]);

  if (spans.length === 0) return null;

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none relative z-30 min-h-0 self-stretch"
      style={{
        gridColumn: `2 / span ${dayColumnCount}`,
        gridRow,
      }}
    >
      {spans.map((span) => {
        const layout = layoutsByShiftId.get(span.shift.id);
        if (!layout) return null;

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
                ? "flex items-stretch"
                : "flex items-center"
            )}
            style={{
              left: layout.leftPx,
              width:
                layout.displayMode === "collapsed"
                  ? layout.collapsedMarkerWidthPx
                  : layout.widthPx,
              top: layout.topPx,
              height: layout.heightPx,
            }}
          >
            <PlanningOvernightSpanCard
              shift={span.shift}
              widthPx={layout.widthPx}
              displayMode={layout.displayMode}
              collapsedMarkerWidthPx={layout.collapsedMarkerWidthPx}
              employeeName={employeeName}
              employeeColor={employeeColor}
              isPastDay={isPastDay}
              assignmentPresets={assignmentPresets}
              shiftJobContext={shiftJobContextByDate.get(span.startDate)!}
              pending={pending}
              isSelected={isSelected}
              onShiftClick={() => onShiftClick(span.shift.id, span.startDate)}
              onShiftContextMenu={
                onShiftContextMenu
                  ? (event) =>
                      onShiftContextMenu(span.shift.id, span.startDate, event)
                  : undefined
              }
              employeeHighlighted={
                layout.displayMode === "expanded" &&
                highlightedEmployeeId !== null &&
                highlightedEmployeeId === employeeId
              }
            />
          </div>
        );
      })}
    </div>
  );
}
