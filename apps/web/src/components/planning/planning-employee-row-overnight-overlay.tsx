"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { PlanningOvernightSpanCard } from "@/components/planning/planning-overnight-span-card";
import { cn } from "@/lib/cn";
import { isPastCalendarDate } from "@/lib/dates";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import type { PlanningShiftJobContext } from "@/lib/planning-shift-card-display";
import {
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_CELL_PADDING_PX,
  PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX,
} from "@/lib/planning-calendar-layout";
import type { PlanningOvernightSpan } from "@/lib/planning-overnight-shift-display";
import { resolveOvernightSpanDisplayMode } from "@/lib/planning-overnight-shift-display";
import {
  measureOvernightSpanGeometry,
  planningCellDataAttribute,
  PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,
  type PlanningOvernightSpanGeometry,
} from "@/lib/planning-overnight-span-layout";
import { SHIFT_CARD_TWO_LINE_HEIGHT_PX } from "@/lib/shift-card-row-layout";

type SpanLayout = PlanningOvernightSpanGeometry & {
  displayMode: "expanded" | "collapsed";
};

type Props = {
  employeeId: string;
  employeeName: string;
  spans: readonly PlanningOvernightSpan[];
  dayColumnCount: number;
  gridRow: number;
  layoutActiveDayDates: ReadonlySet<string>;
  employeeColor: string;
  todayISO: string;
  assignmentPresets: readonly DashboardAssignmentPreset[];
  shiftJobContextByDate: ReadonlyMap<string, PlanningShiftJobContext>;
  pending: boolean;
  selectedShiftId: string | null;
  onShiftClick: (shiftId: string, startDate: string) => void;
  onShiftContextMenu?: (
    shiftId: string,
    startDate: string,
    event: React.MouseEvent
  ) => void;
};

function queryPlanningCell(
  employeeId: string,
  date: string
): HTMLElement | null {
  return document.querySelector(
    `[data-planning-cell="${planningCellDataAttribute(employeeId, date)}"]`
  );
}

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
  employeeColor,
  todayISO,
  assignmentPresets,
  shiftJobContextByDate,
  pending,
  selectedShiftId,
  onShiftClick,
  onShiftContextMenu,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [layoutsByShiftId, setLayoutsByShiftId] = useState<
    Map<string, SpanLayout>
  >(() => new Map());

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || spans.length === 0) {
      setLayoutsByShiftId(new Map());
      return;
    }

    function measure() {
      if (!overlay) return;
      const overlayRect = overlay.getBoundingClientRect();
      const next = new Map<string, SpanLayout>();

      for (const span of spans) {
        const startCell = queryPlanningCell(employeeId, span.startDate);
        const endCell = queryPlanningCell(employeeId, span.endDate);
        if (!startCell || !endCell) continue;

        const displayMode = resolveOvernightSpanDisplayMode(
          span,
          layoutActiveDayDates
        );
        const geometry = measureOvernightSpanGeometry(
          startCell.getBoundingClientRect(),
          endCell.getBoundingClientRect(),
          overlayRect,
          displayMode
        );
        next.set(span.shift.id, { ...geometry, displayMode });
      }

      setLayoutsByShiftId(next);
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(overlay);

    for (const span of spans) {
      const startCell = queryPlanningCell(employeeId, span.startDate);
      const endCell = queryPlanningCell(employeeId, span.endDate);
      if (startCell) observer.observe(startCell);
      if (endCell) observer.observe(endCell);
    }

    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
    };
  }, [employeeId, spans, layoutActiveDayDates]);

  if (spans.length === 0) return null;

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
        if (!layout) return null;

        const isPastDay =
          isPastCalendarDate(span.startDate, todayISO) &&
          isPastCalendarDate(span.endDate, todayISO);
        const isSelected = selectedShiftId === span.shift.id;
        const topPx =
          layout.displayMode === "expanded"
            ? PLANNING_CELL_PADDING_PX
            : PLANNING_CELL_PADDING_PX +
              (PLANNING_CELL_HEIGHT_PX - COLLAPSED_MARKER_HEIGHT_PX) / 2;

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
                  ? PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX
                  : layout.widthPx,
              top: topPx,
              height:
                layout.displayMode === "expanded"
                  ? PLANNING_CELL_HEIGHT_PX
                  : COLLAPSED_MARKER_HEIGHT_PX,
            }}
          >
            <PlanningOvernightSpanCard
              shift={span.shift}
              widthPx={layout.widthPx}
              displayMode={layout.displayMode}
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
            />
          </div>
        );
      })}
    </div>
  );
}
