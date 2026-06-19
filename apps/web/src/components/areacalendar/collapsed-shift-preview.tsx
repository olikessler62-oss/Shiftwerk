"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import { buildShiftCardDisplayContent } from "@/components/dashboard/dashboard-shift-card-view";
import { ShiftCardTooltipContent } from "@/components/shift-card-tooltip-content";
import {
  COLLAPSED_PAST_AREA_PIXEL_COLOR,
  COLLAPSED_PAST_DAY_SHIFT_COLOR,
  COLLAPSED_SHIFT_PIXEL_SIZE_PX,
  computeCollapsedDayShiftLineLayouts,
  computeCollapsedShiftPixelLeftPx,
  computeCollapsedDayColumnLineWidthPx,
} from "@/lib/shift-card-cell-layout";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import {
  SHIFT_CARD_TWO_LINE_HEIGHT_PX,
  shiftCardListItemHeightPx,
} from "@/lib/shift-card-row-layout";
import { Tooltip, shiftCardTooltipContentClassName } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import { buildDashboardCellShiftRows } from "@/lib/dashboard-overnight-shift-display";
import { useTranslations } from "@/i18n/locale-provider";

const COLLAPSED_SHIFT_LINE_FALLBACK_COLOR = "#94a3b8";

type Props = {
  shifts: DashboardShiftCard[];
  serviceTimeline: ShiftCardServiceTimeline;
  /** Vergangener Kalendertag — einheitlich grau, kein Scroll. */
  isPastDay: boolean;
  /** Alle Schichten des Tages (alle Bereiche) — für einheitliche Balkenbreite im zugeklappten Tag. */
  dayReferenceShifts?: readonly DashboardShiftCard[];
  /** Zugeklappter Bereich — nur einzelne Pixel statt Balken. */
  areaCollapsed?: boolean;
  /** Zugeklappter Tag — kein Scroll, Inhalt abschneiden. */
  dayCollapsed?: boolean;
  /** Feste Zellbreite, wenn ResizeObserver 0 liefert (z. B. Planungs-Matrix). */
  cellWidthPxOverride?: number;
  /** Kurze Einzelzeile statt flex-1/h-0 (Planungs-Matrix pro Mitarbeiter). */
  compactRow?: boolean;
  /** Fester Abstand links (px) statt Timeline-Position — nur Schichtplan erstellen. */
  fixedMarkerMarginLeftPx?: number;
  /** Zusätzliche Marker-Breite (px), z. B. −3 im Schichtplan. */
  markerWidthDeltaPx?: number;
  /** Zusätzliche Marker-Höhe (px), z. B. +5 im Schichtplan. */
  markerHeightDeltaPx?: number;
  onShiftClick?: (shift: DashboardShiftCard) => void;
  selectedShiftId?: string | null;
  disabled?: boolean;
  className?: string;
  /** Platzhalter für Nachtschichten, die als Durchgangs-Karte gerendert werden. */
  overnightAnchorShiftIds?: ReadonlySet<string>;
  /** Endtag: Zeilenindex → Schicht-ID für eingehende Nachtschicht-Fortsetzung. */
  incomingOvernightTailRowsByIndex?: ReadonlyMap<number, string>;
  assignmentPresets?: readonly DashboardAssignmentPreset[];
};

type CollapsedPreviewItem =
  | {
      kind: "shift";
      shift: DashboardShiftCard;
      display: ReturnType<typeof buildShiftCardDisplayContent>;
      marginLeftPx: number;
      widthPx: number;
      heightPx: number;
    }
  | { kind: "overnight-anchor"; shiftId: string; heightPx: number }
  | { kind: "spacer"; spacerKey: string; heightPx: number };

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
  dayReferenceShifts,
  areaCollapsed = false,
  dayCollapsed = false,
  cellWidthPxOverride,
  compactRow = false,
  fixedMarkerMarginLeftPx,
  markerWidthDeltaPx = 0,
  markerHeightDeltaPx = 0,
  onShiftClick,
  selectedShiftId = null,
  disabled = false,
  className,
  overnightAnchorShiftIds,
  incomingOvernightTailRowsByIndex,
  assignmentPresets = [],
}: Props) {
  const t = useTranslations();
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredCellWidthPx, setMeasuredCellWidthPx] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function updateWidth() {
      if (!container) return;
      setMeasuredCellWidthPx(container.clientWidth);
    }

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [shifts, cellWidthPxOverride]);

  const cellWidthPx =
    cellWidthPxOverride && cellWidthPxOverride > 0
      ? cellWidthPxOverride
      : measuredCellWidthPx;

  const sortedShifts = useMemo(
    () => [...shifts].sort(compareShiftCards),
    [shifts]
  );

  const previewItems = useMemo((): CollapsedPreviewItem[] => {
    if (areaCollapsed) {
      return sortedShifts.map((shift) => ({
        kind: "shift" as const,
        shift,
        display: buildShiftCardDisplayContent(shift, null, tooltipOptions),
        marginLeftPx: computeCollapsedShiftPixelLeftPx(
          cellWidthPx,
          shift.startTime,
          serviceTimeline
        ),
        widthPx: COLLAPSED_SHIFT_PIXEL_SIZE_PX,
        heightPx: COLLAPSED_SHIFT_PIXEL_SIZE_PX,
      }));
    }

    const uniformWidthPx =
      cellWidthPx > 0
        ? computeCollapsedDayColumnLineWidthPx(
            cellWidthPx,
            (dayReferenceShifts ?? sortedShifts).map((shift) => ({
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
        uniformMinWidth: true,
        uniformWidthPx,
      }
    );

    const sortedIndexByShiftId = new Map(
      sortedShifts.map((shift, index) => [shift.id, index] as const)
    );

    const cellRows = buildDashboardCellShiftRows(sortedShifts, {
      overnightAnchorShiftIds,
      incomingOvernightTailRowsByIndex,
    });

    const rowHeightPx = (baseHeightPx: number) =>
      shiftCardListItemHeightPx(
        Math.max(1, baseHeightPx + markerHeightDeltaPx)
      );

    return cellRows.map((cellRow, rowIndex): CollapsedPreviewItem => {
      if (cellRow.kind === "overnight-tail-spacer") {
        return {
          kind: "spacer",
          spacerKey: `tail-${cellRow.shiftId}`,
          heightPx: rowHeightPx(SHIFT_CARD_TWO_LINE_HEIGHT_PX),
        };
      }

      if (cellRow.kind === "row-gap") {
        return {
          kind: "spacer",
          spacerKey: `gap-${rowIndex}`,
          heightPx: rowHeightPx(SHIFT_CARD_TWO_LINE_HEIGHT_PX),
        };
      }

      if (cellRow.kind === "overnight-anchor") {
        return {
          kind: "overnight-anchor",
          shiftId: cellRow.shiftId,
          heightPx: rowHeightPx(SHIFT_CARD_TWO_LINE_HEIGHT_PX),
        };
      }

      const layoutIndex = sortedIndexByShiftId.get(cellRow.shift.id) ?? 0;
      const baseWidthPx = layouts[layoutIndex]?.widthPx ?? 0;
      const baseHeightPx =
        layouts[layoutIndex]?.heightPx ?? SHIFT_CARD_TWO_LINE_HEIGHT_PX;

      return {
        kind: "shift",
        shift: cellRow.shift,
        display: buildShiftCardDisplayContent(
          cellRow.shift,
          null,
          tooltipOptions
        ),
        marginLeftPx:
          fixedMarkerMarginLeftPx ?? layouts[layoutIndex]?.marginLeftPx ?? 0,
        widthPx: Math.max(1, baseWidthPx + markerWidthDeltaPx),
        heightPx: Math.max(1, baseHeightPx + markerHeightDeltaPx),
      };
    });
  }, [
    areaCollapsed,
    fixedMarkerMarginLeftPx,
    markerWidthDeltaPx,
    markerHeightDeltaPx,
    dayReferenceShifts,
    sortedShifts,
    cellWidthPx,
    serviceTimeline,
    tooltipOptions,
    overnightAnchorShiftIds,
    incomingOvernightTailRowsByIndex,
  ]);

  const compactRowMinHeightPx =
    SHIFT_CARD_TWO_LINE_HEIGHT_PX + markerHeightDeltaPx;

  const showDetail = !isPastDay && !areaCollapsed;
  const interactive = Boolean(onShiftClick) && !disabled;

  return (
    <div
      ref={containerRef}
      className={cn(
        areaCollapsed
          ? "relative h-0 min-h-0 flex-1 overflow-hidden"
          : compactRow
            ? "flex w-full flex-col items-start justify-center overflow-x-hidden pb-0"
            : "flex h-0 min-h-0 flex-1 flex-col items-start gap-1 overflow-x-hidden pb-1",
        !areaCollapsed && (isPastDay || dayCollapsed)
          ? "overflow-y-hidden"
          : !areaCollapsed && !compactRow
            ? "overflow-y-auto"
            : undefined,
        className
      )}
      style={
        compactRow && !areaCollapsed
          ? { minHeight: compactRowMinHeightPx }
          : undefined
      }
      aria-hidden={!showDetail ? true : undefined}
    >
      {previewItems.map((item) => {
        if (item.kind === "spacer") {
          return (
            <div
              key={item.spacerKey}
              className="self-start shrink-0"
              style={{ height: item.heightPx }}
              aria-hidden
            />
          );
        }

        if (item.kind === "overnight-anchor") {
          return (
            <div
              key={item.shiftId}
              data-dashboard-overnight-span-anchor={item.shiftId}
              className="self-start shrink-0"
              style={{
                height: item.heightPx,
                width: 1,
              }}
              aria-hidden
            />
          );
        }

        const { shift, display, marginLeftPx, widthPx, heightPx } = item;

        if (areaCollapsed && overnightAnchorShiftIds?.has(shift.id)) {
          return (
            <div
              key={shift.id}
              data-dashboard-overnight-span-anchor={shift.id}
              className="self-start shrink-0"
              style={{
                height: COLLAPSED_SHIFT_PIXEL_SIZE_PX,
                width: 1,
              }}
              aria-hidden
            />
          );
        }

        const color = resolvePreviewColor(shift, isPastDay, areaCollapsed);
        const isSelected = selectedShiftId === shift.id;

        if (areaCollapsed) {
          const marker = (
            <div
              className="h-full w-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
          );

          if (interactive) {
            return (
              <button
                key={shift.id}
                type="button"
                onClick={() => onShiftClick!(shift)}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0",
                  isSelected && "ring-2 ring-primary ring-offset-1"
                )}
                style={{
                  left: marginLeftPx,
                  width: widthPx,
                  height: heightPx,
                }}
                aria-label={display.tooltipBody}
              >
                {marker}
              </button>
            );
          }

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

        const markerStyle = {
          marginLeft: marginLeftPx,
          width: widthPx > 0 ? widthPx : undefined,
          height: heightPx,
          minHeight: heightPx,
          backgroundColor: color,
        };

        const markerClass = cn(
          "self-start shrink-0 rounded-sm shadow-sm",
          isSelected && "ring-2 ring-primary ring-offset-1"
        );

        if (interactive) {
          const button = (
            <button
              type="button"
              onClick={() => onShiftClick!(shift)}
              className={cn(markerClass, "cursor-pointer border-0 p-0")}
              style={markerStyle}
              aria-label={display.tooltipBody}
            />
          );

          if (!showDetail) {
            return <div key={shift.id}>{button}</div>;
          }

          return (
            <Tooltip
              key={shift.id}
              content={<ShiftCardTooltipContent data={display.tooltip} />}
              contentClassName={shiftCardTooltipContentClassName}
              className="self-start max-w-full"
              placement={{
                anchorLeftToTriggerCenter: true,
                gapPx: 2,
                side: "above",
              }}
            >
              {button}
            </Tooltip>
          );
        }

        const marker = (
          <div className={markerClass} style={markerStyle} aria-hidden />
        );

        if (!showDetail) {
          return <div key={shift.id}>{marker}</div>;
        }

        return (
          <Tooltip
            key={shift.id}
            content={<ShiftCardTooltipContent data={display.tooltip} />}
            contentClassName={shiftCardTooltipContentClassName}
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
