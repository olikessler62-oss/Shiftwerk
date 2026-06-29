"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW } from "@/components/areacalendar/areacalendar-shift-card-view";
import {
  DashboardExpandedShiftCardText,
  DashboardShiftCardTextArea,
} from "@/components/dashboard/dashboard-expanded-shift-card-text";
import { DashboardShiftCardConfirmationOverlay } from "@/components/dashboard/dashboard-shift-card-confirmation-overlay";
import { DashboardShiftCardOverflowIndicator } from "@/components/dashboard/dashboard-shift-card-overflow-indicator";
import { ShiftCardTooltipContent } from "@/components/shift-card-tooltip-content";
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
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX,
} from "@/lib/planning-calendar-layout";
import {
  buildPlanningExpandedShiftCardContent,
  resolvePlanningShiftAreaName,
  resolvePlanningShiftJobsLabel,
  type PlanningShiftJobContext,
} from "@/lib/planning-shift-card-display";
import type { PlanningOvernightSpanDisplayMode } from "@/lib/planning-overnight-span-layout";
import { PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX } from "@/lib/planning-overnight-span-layout";
import type { PlanningShift } from "@/lib/planning-shift-card";
import {
  shiftConfirmationTooltipStatusLabelKey,
  SHIFT_CARD_UNRESOLVED_OPACITY,
  shiftConfirmationShowsUnresolvedCardStyle,
} from "@/lib/shift-confirmation-display";
import { resolveShiftCardConfirmationStatusForCalendar } from "@/lib/shift-card-calendar-confirmation-status";
import {
  buildShiftCardTimeGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import { COLLAPSED_PAST_DAY_SHIFT_COLOR } from "@/lib/shift-card-cell-layout";
import { SHIFT_CARD_TWO_LINE_HEIGHT_PX } from "@/lib/shift-card-row-layout";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { planningShiftCardShowsPointerCursor } from "@/lib/shift-card-context-menu-actions";

import {
  SHIFT_CARD_MARKER_MAX_CELL_WIDTH_PX,
  SHIFT_CARD_MIN_TEXT_CONTENT_TRACK_PX,
} from "@/lib/shift-card-display-content";

const MIN_WIDTH_FOR_ANY_TEXT_PX = SHIFT_CARD_MIN_TEXT_CONTENT_TRACK_PX;
const MIN_WIDTH_FOR_TWO_LINE_DETAIL_PX = 56;

function resolveStripWidthPx(cardWidthPx: number): number {
  return cardWidthPx > 0 && cardWidthPx < MIN_WIDTH_FOR_ANY_TEXT_PX
    ? Math.max(2, Math.min(4, cardWidthPx))
    : SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX;
}

type Props = {
  shift: PlanningShift;
  widthPx: number;
  displayMode: PlanningOvernightSpanDisplayMode;
  collapsedMarkerWidthPx?: number;
  employeeName: string;
  employeeColor: string;
  isPastDay: boolean;
  cellDate: string;
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  shiftJobContext: PlanningShiftJobContext;
  pending: boolean;
  isSelected: boolean;
  onShiftClick: () => void;
  onShiftContextMenu?: (event: React.MouseEvent) => void;
  employeeHighlighted?: boolean;
  shiftConfirmationEnabled?: boolean;
};

export function DashboardOvernightSpanCard({
  shift,
  widthPx,
  displayMode,
  collapsedMarkerWidthPx,
  employeeName,
  employeeColor,
  isPastDay,
  cellDate,
  assignmentPresets,
  shiftJobContext,
  pending,
  isSelected,
  onShiftClick,
  onShiftContextMenu,
  employeeHighlighted = false,
  shiftConfirmationEnabled = true,
}: Props) {
  const t = useTranslations();
  const textContentRef = useRef<HTMLDivElement>(null);
  const [textOverflows, setTextOverflows] = useState(false);

  const isPastShift = isPastShiftDate(cellDate);
  const calendarConfirmationStatus = resolveShiftCardConfirmationStatusForCalendar(
    shift,
    cellDate
  );
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
  const cardContent = buildPlanningExpandedShiftCardContent(
    shift,
    assignmentPresets,
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
  const showAnyText =
    displayMode === "expanded" && widthPx >= MIN_WIDTH_FOR_ANY_TEXT_PX;
  const showTwoLineDetail =
    displayMode === "expanded" && widthPx >= MIN_WIDTH_FOR_TWO_LINE_DETAIL_PX;
  const stripWidthPx = resolveStripWidthPx(widthPx);
  const showsPointerCursor = planningShiftCardShowsPointerCursor(
    {
      shift_date: shift.shift_date,
      confirmationStatus: shift.confirmationStatus,
      requestedAt: shift.requestedAt,
    },
    cellDate,
    isPastShiftDate
  );

  useLayoutEffect(() => {
    const content = textContentRef.current;
    if (displayMode !== "expanded" || !content || !showAnyText) {
      setTextOverflows(false);
      return;
    }

    function updateOverflow() {
      if (!content) return;
      const overflows =
        content.scrollWidth > content.clientWidth + 1 ||
        content.scrollHeight > content.clientHeight + 1;
      setTextOverflows(overflows);
    }

    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(content);
    return () => observer.disconnect();
  }, [
    displayMode,
    showAnyText,
    cardContent.templateName,
    cardContent.timeLabel,
    jobsLine,
    widthPx,
  ]);

  if (displayMode === "collapsed") {
    const markerHeightPx = Math.max(
      1,
      SHIFT_CARD_TWO_LINE_HEIGHT_PX + PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX
    );
    const markerColor = isPastDay
      ? COLLAPSED_PAST_DAY_SHIFT_COLOR
      : employeeColor;

    return (
      <Tooltip
        content={<ShiftCardTooltipContent data={cardContent.tooltip} />}
        contentClassName={shiftCardTooltipContentClassName}
        className="inline-flex h-full"
      >
        <button
          type="button"
          disabled={pending}
          data-planning-shift-card
          onMouseDown={preventPointerTextSelection}
          onClick={onShiftClick}
          onContextMenu={(event) => {
            if (!onShiftContextMenu) return;
            event.preventDefault();
            event.stopPropagation();
            onShiftContextMenu(event);
          }}
          className={cn(
            "block shrink-0 rounded-sm border-0 p-0 shadow-sm transition disabled:opacity-50",
            SHIFT_CARD_INTERACTIVE_CLASS,
            showsPointerCursor
              ? "cursor-pointer hover:opacity-90"
              : "!cursor-default",
            isSelected && "ring-2 ring-primary ring-offset-1"
          )}
          style={{
            width:
              collapsedMarkerWidthPx ?? PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,
            height: markerHeightPx,
            backgroundColor: markerColor,
          }}
          aria-label={cardContent.tooltipBody}
        />
      </Tooltip>
    );
  }

  const showOverflowIndicator = !showAnyText || textOverflows;
  const cardBoxShadow =
    employeeHighlighted && displayMode === "expanded"
      ? buildEmployeeShiftHighlightBoxShadow(
          AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW,
          employeeColor
        )
      : AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW;

  return (
    <Tooltip
      content={<ShiftCardTooltipContent data={cardContent.tooltip} />}
      contentClassName={shiftCardTooltipContentClassName}
      className={cn(
        "inline-flex h-full w-full min-w-0",
        employeeHighlighted && displayMode === "expanded" && "relative z-10 overflow-visible"
      )}
      placement={{
        anchorLeftToTriggerCenter: true,
        gapPx: 2,
        side: "above",
      }}
    >
      <div
        className="h-full w-full rounded"
        style={{
          boxShadow: cardBoxShadow,
          minHeight: PLANNING_CELL_HEIGHT_PX,
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
          onClick={onShiftClick}
          onContextMenu={(event) => {
            if (!onShiftContextMenu) return;
            event.preventDefault();
            event.stopPropagation();
            onShiftContextMenu(event);
          }}
          className={cn(
            "relative flex h-full w-full shrink-0 overflow-hidden rounded text-left text-black transition disabled:opacity-50",
            SHIFT_CARD_INTERACTIVE_CLASS,
            showsPointerCursor
              ? "cursor-pointer hover:opacity-90"
              : "!cursor-default",
            isSelected && "ring-2 ring-primary ring-offset-1"
          )}
          style={{
            height: "100%",
            minHeight: PLANNING_CELL_HEIGHT_PX,
          }}
          aria-label={cardContent.tooltipBody}
        >
        <div
          className="shrink-0 self-stretch rounded-l"
          style={{
            width: stripWidthPx,
            backgroundColor: employeeColor,
          }}
          aria-hidden
        />
        <DashboardShiftCardTextArea
          contentRef={textContentRef}
          backgroundImage={buildShiftCardTimeGradientCss(
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
          {showOverflowIndicator ? <DashboardShiftCardOverflowIndicator /> : null}
          <DashboardShiftCardConfirmationOverlay status={calendarConfirmationStatus} />
        </DashboardShiftCardTextArea>
        </button>
      </div>
    </Tooltip>
  );
}
