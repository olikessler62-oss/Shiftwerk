"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { DASHBOARD_SHIFT_CARD_BOX_SHADOW } from "@/components/dashboard/dashboard-shift-card-view";
import {
  PlanningExpandedShiftCardText,
  PlanningShiftCardTextArea,
} from "@/components/planning/planning-expanded-shift-card-text";
import { PlanningShiftCardConfirmationOverlay } from "@/components/planning/planning-shift-card-confirmation-overlay";
import { PlanningShiftCardOverflowIndicator } from "@/components/planning/planning-shift-card-overflow-indicator";
import { ShiftCardTooltipContent } from "@/components/shift-card-tooltip-content";
import { Tooltip, shiftCardTooltipContentClassName } from "@/components/ui/tooltip";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  buildEmployeeShiftHighlightBoxShadow,
  employeeShiftHighlightOverlayStyle,
} from "@/lib/calendar-interaction-ui";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import {
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX,
} from "@/lib/planning-calendar-layout";
import {
  buildPlanningExpandedShiftCardContent,
  resolvePlanningShiftJobsLabel,
  type PlanningShiftJobContext,
} from "@/lib/planning-shift-card-display";
import type { PlanningOvernightSpanDisplayMode } from "@/lib/planning-overnight-span-layout";
import { PLANNING_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX } from "@/lib/planning-overnight-span-layout";
import type { PlanningShift } from "@/lib/planning-shift-card";
import { shiftConfirmationTooltipStatusLabelKey } from "@/lib/shift-confirmation-display";
import {
  buildShiftCardTimeGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import { COLLAPSED_PAST_DAY_SHIFT_COLOR } from "@/lib/shift-card-cell-layout";
import { SHIFT_CARD_TWO_LINE_HEIGHT_PX } from "@/lib/shift-card-row-layout";

const MIN_WIDTH_FOR_TIME_PX = 40;
const MIN_WIDTH_FOR_TITLE_PX = 64;

function resolveStripWidthPx(cardWidthPx: number): number {
  return cardWidthPx > 0 && cardWidthPx < MIN_WIDTH_FOR_TIME_PX
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
  assignmentPresets: readonly DashboardAssignmentPreset[];
  shiftJobContext: PlanningShiftJobContext;
  pending: boolean;
  isSelected: boolean;
  onShiftClick: () => void;
  onShiftContextMenu?: (event: React.MouseEvent) => void;
  employeeHighlighted?: boolean;
};

export function PlanningOvernightSpanCard({
  shift,
  widthPx,
  displayMode,
  collapsedMarkerWidthPx,
  employeeName,
  employeeColor,
  isPastDay,
  assignmentPresets,
  shiftJobContext,
  pending,
  isSelected,
  onShiftClick,
  onShiftContextMenu,
  employeeHighlighted = false,
}: Props) {
  const t = useTranslations();
  const textContentRef = useRef<HTMLDivElement>(null);
  const [textOverflows, setTextOverflows] = useState(false);

  const confirmationStatusLine = shift.confirmationStatus
    ? t(shiftConfirmationTooltipStatusLabelKey(shift.confirmationStatus))
    : undefined;
  const jobsLabel = resolvePlanningShiftJobsLabel(shift, shiftJobContext);
  const jobsLine = jobsLabel.trim()
    ? t("common.shiftCardTooltipJob", { names: jobsLabel })
    : null;
  const cardContent = buildPlanningExpandedShiftCardContent(
    shift,
    assignmentPresets,
    {
      employeeName,
      confirmationStatusLine,
      confirmationStatus: shift.confirmationStatus,
      jobsLabel,
      formatTemplateTooltipLine: (templateName) =>
        t("common.shiftCardTooltipShift", { name: templateName }),
      formatJobTooltipLine: (names) =>
        t("common.shiftCardTooltipJob", { names }),
      formatStatusTooltipLine: (status) =>
        `${t("common.shiftCardTooltipStatusLabel")} ${status}`,
    }
  );
  const showAnyText =
    displayMode === "expanded" && widthPx >= MIN_WIDTH_FOR_TIME_PX;
  const showTitle =
    displayMode === "expanded" && widthPx >= MIN_WIDTH_FOR_TITLE_PX;
  const stripWidthPx = resolveStripWidthPx(widthPx);

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
          onClick={onShiftClick}
          className={cn(
            "block shrink-0 cursor-pointer rounded-sm border-0 p-0 shadow-sm transition hover:opacity-90 disabled:opacity-50",
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
          DASHBOARD_SHIFT_CARD_BOX_SHADOW,
          employeeColor
        )
      : DASHBOARD_SHIFT_CARD_BOX_SHADOW;

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
        }}
      >
        <button
          type="button"
          disabled={pending}
          onClick={onShiftClick}
          onContextMenu={(event) => {
            if (!onShiftContextMenu) return;
            event.preventDefault();
            event.stopPropagation();
            onShiftContextMenu(event);
          }}
          className={cn(
            "relative flex h-full w-full shrink-0 overflow-hidden rounded text-left text-black transition hover:opacity-90 disabled:opacity-50",
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
        <PlanningShiftCardTextArea
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
            <PlanningExpandedShiftCardText
              templateName={cardContent.templateName}
              timeLabel={cardContent.timeLabel}
              jobsLine={jobsLine}
              compact={!showTitle}
            />
          ) : null}
          {showOverflowIndicator ? <PlanningShiftCardOverflowIndicator /> : null}
          <PlanningShiftCardConfirmationOverlay status={shift.confirmationStatus} />
        </PlanningShiftCardTextArea>
        </button>
      </div>
    </Tooltip>
  );
}
