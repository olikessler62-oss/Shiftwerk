"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW } from "@/components/areacalendar/areacalendar-shift-card-view";
import { Tooltip, shiftCardTooltipContentClassName } from "@/components/ui/tooltip";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  buildEmployeeShiftHighlightBoxShadow,
  employeeShiftHighlightOverlayStyle,
  preventPointerTextSelection,
  SHIFT_CARD_INTERACTIVE_CLASS,
} from "@/lib/calendar-interaction-ui";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import {
  dashboardShiftCardTrackWidthPx,
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_EXPANDED_DAY_CELL_LAYOUT_INSET_PX,
} from "@/lib/planning-calendar-layout";
import {
  buildPlanningShiftSegmentGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import { PLANNING_EXPANDED_SHIFT_CELL_GAP_PX } from "@/lib/planning-expanded-shift-layout";
import {
  DashboardExpandedShiftCardText,
  DashboardShiftCardTextArea,
} from "@/components/dashboard/dashboard-expanded-shift-card-text";
import { DashboardShiftCardConfirmationOverlay } from "@/components/dashboard/dashboard-shift-card-confirmation-overlay";
import { ShiftCardTooltipContent } from "@/components/shift-card-tooltip-content";
import {
  buildPlanningShiftSegmentCardContent,
  resolvePlanningShiftAreaName,
  resolvePlanningShiftJobsLabel,
  type PlanningShiftJobContext,
} from "@/lib/planning-shift-card-display";
import {
  planningShiftSegmentMaxWidthPx,
  planningShiftSegmentShowsEmployeeStrip,
  planningShiftSegmentTouchesDayBorder,
  type PlanningShiftDisplaySegment,
} from "@/lib/planning-overnight-shift-display";
import {
  shiftConfirmationTooltipStatusLabelKey,
  SHIFT_CARD_UNRESOLVED_OPACITY,
  shiftConfirmationShowsUnresolvedCardStyle,
} from "@/lib/shift-confirmation-display";
import { resolveShiftCardConfirmationStatusForCalendar } from "@/lib/shift-card-calendar-confirmation-status";
import { SHIFT_ABSENCE_CONFLICT_RING_CLASS } from "@/lib/shift-absence-conflict";
import { isPastShiftDate } from "@/lib/planning-readonly";
import {
  canOpenShiftCardContextMenu,
  handleShiftCardContextMenuPointerEvent,
  planningShiftCardShowsPointerCursor,
} from "@/lib/shift-card-context-menu-actions";

import { SHIFT_CARD_MIN_TEXT_CONTENT_TRACK_PX } from "@/lib/shift-card-display-content";

/** Mindestbreite für gekürzten Text (1–2 Zeichen + Ellipse). */
const MIN_WIDTH_FOR_ANY_TEXT_PX = SHIFT_CARD_MIN_TEXT_CONTENT_TRACK_PX;
/** Unterhalb: kompakte Schrift, aber weiterhin zwei Zeilen. */
const MIN_WIDTH_FOR_TWO_LINE_DETAIL_PX = 56;

function segmentBorderRadiusClass(part: PlanningShiftDisplaySegment["part"]): string {
  if (part === "overnight-start") return "rounded-l rounded-r-none";
  if (part === "overnight-end") return "rounded-r rounded-l-none";
  return "rounded";
}

function resolveStripWidthPx(cardWidthPx: number): number {
  return cardWidthPx > 0 && cardWidthPx < MIN_WIDTH_FOR_ANY_TEXT_PX
    ? Math.max(2, Math.min(4, cardWidthPx))
    : SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX;
}

type Props = {
  segments: PlanningShiftDisplaySegment[];
  employeeName: string;
  employeeColor: string;
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  pending: boolean;
  selectedShiftId: string | null;
  cellDate: string;
  onShiftClick: (shiftId: string) => void;
  /** Rechtsklick auf Schichtkarte (aufgeklappte aktuelle/zukünftige Tage). */
  onShiftContextMenu?: (shiftId: string, event: React.MouseEvent) => void;
  /** Breite rechts freilassen — nur aufgeklappte Tage (Tag-Grenze erkennbar). */
  trailingLayoutInsetPx?: number;
  /** Linksklick auf freien Zellbereich neben Schichtkarten — neue Schicht. */
  onEmptyAreaClick?: () => void;
  emptyAreaDisabled?: boolean;
  emptyAreaLabel?: string;
  shiftJobContext: PlanningShiftJobContext;
  employeeHighlighted?: boolean;
  absenceConflictShiftIds?: ReadonlySet<string>;
  swapRequestShiftIds?: ReadonlySet<string>;
  shiftConfirmationEnabled?: boolean;
};

export function DashboardCellShiftRow({
  segments,
  employeeName,
  employeeColor,
  assignmentPresets,
  pending,
  selectedShiftId,
  cellDate,
  onShiftClick,
  onShiftContextMenu,
  trailingLayoutInsetPx = PLANNING_EXPANDED_DAY_CELL_LAYOUT_INSET_PX,
  onEmptyAreaClick,
  emptyAreaDisabled = false,
  emptyAreaLabel,
  shiftJobContext,
  employeeHighlighted = false,
  absenceConflictShiftIds,
  swapRequestShiftIds,
  shiftConfirmationEnabled = true,
}: Props) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(0);

  const touchesDayBorder = segments.some((segment) =>
    planningShiftSegmentTouchesDayBorder(segment.part)
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function updateWidth() {
      if (!container) return;
      setContainerWidthPx(Math.max(0, container.clientWidth));
    }

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [segments.length]);

  const layoutWidthPx = useMemo(() => {
    if (containerWidthPx <= 0) return 0;
    return Math.max(
      0,
      containerWidthPx -
        (touchesDayBorder ? 0 : trailingLayoutInsetPx)
    );
  }, [containerWidthPx, touchesDayBorder, trailingLayoutInsetPx]);

  const shiftTrackWidthPx = useMemo(
    () =>
      Math.min(
        dashboardShiftCardTrackWidthPx(containerWidthPx),
        layoutWidthPx
      ),
    [containerWidthPx, layoutWidthPx]
  );

  const widthPerSegmentPx = useMemo(() => {
    const count = segments.length;
    if (count === 0 || shiftTrackWidthPx <= 0) return 0;
    const gaps = Math.max(0, count - 1) * PLANNING_EXPANDED_SHIFT_CELL_GAP_PX;
    return Math.max(0, (shiftTrackWidthPx - gaps) / count);
  }, [shiftTrackWidthPx, segments.length]);

  const leftSegments = useMemo(
    () => segments.filter((segment) => segment.part !== "overnight-start"),
    [segments]
  );
  const rightSegments = useMemo(
    () => segments.filter((segment) => segment.part === "overnight-start"),
    [segments]
  );

  if (segments.length === 0) return null;

  function renderSegment(segment: PlanningShiftDisplaySegment) {
        const { shift, part } = segment;
        const segmentKey = `${shift.id}:${part}`;
        const isSelected = selectedShiftId === shift.id;
        const cardWidthPx = Math.min(
          widthPerSegmentPx,
          planningShiftSegmentMaxWidthPx(shiftTrackWidthPx, part)
        );
        const showAnyText = cardWidthPx >= MIN_WIDTH_FOR_ANY_TEXT_PX;
        const showTwoLineDetail = cardWidthPx >= MIN_WIDTH_FOR_TWO_LINE_DETAIL_PX;
        const stripWidthPx = resolveStripWidthPx(cardWidthPx);
        const showEmployeeStrip = planningShiftSegmentShowsEmployeeStrip(part);
        const isPastShift = isPastShiftDate(cellDate);
        const calendarConfirmationStatus =
          resolveShiftCardConfirmationStatusForCalendar(shift, cellDate);
        const showUnresolvedCardStyle = shiftConfirmationShowsUnresolvedCardStyle(
          calendarConfirmationStatus
        );
        const confirmationStatusLine = calendarConfirmationStatus
          ? t(shiftConfirmationTooltipStatusLabelKey(calendarConfirmationStatus))
          : undefined;
        const inlineStatusLabel = showUnresolvedCardStyle
          ? confirmationStatusLine
          : undefined;
        const jobsLabel = resolvePlanningShiftJobsLabel(shift, shiftJobContext);
        const jobsLine = jobsLabel.trim()
          ? t("common.shiftCardTooltipJob", { names: jobsLabel })
          : null;
        const areaName = resolvePlanningShiftAreaName(shift, shiftJobContext);
        const cardContent = buildPlanningShiftSegmentCardContent(
          shift,
          assignmentPresets,
          part,
          {
            employeeName,
            areaName,
            confirmationStatusLine,
            confirmationStatus: calendarConfirmationStatus,
            jobsLabel,
            isPastShift,
            formatTemplateTooltipLine: (templateName) =>
              t("common.shiftCardTooltipShift", { name: templateName }),
            formatDeploymentTimeTooltipLine: () =>
              t("common.shiftCardTooltipDeploymentTimeLabel"),
            formatJobTooltipLine: (names) =>
              t("common.shiftCardTooltipJob", { names }),
            formatStatusTooltipLine: (status) =>
              `${t("common.shiftCardTooltipStatusLabel")} ${status}`,
          }
        );

        const cardBoxShadow = employeeHighlighted
          ? buildEmployeeShiftHighlightBoxShadow(
              AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW,
              employeeColor
            )
          : AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW;
        const showsPointerCursor = planningShiftCardShowsPointerCursor(
          {
            id: shift.id,
            shift_date: shift.shift_date,
            confirmationStatus: shift.confirmationStatus,
            requestedAt: shift.requestedAt,
            displayState: shift.displayState,
          },
          cellDate,
          isPastShiftDate,
          {
            shiftConfirmationEnabled,
            hasAbsenceConflict: absenceConflictShiftIds?.has(shift.id),
            hasSwapRequest: swapRequestShiftIds?.has(shift.id),
          }
        );

        return (
          <Tooltip
            key={segmentKey}
            content={<ShiftCardTooltipContent data={cardContent.tooltip} />}
            contentClassName={shiftCardTooltipContentClassName}
            className={cn(
              "inline-flex h-full min-h-0 min-w-0 shrink-0",
              employeeHighlighted && "relative z-10 overflow-visible"
            )}
            placement={{
              anchorLeftToTriggerCenter: true,
              gapPx: 2,
              side: "above",
            }}
          >
            <div
              className={cn(
                "flex h-full min-h-0 w-full min-w-0 shrink-0",
                segmentBorderRadiusClass(part)
              )}
              style={{
                boxShadow: cardBoxShadow,
                minHeight: PLANNING_CELL_HEIGHT_PX,
                width: cardWidthPx,
                maxWidth: cardWidthPx,
                ...(showUnresolvedCardStyle
                  ? { opacity: SHIFT_CARD_UNRESOLVED_OPACITY }
                  : undefined),
              }}
            >
              <button
                type="button"
                disabled={pending}
                data-planning-shift-card
                onMouseDown={preventPointerTextSelection}
                onClick={() => onShiftClick(shift.id)}
                onContextMenu={(event) => {
                  if (!onShiftContextMenu) return;
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
                        hasAbsenceConflict: absenceConflictShiftIds?.has(shift.id),
                      }
                    ),
                    () => onShiftContextMenu(shift.id, event)
                  );
                }}
                className={cn(
                  "relative flex h-full w-full min-h-0 min-w-0 overflow-hidden text-left text-black transition disabled:opacity-50",
                  SHIFT_CARD_INTERACTIVE_CLASS,
                  showsPointerCursor
                    ? "cursor-pointer hover:opacity-90"
                    : "!cursor-default",
                  segmentBorderRadiusClass(part),
                  isSelected && "ring-2 ring-primary ring-offset-1",
                  absenceConflictShiftIds?.has(shift.id) &&
                    !isSelected &&
                    SHIFT_ABSENCE_CONFLICT_RING_CLASS
                )}
                style={{
                  height: "100%",
                  minHeight: PLANNING_CELL_HEIGHT_PX,
                }}
                aria-label={cardContent.tooltipBody}
              >
              {showEmployeeStrip ? (
                <div
                  className={cn(
                    "shrink-0 self-stretch",
                    part !== "full" && "rounded-l"
                  )}
                  style={{
                    width: stripWidthPx,
                    backgroundColor: employeeColor,
                  }}
                  aria-hidden
                />
              ) : null}
              <DashboardShiftCardTextArea
                backgroundImage={buildPlanningShiftSegmentGradientCss(
                  part,
                  shift.startTime,
                  shift.endTime
                )}
              >
                {employeeHighlighted ? (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={employeeShiftHighlightOverlayStyle(employeeColor)}
                    aria-hidden
                  />
                ) : null}
                {showAnyText ? (
                  <DashboardExpandedShiftCardText
                    employeeName={employeeName}
                    templateName={cardContent.templateName}
                    timeLabel={cardContent.timeLabel}
                    jobsLine={jobsLine}
                    compact={!showTwoLineDetail}
                    inlineStatusLabel={inlineStatusLabel}
                  />
                ) : null}
                <DashboardShiftCardConfirmationOverlay
                  status={calendarConfirmationStatus}
                />
              </DashboardShiftCardTextArea>
              </button>
            </div>
          </Tooltip>
        );
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full min-w-0 flex-1 items-stretch"
      style={{
        minHeight: PLANNING_CELL_HEIGHT_PX,
        gap: PLANNING_EXPANDED_SHIFT_CELL_GAP_PX,
      }}
    >
      {leftSegments.map(renderSegment)}
      {onEmptyAreaClick ? (
        <button
          type="button"
          disabled={emptyAreaDisabled}
          onClick={onEmptyAreaClick}
          className="min-w-0 flex-1 self-stretch border-0 bg-transparent p-0 disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-primary/5"
          aria-label={emptyAreaLabel}
        />
      ) : (
        <div className="min-w-0 flex-1 self-stretch" aria-hidden />
      )}
      {rightSegments.map(renderSegment)}
    </div>
  );
}
