"use client";

import {
  buildShiftCardTimeGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import {
  SHIFT_CARD_EXTRA_HEIGHT_PX,
  SHIFT_CARD_TWO_LINE_HEIGHT_PX,
  shiftCardListItemHeightPx,
} from "@/lib/shift-card-row-layout";
import {
  buildShiftCardDisplayContent,
  resolveJobLabelsForEmployee,
  type ShiftCardDisplayContent,
  type ShiftCardDensity,
} from "@/lib/shift-card-display-content";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import { Tooltip } from "@/components/ui";
import { ShiftCardTooltipContent } from "@/components/shift-card-tooltip-content";
import { cn } from "@/lib/cn";
import {
  shiftConfirmationBadgeSymbol,
  shiftConfirmationShowsOverlay,
  shiftConfirmationStatusLabelKey,
} from "@/lib/shift-confirmation-display";

export type DashboardShiftCard = {
  id: string;
  shift_date: string;
  locationAreaId: string | null;
  areaShiftTemplateId: string | null;
  employeeId: string;
  shiftName: string;
  color: string;
  startTime: string;
  endTime: string;
  employeeName: string;
  employeeColor: string | null;
  confirmationStatus?: ShiftConfirmationStatus;
};

const DASHBOARD_SHIFT_CARD_CLASS =
  "relative flex shrink-0 overflow-hidden rounded";

/** Kompakter, dunklerer Schatten — passt in {@link shiftCardListItemHeightPx}. */
export const DASHBOARD_SHIFT_CARD_BOX_SHADOW =
  "0 1px 2px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.07)";

const DASHBOARD_SHIFT_CARD_MARKER_MIN_HEIGHT_PX =
  16 + SHIFT_CARD_EXTRA_HEIGHT_PX;

const DASHBOARD_SHIFT_CARD_CONTENT_CLASS =
  "flex min-w-0 flex-1 bg-white px-1.5 py-0.5 text-black";

const DASHBOARD_SHIFT_CARD_EMPLOYEE_FALLBACK_COLOR = "#94a3b8";

type Props = {
  shift: DashboardShiftCard;
  display: ShiftCardDisplayContent;
  widthPx?: number;
  marginLeftPx?: number;
  density: ShiftCardDensity;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  confirmationStatusLabel?: string;
};

function ShiftCardTextRows({
  display,
  density,
}: {
  display: ShiftCardDisplayContent;
  density: ShiftCardDensity;
}) {
  if (density === "marker") {
    return null;
  }

  if (density === "compact") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px]">
        <span className="shrink-0 font-medium leading-none">{display.firstName}</span>
        {display.lastName ? (
          <span className="min-w-0 truncate font-medium leading-none">
            {display.lastName}
          </span>
        ) : null}
        <span className="shrink-0 whitespace-nowrap leading-none tabular-nums">
          {display.line1Secondary}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-px">
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
    </div>
  );
}

export function DashboardShiftCardView({
  shift,
  display,
  widthPx,
  marginLeftPx,
  density,
  onClick,
  onContextMenu,
  confirmationStatusLabel,
}: Props) {
  const employeeColor =
    shift.employeeColor?.trim() || DASHBOARD_SHIFT_CARD_EMPLOYEE_FALLBACK_COLOR;

  const cardHeightPx =
    density === "marker"
      ? DASHBOARD_SHIFT_CARD_MARKER_MIN_HEIGHT_PX
      : SHIFT_CARD_TWO_LINE_HEIGHT_PX;

  const confirmationStatus = shift.confirmationStatus;
  const showConfirmationOverlay =
    density !== "marker" &&
    confirmationStatus &&
    shiftConfirmationShowsOverlay(confirmationStatus);

  const tooltipData =
    showConfirmationOverlay && confirmationStatusLabel
      ? { ...display.tooltip, confirmationStatusLine: confirmationStatusLabel }
      : display.tooltip;

  return (
    <div
      className="max-w-full shrink-0 self-start"
      style={{
        height: shiftCardListItemHeightPx(cardHeightPx),
        ...(marginLeftPx !== undefined ? { marginLeft: marginLeftPx } : undefined),
      }}
    >
      <Tooltip
        content={<ShiftCardTooltipContent data={tooltipData} />}
        className="inline-flex w-fit max-w-full"
        placement={{
          anchorLeftToTriggerCenter: true,
          gapPx: 2,
          side: "above",
        }}
      >
        <div
          data-dashboard-shift-card
          role={onClick ? "button" : undefined}
          tabIndex={onClick ? 0 : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onClick?.();
          }}
          onContextMenu={
            onContextMenu
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onContextMenu(event);
                }
              : undefined
          }
          onKeyDown={
            onClick
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onClick();
                  }
                }
              : undefined
          }
          className={cn(
            DASHBOARD_SHIFT_CARD_CLASS,
            widthPx === undefined && "w-full",
            onClick && "cursor-pointer"
          )}
          style={{
            ...(widthPx !== undefined ? { width: widthPx } : undefined),
            height: cardHeightPx,
            minHeight: cardHeightPx,
            boxShadow: DASHBOARD_SHIFT_CARD_BOX_SHADOW,
          }}
        >
        <div
          className="shrink-0 self-stretch"
          style={{
            width: SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
            backgroundColor: employeeColor,
          }}
          aria-hidden
        />
        {density === "marker" ? (
          <div
            className="flex-1 self-stretch opacity-0"
            style={{ minHeight: DASHBOARD_SHIFT_CARD_MARKER_MIN_HEIGHT_PX }}
            aria-hidden
          />
        ) : (
          <div
            className={cn(
              DASHBOARD_SHIFT_CARD_CONTENT_CLASS,
              "relative items-center gap-1.5"
            )}
            style={{
              backgroundImage: buildShiftCardTimeGradientCss(
                shift.startTime,
                shift.endTime
              ),
            }}
          >
            <ShiftCardTextRows display={display} density={density} />
            {showConfirmationOverlay && confirmationStatus ? (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-black/25"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-sm bg-white/90 px-0.5 text-[10px] font-semibold leading-none text-foreground shadow-sm"
                  aria-hidden
                >
                  {shiftConfirmationBadgeSymbol(confirmationStatus)}
                </div>
              </>
            ) : null}
          </div>
        )}
        </div>
      </Tooltip>
    </div>
  );
}

export { buildShiftCardDisplayContent, resolveJobLabelsForEmployee };
