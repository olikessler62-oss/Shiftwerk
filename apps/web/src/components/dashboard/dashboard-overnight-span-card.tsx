"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  DASHBOARD_SHIFT_CARD_BOX_SHADOW,
  type DashboardShiftCard,
} from "@/components/dashboard/dashboard-shift-card-view";
import { PlanningShiftCardConfirmationOverlay } from "@/components/planning/planning-shift-card-confirmation-overlay";
import { PlanningShiftCardOverflowIndicator } from "@/components/planning/planning-shift-card-overflow-indicator";
import { Tooltip, shiftCardTooltipContentClassName } from "@/components/ui/tooltip";
import { ShiftCardTooltipContent } from "@/components/shift-card-tooltip-content";
import { useTranslations } from "@/i18n/locale-provider";
import { formatShiftCardTooltipPlainText } from "@/lib/shift-card-display-content";
import { cn } from "@/lib/cn";
import {
  buildEmployeeShiftHighlightBoxShadow,
  employeeShiftHighlightOverlayStyle,
} from "@/lib/calendar-interaction-ui";
import { shiftConfirmationTooltipStatusLabelKey } from "@/lib/shift-confirmation-display";
import type { PlanningOvernightSpanDisplayMode } from "@/lib/planning-overnight-span-layout";
import { DASHBOARD_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX } from "@/lib/dashboard-overnight-span-layout";
import { PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX } from "@/lib/planning-calendar-layout";
import { COLLAPSED_PAST_DAY_SHIFT_COLOR } from "@/lib/shift-card-cell-layout";
import type { ShiftCardDisplayContent } from "@/lib/shift-card-display-content";
import {
  buildShiftCardTimeGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import {
  SHIFT_CARD_TWO_LINE_HEIGHT_PX,
  shiftCardListItemHeightPx,
} from "@/lib/shift-card-row-layout";

const MIN_WIDTH_FOR_TIME_PX = 40;
const MIN_WIDTH_FOR_TITLE_PX = 64;

type Props = {
  shift: DashboardShiftCard;
  display: ShiftCardDisplayContent;
  widthPx: number;
  displayMode: PlanningOvernightSpanDisplayMode;
  isPastDay: boolean;
  pending?: boolean;
  isSelected?: boolean;
  onShiftClick: () => void;
  onShiftContextMenu?: (event: React.MouseEvent) => void;
  employeeHighlighted?: boolean;
};

function ExpandedSpanCardText({
  display,
  compact,
}: {
  display: ShiftCardDisplayContent;
  compact: boolean;
}) {
  if (compact) {
    return (
      <div className="flex min-w-0 items-baseline gap-1 overflow-hidden text-[11px] leading-none">
        <span className="shrink-0 font-medium">{display.firstName}</span>
        {display.lastName ? (
          <span className="min-w-0 truncate font-medium">{display.lastName}</span>
        ) : null}
        <span className="shrink-0 whitespace-nowrap tabular-nums">
          {display.line1Secondary ?? display.timeLabel}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-w-0 items-baseline gap-1.5 text-[11px] leading-none">
        <span className="shrink-0 font-medium">{display.firstName}</span>
        {display.lastName ? (
          <span className="min-w-0 flex-1 truncate font-medium">{display.lastName}</span>
        ) : null}
      </div>
      <div className="flex min-w-0 items-baseline gap-1.5 text-[10px] leading-none text-black/85">
        {display.shiftLabel ? (
          <span className="shrink-0">{display.shiftLabel}</span>
        ) : (
          <span className="shrink-0 whitespace-nowrap tabular-nums">
            {display.timeLabel}
          </span>
        )}
        {display.jobsLabel ? (
          <span className="min-w-0 truncate">{display.jobsLabel}</span>
        ) : null}
      </div>
    </>
  );
}

export function DashboardOvernightSpanCard({
  shift,
  display,
  widthPx,
  displayMode,
  isPastDay,
  pending = false,
  isSelected = false,
  onShiftClick,
  onShiftContextMenu,
  employeeHighlighted = false,
}: Props) {
  const t = useTranslations();
  const textContentRef = useRef<HTMLDivElement>(null);
  const [textOverflows, setTextOverflows] = useState(false);

  const confirmationStatusLabel = shift.confirmationStatus
    ? t(shiftConfirmationTooltipStatusLabelKey(shift.confirmationStatus))
    : undefined;
  const tooltipData = confirmationStatusLabel
    ? {
        ...display.tooltip,
        confirmationStatusLine: confirmationStatusLabel,
        confirmationStatus: shift.confirmationStatus,
      }
    : display.tooltip;
  const tooltipPlainText = confirmationStatusLabel
    ? formatShiftCardTooltipPlainText(tooltipData, {
        formatStatusLine: (status) =>
          `${t("common.shiftCardTooltipStatusLabel")} ${status}`,
      })
    : display.tooltipBody;

  const employeeColor =
    shift.employeeColor?.trim() || "#94a3b8";
  const showAnyText =
    displayMode === "expanded" && widthPx >= MIN_WIDTH_FOR_TIME_PX;
  const showTitle =
    displayMode === "expanded" && widthPx >= MIN_WIDTH_FOR_TITLE_PX;

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
  }, [displayMode, showAnyText, display, widthPx]);

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
        content={<ShiftCardTooltipContent data={tooltipData} />}
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
            width: DASHBOARD_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,
            height: markerHeightPx,
            backgroundColor: markerColor,
          }}
          aria-label={tooltipPlainText}
        />
      </Tooltip>
    );
  }

  const showOverflowIndicator = !showAnyText || textOverflows;
  const cardHeightPx = SHIFT_CARD_TWO_LINE_HEIGHT_PX;
  const cardBoxShadow =
    employeeHighlighted && displayMode === "expanded"
      ? buildEmployeeShiftHighlightBoxShadow(
          DASHBOARD_SHIFT_CARD_BOX_SHADOW,
          employeeColor
        )
      : DASHBOARD_SHIFT_CARD_BOX_SHADOW;

  return (
    <Tooltip
      content={<ShiftCardTooltipContent data={tooltipData} />}
      contentClassName={shiftCardTooltipContentClassName}
      className="inline-flex h-full w-full min-w-0"
      placement={{
        anchorLeftToTriggerCenter: true,
        gapPx: 2,
        side: "above",
      }}
    >
      <div
        className={cn(
          "h-full w-full",
          employeeHighlighted && displayMode === "expanded" && "relative z-[25] overflow-visible"
        )}
      >
        <div
          className="h-full w-full rounded overflow-visible"
          style={{
            boxShadow: cardBoxShadow,
            height: cardHeightPx,
            minHeight: cardHeightPx,
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
              height: cardHeightPx,
              minHeight: cardHeightPx,
            }}
            aria-label={tooltipPlainText}
          >
            <div
              className="shrink-0 self-stretch"
              style={{
                width: SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
                backgroundColor: employeeColor,
              }}
              aria-hidden
            />
            <div
              ref={textContentRef}
              className="relative flex min-w-0 flex-1 flex-col justify-center overflow-hidden bg-white px-1.5 py-0.5"
              style={{
                backgroundImage: buildShiftCardTimeGradientCss(
                  shift.startTime,
                  shift.endTime
                ),
              }}
            >
              {employeeHighlighted ? (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={employeeShiftHighlightOverlayStyle(employeeColor)}
                  aria-hidden
                />
              ) : null}
              {showAnyText ? (
                <ExpandedSpanCardText display={display} compact={!showTitle} />
              ) : null}
              {showOverflowIndicator ? (
                <PlanningShiftCardOverflowIndicator />
              ) : null}
              <PlanningShiftCardConfirmationOverlay status={shift.confirmationStatus} />
            </div>
          </button>
        </div>
      </div>
    </Tooltip>
  );
}

export function dashboardOvernightSpanRowHeightPx(): number {
  return shiftCardListItemHeightPx(SHIFT_CARD_TWO_LINE_HEIGHT_PX);
}
