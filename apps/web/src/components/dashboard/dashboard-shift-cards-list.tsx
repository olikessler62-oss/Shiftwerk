"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import {
  DashboardShiftCardView,
  buildShiftCardDisplayContent,
} from "@/components/dashboard/dashboard-shift-card-view";
import { computeShiftCardCellLayout } from "@/lib/shift-card-cell-layout";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import {
  estimateShiftCardMinWidths,
  resolveJobLabelsForShiftAssignment,
  resolveShiftCardDensity,
} from "@/lib/shift-card-display-content";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { LocationAreaStaffing } from "@schichtwerk/types";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { cn } from "@/lib/cn";

type Props = {
  shifts: DashboardShiftCard[];
  areaId: string;
  dateISO: string;
  serviceTimeline: ShiftCardServiceTimeline;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  assignmentPresets: readonly DashboardAssignmentPreset[];
  profileQualificationIds: Record<string, string[]>;
  qualificationNameById: ReadonlyMap<string, string>;
  qualificationSortOrder: ReadonlyMap<string, number>;
  /** Layout-basiert: Scroll nur wenn der Bereich wirklich scrollen soll. */
  needsVerticalScroll?: boolean;
  /** Nur dominanter Bereich: echtes Überlaufen nach Layout-Wechsel erkennen. */
  measureOverflowFallback?: boolean;
  className?: string;
};

function compareShiftCards(a: DashboardShiftCard, b: DashboardShiftCard): number {
  const startDiff = a.startTime.localeCompare(b.startTime);
  if (startDiff !== 0) return startDiff;
  const endDiff = a.endTime.localeCompare(b.endTime);
  if (endDiff !== 0) return endDiff;
  return a.id.localeCompare(b.id);
}

function resolveShiftCardLayout(
  cellWidthPx: number,
  shift: DashboardShiftCard,
  display: ReturnType<typeof buildShiftCardDisplayContent>,
  serviceTimeline: ShiftCardServiceTimeline,
  shiftCountInCell: number,
  uniformShiftDurationWidth = true
) {
  const minWidths = estimateShiftCardMinWidths(display);
  let density = resolveShiftCardDensity(
    cellWidthPx,
    minWidths.twoLinePx,
    minWidths.compactPx
  );

  for (let attempt = 0; attempt < 3; attempt++) {
    const contentMinWidthPx =
      density === "two-line"
        ? minWidths.twoLinePx
        : density === "compact"
          ? minWidths.compactPx
          : 0;

    const layout = computeShiftCardCellLayout(
      cellWidthPx,
      shift.startTime,
      shift.endTime,
      serviceTimeline,
      density,
      contentMinWidthPx,
      { shiftCountInCell, uniformShiftDurationWidth }
    );

    const nextDensity = resolveShiftCardDensity(
      layout.widthPx,
      minWidths.twoLinePx,
      minWidths.compactPx
    );

    if (nextDensity === density) {
      return layout;
    }

    density = nextDensity;
  }

  return computeShiftCardCellLayout(
    cellWidthPx,
    shift.startTime,
    shift.endTime,
    serviceTimeline,
    density,
    density === "compact" ? minWidths.compactPx : 0,
    { shiftCountInCell, uniformShiftDurationWidth }
  );
}

export function DashboardShiftCardsList({
  shifts,
  areaId,
  dateISO,
  serviceTimeline,
  serviceHours,
  staffingRules,
  assignmentPresets,
  profileQualificationIds,
  qualificationNameById,
  qualificationSortOrder,
  needsVerticalScroll = false,
  measureOverflowFallback = false,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellWidthPx, setCellWidthPx] = useState(0);
  const [contentOverflows, setContentOverflows] = useState(false);

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

  const shiftRows = useMemo(() => {
    const sortedShifts = [...shifts].sort(compareShiftCards);
    const shiftCountInCell = sortedShifts.length;

    return sortedShifts.map((shift) => {
      const jobsLabel = resolveJobLabelsForShiftAssignment(
        shift.employeeId,
        shift.locationAreaId ?? areaId,
        dateISO,
        shift.startTime,
        shift.endTime,
        staffingRules,
        serviceHours,
        assignmentPresets,
        profileQualificationIds,
        qualificationNameById,
        qualificationSortOrder
      );
      const display = buildShiftCardDisplayContent(shift, jobsLabel);
      const layout = resolveShiftCardLayout(
        cellWidthPx,
        shift,
        display,
        serviceTimeline,
        shiftCountInCell,
        true
      );

      return { shift, display, layout };
    });
  }, [
    shifts,
    areaId,
    dateISO,
    cellWidthPx,
    serviceTimeline,
    serviceHours,
    staffingRules,
    assignmentPresets,
    profileQualificationIds,
    qualificationNameById,
    qualificationSortOrder,
  ]);

  useLayoutEffect(() => {
    if (!measureOverflowFallback) {
      setContentOverflows(false);
      return;
    }

    const container = containerRef.current;
    if (!container || shifts.length === 0) {
      setContentOverflows(false);
      return;
    }

    function updateOverflow() {
      if (!container) return;
      setContentOverflows(container.scrollHeight > container.clientHeight + 1);
    }

    updateOverflow();
    const raf = requestAnimationFrame(updateOverflow);

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [
    measureOverflowFallback,
    shifts,
    shiftRows.length,
    needsVerticalScroll,
    cellWidthPx,
  ]);

  const showVerticalScroll =
    shifts.length > 0 &&
    (needsVerticalScroll || (measureOverflowFallback && contentOverflows));

  return (
    <div
      ref={containerRef}
      className={cn(
        shifts.length > 0 && "h-0 min-h-0 flex-1",
        "flex flex-col items-start gap-1 overflow-x-hidden pb-1",
        showVerticalScroll ? "overflow-y-auto" : "overflow-y-hidden",
        showVerticalScroll && MODAL_SCROLLBAR_CLASS,
        className
      )}
    >
      {shiftRows.map(({ shift, display, layout }) => (
        <DashboardShiftCardView
          key={shift.id}
          shift={shift}
          display={display}
          density={layout.density}
          widthPx={cellWidthPx > 0 && layout.widthPx > 0 ? layout.widthPx : undefined}
          marginLeftPx={cellWidthPx > 0 ? layout.marginLeftPx : undefined}
        />
      ))}
    </div>
  );
}
