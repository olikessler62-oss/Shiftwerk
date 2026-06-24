"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW,
  type AreaCalendarShiftCard,
} from "@/components/areacalendar/areacalendar-shift-card-view";
import { DashboardShiftCardConfirmationOverlay } from "@/components/dashboard/dashboard-shift-card-confirmation-overlay";
import { DashboardShiftCardOverflowIndicator } from "@/components/dashboard/dashboard-shift-card-overflow-indicator";
import { Tooltip, shiftCardTooltipContentClassName } from "@/components/ui/tooltip";
import { ShiftCardTooltipContent } from "@/components/shift-card-tooltip-content";
import { useTranslations } from "@/i18n/locale-provider";
import { formatShiftCardTooltipPlainText } from "@/lib/shift-card-display-content";
import { cn } from "@/lib/cn";
import {
  buildEmployeeShiftHighlightBoxShadow,
  employeeShiftHighlightOverlayStyle,
  preventPointerTextSelection,
  SHIFT_CARD_INTERACTIVE_CLASS,
} from "@/lib/calendar-interaction-ui";
import { shiftConfirmationTooltipStatusLabelKey } from "@/lib/shift-confirmation-display";
import type { PlanningOvernightSpanDisplayMode } from "@/lib/planning-overnight-span-layout";
import { AREA_CALENDAR_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX } from "@/lib/areacalendar-overnight-span-layout";
import { PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX } from "@/lib/planning-calendar-layout";
import { COLLAPSED_PAST_DAY_SHIFT_COLOR } from "@/lib/shift-card-cell-layout";
import {
  SHIFT_CARD_MIN_TEXT_CONTENT_TRACK_PX,
  type ShiftCardDisplayContent,
} from "@/lib/shift-card-display-content";
import {
  buildShiftCardTimeGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import {
  AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX,
  areaCalendarShiftCardListItemHeightPx,
} from "@/lib/shift-card-row-layout";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { planningShiftCardShowsPointerCursor } from "@/lib/shift-card-context-menu-actions";

const MIN_WIDTH_FOR_ANY_TEXT_PX = SHIFT_CARD_MIN_TEXT_CONTENT_TRACK_PX;
const MIN_WIDTH_FOR_TWO_LINE_DETAIL_PX = 56;

type Props = {
  shift: AreaCalendarShiftCard;
  display: ShiftCardDisplayContent;
  widthPx: number;
  displayMode: PlanningOvernightSpanDisplayMode;
  isPastDay: boolean;
  cellDate: string;
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
  const secondaryLabel =
    display.templateName?.trim() || display.shiftLabel.trim();
  const employeeLine = display.lastName
    ? `${display.firstName} ${display.lastName}`
    : display.firstName;

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-1 overflow-hidden text-[11px] leading-none">
        <span className="min-w-[1ch] max-w-[45%] truncate font-bold">
          {display.firstName}
        </span>
        <span className="min-w-[1ch] max-w-full truncate tabular-nums">
          {secondaryLabel ? (
            <>
              <span className="font-bold">{secondaryLabel}</span>
              <span className="font-normal"> {display.timeLabel}</span>
            </>
          ) : (
            <span className="font-bold">{display.timeLabel}</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col justify-center gap-px overflow-hidden">
      <div className="min-w-[1ch] max-w-full truncate text-[11px] font-bold leading-none">
        {employeeLine}
      </div>
      <div className="min-w-[1ch] max-w-full truncate text-[10px] leading-none tabular-nums">
        {secondaryLabel ? (
          <>
            <span className="font-bold">{secondaryLabel}</span>
            <span className="font-normal"> {display.timeLabel}</span>
          </>
        ) : (
          <span className="font-bold">{display.timeLabel}</span>
        )}
      </div>
      {display.jobsLabel ? (
        <div className="min-w-[1ch] max-w-full truncate text-[10px] leading-none">
          {display.jobsLabel}
        </div>
      ) : null}
    </div>
  );
}

export function AreaCalendarOvernightSpanCard({
  shift,
  display,
  widthPx,
  displayMode,
  isPastDay,
  cellDate,
  pending = false,
  isSelected = false,
  onShiftClick,
  onShiftContextMenu,
  employeeHighlighted = false,
}: Props) {
  const t = useTranslations();
  const textContentRef = useRef<HTMLDivElement>(null);
  const [textOverflows, setTextOverflows] = useState(false);

  const isPastShift = isPastShiftDate(cellDate);
  const confirmationStatusLabel = shift.confirmationStatus
    ? t(shiftConfirmationTooltipStatusLabelKey(shift.confirmationStatus))
    : undefined;
  const tooltipData = confirmationStatusLabel
    ? {
        ...display.tooltip,
        confirmationStatusLine: confirmationStatusLabel,
        confirmationStatus: shift.confirmationStatus,
        isPastShift,
      }
    : {
        ...display.tooltip,
        isPastShift,
      };
  const tooltipPlainText = confirmationStatusLabel
    ? formatShiftCardTooltipPlainText(tooltipData, {
        formatStatusLine: (status) =>
          `${t("common.shiftCardTooltipStatusLabel")} ${status}`,
      })
    : display.tooltipBody;

  const employeeColor =
    shift.employeeColor?.trim() || "#94a3b8";
  const showAnyText =
    displayMode === "expanded" && widthPx >= MIN_WIDTH_FOR_ANY_TEXT_PX;
  const showTwoLineDetail =
    displayMode === "expanded" && widthPx >= MIN_WIDTH_FOR_TWO_LINE_DETAIL_PX;
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
  }, [displayMode, showAnyText, display, widthPx]);

  if (displayMode === "collapsed") {
    const markerHeightPx = Math.max(
      1,
      AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX + PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX
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
            width: AREA_CALENDAR_OVERNIGHT_COLLAPSED_SPAN_WIDTH_PX,
            height: markerHeightPx,
            backgroundColor: markerColor,
          }}
          aria-label={tooltipPlainText}
        />
      </Tooltip>
    );
  }

  const showOverflowIndicator = !showAnyText || textOverflows;
  const cardHeightPx = AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX;
  const cardBoxShadow =
    employeeHighlighted && displayMode === "expanded"
      ? buildEmployeeShiftHighlightBoxShadow(
          AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW,
          employeeColor
        )
      : AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW;

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
          employeeHighlighted &&
            displayMode === "expanded" &&
            "relative z-10 overflow-visible"
        )}
      >
        <div
          className={cn(
            "h-full w-full rounded",
            employeeHighlighted && displayMode === "expanded" && "overflow-visible"
          )}
          style={{
            boxShadow: cardBoxShadow,
            height: cardHeightPx,
            minHeight: cardHeightPx,
          }}
        >
          <button
            type="button"
            disabled={pending}
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
                <ExpandedSpanCardText display={display} compact={!showTwoLineDetail} />
              ) : null}
              {showOverflowIndicator ? (
                <DashboardShiftCardOverflowIndicator />
              ) : null}
              <DashboardShiftCardConfirmationOverlay status={shift.confirmationStatus} />
            </div>
          </button>
        </div>
      </div>
    </Tooltip>
  );
}

export function areaCalendarOvernightSpanRowHeightPx(): number {
  return areaCalendarShiftCardListItemHeightPx(
    AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX
  );
}
