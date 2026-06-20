"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX,
  computePlanningCollapsedMarkerWidthPx,
} from "@/lib/planning-calendar-layout";
import { buildPlanningShiftSegmentTimeLabel } from "@/lib/planning-shift-card-display";
import {
  comparePlanningShiftDisplaySegments,
  type PlanningShiftDisplaySegment,
} from "@/lib/planning-overnight-shift-display";
import { COLLAPSED_PAST_DAY_SHIFT_COLOR } from "@/lib/shift-card-cell-layout";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import { SHIFT_CARD_TWO_LINE_HEIGHT_PX } from "@/lib/shift-card-row-layout";
import { isPastShiftDate } from "@/lib/planning-readonly";
import {
  preventPointerTextSelection,
  SHIFT_CARD_INTERACTIVE_CLASS,
} from "@/lib/calendar-interaction-ui";
import {
  canOpenShiftCardContextMenu,
  handleShiftCardContextMenuPointerEvent,
  planningShiftCardShowsPointerCursor,
} from "@/lib/shift-card-context-menu-actions";

const COLLAPSED_MARKER_GAP_PX = 3;

type Props = {
  segments: PlanningShiftDisplaySegment[];
  /** Alle Schichten des Tages (Standort) — für einheitliche schmale Breite. */
  dayReferenceShiftTimes: readonly { startTime: string; endTime: string }[];
  serviceTimeline: ShiftCardServiceTimeline;
  employeeColor: string;
  isPastDay: boolean;
  cellDate: string;
  pending: boolean;
  selectedShiftId: string | null;
  onShiftClick: (shiftId: string) => void;
  /** Rechtsklick auf eingeklappte Schichtmarkierung. */
  onShiftContextMenu?: (shiftId: string, event: React.MouseEvent) => void;
  /** Linksklick auf freien Zellbereich neben Schichtkarten — neue Schicht. */
  onEmptyAreaClick?: () => void;
  emptyAreaDisabled?: boolean;
  emptyAreaLabel?: string;
};

export function DashboardCellCollapsedShiftMarkers({
  segments,
  dayReferenceShiftTimes,
  serviceTimeline,
  employeeColor,
  isPastDay,
  cellDate,
  pending,
  selectedShiftId,
  onShiftClick,
  onShiftContextMenu,
  onEmptyAreaClick,
  emptyAreaDisabled = false,
  emptyAreaLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellWidthPx, setCellWidthPx] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function updateWidth() {
      if (!container) return;
      setCellWidthPx(container.clientWidth);
    }

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [segments.length]);

  const sortedSegments = useMemo(
    () => [...segments].sort(comparePlanningShiftDisplaySegments),
    [segments]
  );

  const markerHeightPx = Math.max(
    1,
    SHIFT_CARD_TWO_LINE_HEIGHT_PX + PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX
  );

  const markerWidthPx = useMemo(() => {
    return computePlanningCollapsedMarkerWidthPx(
      cellWidthPx,
      dayReferenceShiftTimes.length > 0
        ? dayReferenceShiftTimes
        : sortedSegments.map((segment) => ({
            startTime: segment.shift.startTime,
            endTime: segment.shift.endTime,
          })),
      serviceTimeline
    );
  }, [cellWidthPx, dayReferenceShiftTimes, sortedSegments, serviceTimeline]);

  if (sortedSegments.length === 0) return null;

  const markerColor = isPastDay ? COLLAPSED_PAST_DAY_SHIFT_COLOR : employeeColor;

  return (
    <div
      ref={containerRef}
      className="relative flex w-full min-w-0 flex-1 items-center overflow-visible"
      style={{ minHeight: PLANNING_CELL_HEIGHT_PX, gap: COLLAPSED_MARKER_GAP_PX }}
    >
      {sortedSegments.map((segment) => {
        const { shift, part } = segment;
        const segmentKey = `${shift.id}:${part}`;
        const isSelected = selectedShiftId === shift.id;
        const timeLabel = buildPlanningShiftSegmentTimeLabel(
          part,
          shift.startTime,
          shift.endTime
        );
        const label = shift.shiftName
          ? `${shift.shiftName} ${timeLabel}`
          : timeLabel;
        const showsPointerCursor = planningShiftCardShowsPointerCursor(
          {
            shift_date: shift.shift_date,
            confirmationStatus: shift.confirmationStatus,
            requestedAt: shift.requestedAt,
          },
          cellDate,
          isPastShiftDate
        );

        return (
          <button
            key={segmentKey}
            type="button"
            disabled={pending}
            onMouseDown={preventPointerTextSelection}
            onClick={() => onShiftClick(shift.id)}
            onContextMenu={
              onShiftContextMenu
                ? (event) => {
                    handleShiftCardContextMenuPointerEvent(
                      event,
                      canOpenShiftCardContextMenu(
                        shift.confirmationStatus,
                        shift.requestedAt,
                        { shiftDate: shift.shift_date, cellDate, isPastShiftDate, displayState: shift.displayState }
                      ),
                      () => onShiftContextMenu(shift.id, event)
                    );
                  }
                : undefined
            }
            className={cn(
              "shrink-0 border-0 p-0 shadow-sm transition disabled:opacity-50",
              SHIFT_CARD_INTERACTIVE_CLASS,
              showsPointerCursor
                ? "cursor-pointer hover:opacity-90"
                : "!cursor-default",
              part === "full" && "rounded-sm",
              isSelected && "ring-2 ring-primary ring-offset-1"
            )}
            style={{
              width: markerWidthPx,
              height: markerHeightPx,
              backgroundColor: markerColor,
            }}
            aria-label={label}
            title={label}
          />
        );
      })}
      {onEmptyAreaClick ? (
        <button
          type="button"
          disabled={emptyAreaDisabled}
          onClick={onEmptyAreaClick}
          className="min-w-0 flex-1 self-stretch border-0 bg-transparent p-0 disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-primary/5"
          aria-label={emptyAreaLabel}
        />
      ) : null}
    </div>
  );
}
