"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX,
  PLANNING_COLLAPSED_SHIFT_WIDTH_DELTA_PX,
  PLANNING_CELL_PADDING_PX,
} from "@/lib/planning-calendar-layout";
import { buildPlanningShiftSegmentTimeLabel } from "@/lib/planning-shift-card-display";
import {
  comparePlanningShiftDisplaySegments,
  planningCollapsedOvernightSegmentWidthPx,
  type PlanningShiftDisplaySegment,
} from "@/lib/planning-overnight-shift-display";
import {
  COLLAPSED_PAST_DAY_SHIFT_COLOR,
  computePastDayUniformLineWidthPx,
} from "@/lib/shift-card-cell-layout";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import { SHIFT_CARD_TWO_LINE_HEIGHT_PX } from "@/lib/shift-card-row-layout";

const COLLAPSED_MARKER_GAP_PX = 3;

type Props = {
  segments: PlanningShiftDisplaySegment[];
  /** Alle Schichten des Tages (Standort) — einheitliche schmale Breite. */
  dayReferenceShiftTimes: readonly { startTime: string; endTime: string }[];
  serviceTimeline: ShiftCardServiceTimeline;
  employeeColor: string;
  isPastDay: boolean;
  pending: boolean;
  selectedShiftId: string | null;
  onShiftClick: (shiftId: string) => void;
};

export function PlanningCellCollapsedShiftMarkers({
  segments,
  dayReferenceShiftTimes,
  serviceTimeline,
  employeeColor,
  isPastDay,
  pending,
  selectedShiftId,
  onShiftClick,
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
    const count = sortedSegments.length;
    if (cellWidthPx <= 0 || count === 0) return 0;

    const contentWidthPx = Math.max(
      1,
      cellWidthPx + PLANNING_CELL_PADDING_PX * 2
    );
    const uniformWidthPx = Math.max(
      1,
      computePastDayUniformLineWidthPx(
        contentWidthPx,
        dayReferenceShiftTimes.length > 0
          ? dayReferenceShiftTimes
          : sortedSegments.map((segment) => ({
              startTime: segment.shift.startTime,
              endTime: segment.shift.endTime,
            })),
        serviceTimeline
      ) + PLANNING_COLLAPSED_SHIFT_WIDTH_DELTA_PX
    );

    const gaps = Math.max(0, count - 1) * COLLAPSED_MARKER_GAP_PX;
    const totalIdealWidth = count * uniformWidthPx + gaps;
    if (totalIdealWidth <= cellWidthPx) {
      return uniformWidthPx;
    }

    return Math.max(1, (cellWidthPx - gaps) / count);
  }, [cellWidthPx, dayReferenceShiftTimes, sortedSegments, serviceTimeline]);

  if (sortedSegments.length === 0) return null;

  const markerColor = isPastDay ? COLLAPSED_PAST_DAY_SHIFT_COLOR : employeeColor;

  return (
    <div
      ref={containerRef}
      className="relative flex w-full min-w-0 items-center overflow-visible"
      style={{ height: PLANNING_CELL_HEIGHT_PX, gap: COLLAPSED_MARKER_GAP_PX }}
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
        const widthPx = planningCollapsedOvernightSegmentWidthPx(
          markerWidthPx,
          cellWidthPx,
          part
        );
        const touchesDayBorder = part === "overnight-start" || part === "overnight-end";

        return (
          <button
            key={segmentKey}
            type="button"
            disabled={pending}
            onClick={() => onShiftClick(shift.id)}
            className={cn(
              "shrink-0 cursor-pointer border-0 p-0 shadow-sm transition hover:opacity-90 disabled:opacity-50",
              part === "overnight-start" && "ml-auto rounded-l-sm rounded-r-none",
              part === "overnight-end" && "rounded-r-sm rounded-l-none",
              part === "full" && "rounded-sm",
              isSelected && "ring-2 ring-primary ring-offset-1"
            )}
            style={{
              width: widthPx > 0 ? widthPx : undefined,
              height: markerHeightPx,
              backgroundColor: markerColor,
              ...(part === "overnight-start"
                ? { marginRight: -PLANNING_CELL_PADDING_PX }
                : undefined),
              ...(part === "overnight-end"
                ? { marginLeft: -PLANNING_CELL_PADDING_PX }
                : undefined),
              ...(touchesDayBorder ? { zIndex: 1 } : undefined),
            }}
            aria-label={label}
            title={label}
          />
        );
      })}
    </div>
  );
}
