"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import { buildShiftCardDisplayContent } from "@/components/areacalendar/areacalendar-shift-card-view";
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
  AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX,
  areaCalendarShiftCardListItemHeightPx,
} from "@/lib/shift-card-row-layout";
import { Tooltip, shiftCardTooltipContentClassName } from "@/components/ui/tooltip";
import { buildShiftCardStripGradientCss } from "@/lib/shift-card-time-gradient";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import { buildAreaCalendarCellShiftRows } from "@/lib/areacalendar-overnight-shift-display";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { isPastShiftDate } from "@/lib/planning-readonly";
import {
  canOpenShiftCardContextMenu,
  handleShiftCardContextMenuPointerEvent,
  planningShiftCardShowsPointerCursor,
} from "@/lib/shift-card-context-menu-actions";
import {
  preventPointerTextSelection,
  SHIFT_CARD_INTERACTIVE_CLASS,
} from "@/lib/calendar-interaction-ui";

const COLLAPSED_SHIFT_LINE_FALLBACK_COLOR = "#94a3b8";

type Props = {
  shifts: AreaCalendarShiftCard[];
  serviceTimeline: ShiftCardServiceTimeline;
  areaName?: string;
  areaNameById?: ReadonlyMap<string, string>;
  fallbackAreaId?: string;
  /** Vergangener Kalendertag — einheitlich grau, kein Scroll. */
  isPastDay: boolean;
  cellDate: string;
  /** Alle Schichten des Tages (alle Bereiche) — für einheitliche Balkenbreite im zugeklappten Tag. */
  dayReferenceShifts?: readonly AreaCalendarShiftCard[];
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
  onShiftClick?: (shift: AreaCalendarShiftCard) => void;
  onShiftContextMenu?: (shift: AreaCalendarShiftCard, event: React.MouseEvent) => void;
  selectedShiftId?: string | null;
  disabled?: boolean;
  className?: string;
  /** Platzhalter für Nachtschichten, die als Durchgangs-Karte gerendert werden. */
  overnightAnchorShiftIds?: ReadonlySet<string>;
  /** Endtag: Zeilenindex → Schicht-ID für eingehende Nachtschicht-Fortsetzung. */
  incomingOvernightTailRowsByIndex?: ReadonlyMap<number, string>;
  assignmentPresets?: readonly AreaCalendarAssignmentPreset[];
};

type CollapsedPreviewItem =
  | {
      kind: "shift";
      shift: AreaCalendarShiftCard;
      display: ReturnType<typeof buildShiftCardDisplayContent>;
      marginLeftPx: number;
      widthPx: number;
      heightPx: number;
    }
  | { kind: "overnight-anchor"; shiftId: string; heightPx: number }
  | { kind: "spacer"; spacerKey: string; heightPx: number };

function compareShiftCards(a: AreaCalendarShiftCard, b: AreaCalendarShiftCard): number {
  const startDiff = a.startTime.localeCompare(b.startTime);
  if (startDiff !== 0) return startDiff;
  const endDiff = a.endTime.localeCompare(b.endTime);
  if (endDiff !== 0) return endDiff;
  return a.id.localeCompare(b.id);
}

function resolvePreviewColor(
  shift: AreaCalendarShiftCard,
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
  areaName,
  areaNameById,
  fallbackAreaId,
  isPastDay,
  cellDate,
  dayReferenceShifts,
  areaCollapsed = false,
  dayCollapsed = false,
  cellWidthPxOverride,
  compactRow = false,
  fixedMarkerMarginLeftPx,
  markerWidthDeltaPx = 0,
  markerHeightDeltaPx = 0,
  onShiftClick,
  onShiftContextMenu,
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
      areaName,
      areaNameById,
      fallbackAreaId,
      formatShiftTooltipLine: (name: string) =>
        t("common.shiftCardTooltipShift", { name }),
      formatDeploymentTimeTooltipLine: () =>
        t("common.shiftCardTooltipDeploymentTimeLabel"),
      formatJobTooltipLine: (names: string) =>
        t("common.shiftCardTooltipJob", { names }),
    }),
    [assignmentPresets, areaName, areaNameById, fallbackAreaId, t]
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
      AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX,
      {
        uniformMinWidth: true,
        uniformWidthPx,
      }
    );

    const sortedIndexByShiftId = new Map(
      sortedShifts.map((shift, index) => [shift.id, index] as const)
    );

    const cellRows = buildAreaCalendarCellShiftRows(sortedShifts, {
      overnightAnchorShiftIds,
      incomingOvernightTailRowsByIndex,
    });

    const rowHeightPx = (baseHeightPx: number) =>
      areaCalendarShiftCardListItemHeightPx(
        Math.max(1, baseHeightPx + markerHeightDeltaPx)
      );

    return cellRows.map((cellRow, rowIndex): CollapsedPreviewItem => {
      if (cellRow.kind === "overnight-tail-spacer") {
        return {
          kind: "spacer",
          spacerKey: `tail-${cellRow.shiftId}`,
          heightPx: rowHeightPx(AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX),
        };
      }

      if (cellRow.kind === "row-gap") {
        return {
          kind: "spacer",
          spacerKey: `gap-${rowIndex}`,
          heightPx: rowHeightPx(AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX),
        };
      }

      if (cellRow.kind === "overnight-anchor") {
        return {
          kind: "overnight-anchor",
          shiftId: cellRow.shiftId,
          heightPx: rowHeightPx(AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX),
        };
      }

      const layoutIndex = sortedIndexByShiftId.get(cellRow.shift.id) ?? 0;
      const baseWidthPx = layouts[layoutIndex]?.widthPx ?? 0;
      const baseHeightPx =
        layouts[layoutIndex]?.heightPx ?? AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX;

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
    AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX + markerHeightDeltaPx;

  const showDetail = !isPastDay && !areaCollapsed;
  const interactive = Boolean(onShiftClick) && !disabled;

  function resolveShiftContextMenuHandler(shift: AreaCalendarShiftCard) {
    if (!onShiftContextMenu) return undefined;
    return (event: React.MouseEvent) => {
      handleShiftCardContextMenuPointerEvent(
        event,
        canOpenShiftCardContextMenu(
          shift.confirmationStatus,
          shift.requestedAt,
          {
            shiftDate: shift.shift_date,
            cellDate,
            isPastShiftDate,
            displayState: shift.displayState,
          }
        ),
        () => onShiftContextMenu(shift, event)
      );
    };
  }

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
              data-areacalendar-overnight-span-anchor={item.shiftId}
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
              data-areacalendar-overnight-span-anchor={shift.id}
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
        const markerBackgroundStyle = isPastDay
          ? { backgroundColor: color }
          : { backgroundImage: buildShiftCardStripGradientCss(color, "to right") };
        const isSelected = selectedShiftId === shift.id;
        const onContextMenu = resolveShiftContextMenuHandler(shift);
        const shiftInteractive =
          interactive &&
          planningShiftCardShowsPointerCursor(
            {
              shift_date: shift.shift_date,
              confirmationStatus: shift.confirmationStatus,
              requestedAt: shift.requestedAt,
            },
            cellDate,
            isPastShiftDate
          );
        const isContextMenuTarget = shiftInteractive || Boolean(onContextMenu);

        if (areaCollapsed) {
          const marker = (
            <div
              className="h-full w-full"
              style={markerBackgroundStyle}
              aria-hidden
            />
          );

          if (isContextMenuTarget) {
            return (
              <button
                key={shift.id}
                type="button"
                onMouseDown={
                  shiftInteractive ? preventPointerTextSelection : undefined
                }
                onClick={shiftInteractive ? () => onShiftClick!(shift) : undefined}
                onContextMenu={onContextMenu}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 border-0 bg-transparent p-0",
                  SHIFT_CARD_INTERACTIVE_CLASS,
                  shiftInteractive ? "cursor-pointer" : "!cursor-default",
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
                ...markerBackgroundStyle,
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
          ...markerBackgroundStyle,
        };

        const markerClass = cn(
          "self-start shrink-0 rounded-sm shadow-sm",
          isSelected && "ring-2 ring-primary ring-offset-1"
        );

        if (isContextMenuTarget) {
          const button = (
            <button
              type="button"
              onMouseDown={
                shiftInteractive ? preventPointerTextSelection : undefined
              }
              onClick={shiftInteractive ? () => onShiftClick!(shift) : undefined}
              onContextMenu={onContextMenu}
              className={cn(
                markerClass,
                "border-0 p-0",
                SHIFT_CARD_INTERACTIVE_CLASS,
                shiftInteractive ? "cursor-pointer" : "!cursor-default"
              )}
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
              interactive
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
            interactive
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
