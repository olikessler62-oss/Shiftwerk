"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import {
  AreaCalendarShiftCardView,
  buildShiftCardDisplayContent,
} from "@/components/areacalendar/areacalendar-shift-card-view";
import {
  applyDurationMonotonicShiftCardWidths,
  applySubThreeHourUniformShiftCardWidths,
  computeShiftCardCellLayout,
} from "@/lib/shift-card-cell-layout";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import {
  estimateShiftCardMinWidths,
  resolveJobLabelsForShiftAssignment,
  resolveShiftCardDensity,
} from "@/lib/shift-card-display-content";
import {
  shiftCardListItemHeightPx,
} from "@/lib/shift-card-row-layout";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { LocationAreaStaffing } from "@schichtwerk/types";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { cn } from "@/lib/cn";
import { shiftConfirmationTooltipStatusLabelKey } from "@/lib/shift-confirmation-display";
import { useTranslations } from "@/i18n/locale-provider";
import { buildAreaCalendarCellShiftRows } from "@/lib/areacalendar-overnight-shift-display";

type Props = {
  shifts: AreaCalendarShiftCard[];
  areaId: string;
  dateISO: string;
  serviceTimeline: ShiftCardServiceTimeline;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  profileQualificationIds: Record<string, string[]>;
  qualificationNameById: ReadonlyMap<string, string>;
  qualificationSortOrder: ReadonlyMap<string, number>;
  /** Layout-basiert: Scroll nur wenn der Bereich wirklich scrollen soll. */
  needsVerticalScroll?: boolean;
  /** Scroll-Prüfung aussetzen (z. B. während Bereichs-Aufklapp-Animation). */
  deferVerticalScroll?: boolean;
  /** Nur dominanter Bereich: echtes Überlaufen nach Layout-Wechsel erkennen. */
  measureOverflowFallback?: boolean;
  className?: string;
  onShiftClick?: (shift: AreaCalendarShiftCard) => void;
  onShiftContextMenu?: (shift: AreaCalendarShiftCard, event: React.MouseEvent) => void;
  shiftConfirmationEnabled?: boolean;
  /** Vergangene Tage: kein Scroll, Inhalt abschneiden. */
  clipVerticalOverflow?: boolean;
  highlightedEmployeeId?: string | null;
  /** Platzhalter für Nachtschichten, die als Durchgangs-Karte gerendert werden. */
  overnightAnchorShiftIds?: ReadonlySet<string>;
  /** Endtag: Zeilenindex → Schicht-ID für eingehende Nachtschicht-Fortsetzung. */
  incomingOvernightTailRowsByIndex?: ReadonlyMap<number, string>;
};

function compareShiftCards(a: AreaCalendarShiftCard, b: AreaCalendarShiftCard): number {
  const startDiff = a.startTime.localeCompare(b.startTime);
  if (startDiff !== 0) return startDiff;
  const endDiff = a.endTime.localeCompare(b.endTime);
  if (endDiff !== 0) return endDiff;
  return a.id.localeCompare(b.id);
}

function resolveShiftCardLayout(
  cellWidthPx: number,
  shift: AreaCalendarShiftCard,
  display: ReturnType<typeof buildShiftCardDisplayContent>,
  serviceTimeline: ShiftCardServiceTimeline,
  shiftCountInCell: number,
  uniformShiftDurationWidth = true
) {
  const minWidths = estimateShiftCardMinWidths(display);

  if (uniformShiftDurationWidth) {
    const layout = computeShiftCardCellLayout(
      cellWidthPx,
      shift.startTime,
      shift.endTime,
      serviceTimeline,
      "two-line",
      minWidths.twoLinePx,
      { shiftCountInCell, uniformShiftDurationWidth: true }
    );
    return { ...layout, density: "two-line" as const };
  }

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

export function AreaCalendarShiftCardsList({
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
  deferVerticalScroll = false,
  measureOverflowFallback = false,
  className,
  onShiftClick,
  onShiftContextMenu,
  shiftConfirmationEnabled = false,
  clipVerticalOverflow = false,
  highlightedEmployeeId = null,
  overnightAnchorShiftIds,
  incomingOvernightTailRowsByIndex,
}: Props) {
  const t = useTranslations();
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

  const tooltipOptions = useMemo(
    () => ({
      assignmentPresets,
      formatShiftTooltipLine: (name: string) =>
        t("common.shiftCardTooltipShift", { name }),
      formatJobTooltipLine: (names: string) =>
        t("common.shiftCardTooltipJob", { names }),
    }),
    [assignmentPresets, t]
  );

  const shiftRows = useMemo(() => {
    const sortedShifts = [...shifts].sort(compareShiftCards);
    const shiftCountInCell = sortedShifts.length;

    const cellRows = buildAreaCalendarCellShiftRows(shifts, {
      overnightAnchorShiftIds,
      incomingOvernightTailRowsByIndex,
    });

    const layoutByShiftId = new Map<
      string,
      ReturnType<typeof resolveShiftCardLayout>
    >();

    for (const shift of sortedShifts) {
      if (overnightAnchorShiftIds?.has(shift.id)) continue;

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
      const display = buildShiftCardDisplayContent(shift, jobsLabel, tooltipOptions);
      layoutByShiftId.set(
        shift.id,
        resolveShiftCardLayout(
          cellWidthPx,
          shift,
          display,
          serviceTimeline,
          shiftCountInCell,
          true
        )
      );
    }

    const layoutInputs = sortedShifts
      .filter((shift) => !overnightAnchorShiftIds?.has(shift.id))
      .map((shift) => ({
        layout: layoutByShiftId.get(shift.id)!,
        startTime: shift.startTime,
        endTime: shift.endTime,
      }));

    applySubThreeHourUniformShiftCardWidths(
      cellWidthPx,
      layoutInputs,
      serviceTimeline
    );
    applyDurationMonotonicShiftCardWidths(
      cellWidthPx,
      layoutInputs,
      serviceTimeline
    );

    return cellRows.flatMap((cellRow) => {
      if (cellRow.kind === "row-gap") {
        return [{ kind: "row-gap" as const }];
      }

      if (cellRow.kind === "overnight-anchor") {
        return [{ kind: "overnight-anchor" as const, shiftId: cellRow.shiftId }];
      }

      if (cellRow.kind === "overnight-tail-spacer") {
        return [
          { kind: "overnight-tail-spacer" as const, shiftId: cellRow.shiftId },
        ];
      }

      const shift = cellRow.shift;
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
      const display = buildShiftCardDisplayContent(shift, jobsLabel, tooltipOptions);
      const layout = layoutByShiftId.get(shift.id)!;

      return [{ kind: "shift" as const, shift, display, layout }];
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
    tooltipOptions,
    profileQualificationIds,
    qualificationNameById,
    qualificationSortOrder,
    overnightAnchorShiftIds,
    incomingOvernightTailRowsByIndex,
  ]);

  useLayoutEffect(() => {
    if (!measureOverflowFallback || deferVerticalScroll) {
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
      setContentOverflows(
        container.scrollHeight > Math.ceil(container.clientHeight)
      );
    }

    updateOverflow();
    const raf = requestAnimationFrame(updateOverflow);
    const afterGridTransition = window.setTimeout(updateOverflow, 350);

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(afterGridTransition);
      observer.disconnect();
    };
  }, [
    measureOverflowFallback,
    deferVerticalScroll,
    shifts,
    shiftRows.length,
    needsVerticalScroll,
    cellWidthPx,
  ]);

  const showVerticalScroll =
    !deferVerticalScroll &&
    !clipVerticalOverflow &&
    shifts.length > 0 &&
    (needsVerticalScroll || (measureOverflowFallback && contentOverflows));

  const hasHighlightedShiftInList =
    highlightedEmployeeId !== null &&
    shifts.some((shift) => shift.employeeId === highlightedEmployeeId);

  function handleOvernightRowContextMenu(
    shiftId: string,
    event: React.MouseEvent
  ) {
    if (!onShiftContextMenu) return;
    const shift = shifts.find((entry) => entry.id === shiftId);
    if (!shift) return;
    event.preventDefault();
    event.stopPropagation();
    onShiftContextMenu(shift, event);
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        shifts.length > 0 && "h-0 min-h-0 flex-1",
        "flex flex-col items-start gap-1 pb-1",
        hasHighlightedShiftInList && !showVerticalScroll
          ? "relative overflow-visible"
          : cn(
              "overflow-x-hidden",
              showVerticalScroll ? "overflow-y-auto" : "overflow-y-hidden",
              showVerticalScroll && MODAL_SCROLLBAR_CLASS
            ),
        className
      )}
    >
      {shiftRows.map((row, rowIndex) => {
        if (row.kind === "row-gap") {
          return (
            <div
              key={`gap-${rowIndex}`}
              className="max-w-full shrink-0 self-start"
              style={{ height: shiftCardListItemHeightPx() }}
              aria-hidden
            />
          );
        }

        if (row.kind === "overnight-anchor") {
          return (
            <div
              key={row.shiftId}
              data-areacalendar-overnight-span-anchor={row.shiftId}
              className="max-w-full shrink-0 self-start"
              style={{ height: shiftCardListItemHeightPx() }}
              aria-hidden
              onContextMenu={(event) =>
                handleOvernightRowContextMenu(row.shiftId, event)
              }
            />
          );
        }

        if (row.kind === "overnight-tail-spacer") {
          return (
            <div
              key={`tail-${row.shiftId}`}
              data-areacalendar-overnight-tail-spacer={row.shiftId}
              className="max-w-full shrink-0 self-start"
              style={{ height: shiftCardListItemHeightPx() }}
              aria-hidden
              onContextMenu={(event) =>
                handleOvernightRowContextMenu(row.shiftId, event)
              }
            />
          );
        }

        const { shift, display, layout } = row;
        return (
        <AreaCalendarShiftCardView
          key={shift.id}
          shift={shift}
          display={display}
          density={layout.density}
          widthPx={cellWidthPx > 0 && layout.widthPx > 0 ? layout.widthPx : undefined}
          marginLeftPx={cellWidthPx > 0 ? layout.marginLeftPx : undefined}
          onClick={onShiftClick ? () => onShiftClick(shift) : undefined}
          cellDateISO={dateISO}
          onContextMenu={
            onShiftContextMenu
              ? (event) => onShiftContextMenu(shift, event)
              : undefined
          }
          confirmationStatusLabel={
            shift.confirmationStatus
              ? t(shiftConfirmationTooltipStatusLabelKey(shift.confirmationStatus))
              : undefined
          }
          employeeHighlighted={
            highlightedEmployeeId !== null &&
            shift.employeeId === highlightedEmployeeId
          }
        />
        );
      })}
    </div>
  );
}
