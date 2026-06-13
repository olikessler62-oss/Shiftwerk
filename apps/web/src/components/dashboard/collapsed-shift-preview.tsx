"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import { buildShiftCardDisplayContent } from "@/components/dashboard/dashboard-shift-card-view";
import {
  COLLAPSED_PAST_AREA_PIXEL_COLOR,
  COLLAPSED_PAST_DAY_SHIFT_COLOR,
  COLLAPSED_SHIFT_PIXEL_SIZE_PX,
  computeCollapsedDayShiftLineLayouts,
  computeCollapsedShiftPixelLeftPx,
  computePastDayUniformLineWidthPx,
} from "@/lib/shift-card-cell-layout";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import { SHIFT_CARD_TWO_LINE_HEIGHT_PX } from "@/lib/shift-card-row-layout";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

const COLLAPSED_SHIFT_LINE_FALLBACK_COLOR = "#94a3b8";

type Props = {
  shifts: DashboardShiftCard[];
  serviceTimeline: ShiftCardServiceTimeline;
  /** Vergangener Kalendertag — einheitlich grau, kein Scroll. */
  isPastDay: boolean;
  /** Alle Schichten des Tages (alle Bereiche) — für einheitliche Breite an vergangenen Tagen. */
  pastDayReferenceShifts?: readonly DashboardShiftCard[];
  /** Zugeklappter Bereich — nur einzelne Pixel statt Balken. */
  areaCollapsed?: boolean;
  className?: string;
};

function compareShiftCards(a: DashboardShiftCard, b: DashboardShiftCard): number {
  const startDiff = a.startTime.localeCompare(b.startTime);
  if (startDiff !== 0) return startDiff;
  const endDiff = a.endTime.localeCompare(b.endTime);
  if (endDiff !== 0) return endDiff;
  return a.id.localeCompare(b.id);
}

function resolvePreviewColor(
  shift: DashboardShiftCard,
  isPastDay: boolean,
  areaCollapsed: boolean
): string {
  if (isPastDay) {
    return areaCollapsed
      ? COLLAPSED_PAST_AREA_PIXEL_COLOR
      : COLLAPSED_PAST_DAY_SHIFT_COLOR;
  }
  return shift.employeeColor?.trim() || COLLAPSED_SHIFT_LINE_FALLBACK_COLOR;
}

export function CollapsedShiftPreview({
  shifts,
  serviceTimeline,
  isPastDay,
  pastDayReferenceShifts,
  areaCollapsed = false,
  className,
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
  }, [shifts]);

  const sortedShifts = useMemo(
    () => [...shifts].sort(compareShiftCards),
    [shifts]
  );

  const previewItems = useMemo(() => {
    if (areaCollapsed) {
      return sortedShifts.map((shift) => ({
        shift,
        display: buildShiftCardDisplayContent(shift, null),
        marginLeftPx: computeCollapsedShiftPixelLeftPx(
          cellWidthPx,
          shift.startTime,
          serviceTimeline
        ),
        widthPx: COLLAPSED_SHIFT_PIXEL_SIZE_PX,
        heightPx: COLLAPSED_SHIFT_PIXEL_SIZE_PX,
      }));
    }

    const pastDayUniformWidthPx =
      isPastDay && cellWidthPx > 0
        ? computePastDayUniformLineWidthPx(
            cellWidthPx,
            (pastDayReferenceShifts ?? sortedShifts).map((shift) => ({
              startTime: shift.startTime,
              endTime: shift.endTime,
            })),
            serviceTimeline
          )
        : undefined;

    const layouts = computeCollapsedDayShiftLineLayouts(
      cellWidthPx,
      sortedShifts,
      serviceTimeline,
      SHIFT_CARD_TWO_LINE_HEIGHT_PX,
      {
        uniformMinWidth: isPastDay,
        uniformWidthPx: pastDayUniformWidthPx,
      }
    );

    return sortedShifts.map((shift, index) => ({
      shift,
      display: buildShiftCardDisplayContent(shift, null),
      marginLeftPx: layouts[index]?.marginLeftPx ?? 0,
      widthPx: layouts[index]?.widthPx ?? 0,
      heightPx: layouts[index]?.heightPx ?? SHIFT_CARD_TWO_LINE_HEIGHT_PX,
    }));
  }, [
    areaCollapsed,
    isPastDay,
    pastDayReferenceShifts,
    sortedShifts,
    cellWidthPx,
    serviceTimeline,
  ]);

  const showDetail = !isPastDay && !areaCollapsed;

  return (
    <div
      ref={containerRef}
      className={cn(
        areaCollapsed
          ? "relative h-0 min-h-0 flex-1 overflow-hidden"
          : "flex h-0 min-h-0 flex-1 flex-col items-start gap-1 overflow-x-hidden pb-1",
        !areaCollapsed && isPastDay
          ? "overflow-y-hidden"
          : !areaCollapsed
            ? "overflow-y-auto"
            : undefined,
        className
      )}
      aria-hidden={!showDetail ? true : undefined}
    >
      {previewItems.map(({ shift, display, marginLeftPx, widthPx, heightPx }) => {
        const color = resolvePreviewColor(shift, isPastDay, areaCollapsed);

        if (areaCollapsed) {
          return (
            <div
              key={shift.id}
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: marginLeftPx,
                width: widthPx,
                height: heightPx,
                backgroundColor: color,
              }}
              aria-hidden
            />
          );
        }

        const marker = (
          <div
            className="self-start shrink-0 rounded-sm shadow-sm"
            style={{
              marginLeft: marginLeftPx,
              width: widthPx > 0 ? widthPx : undefined,
              height: heightPx,
              minHeight: heightPx,
              backgroundColor: color,
            }}
            aria-hidden
          />
        );

        if (!showDetail) {
          return <div key={shift.id}>{marker}</div>;
        }

        return (
          <Tooltip
            key={shift.id}
            content={display.tooltipBody}
            className="self-start max-w-full"
            placement={{
              anchorLeftToTriggerCenter: true,
              gapPx: 2,
              side: "above",
            }}
          >
            {marker}
          </Tooltip>
        );
      })}
    </div>
  );
}
