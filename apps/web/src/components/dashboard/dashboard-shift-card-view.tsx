"use client";

import {
  buildShiftCardTimeGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import {
  SHIFT_CARD_EXTRA_HEIGHT_PX,
  SHIFT_CARD_TWO_LINE_HEIGHT_PX,
} from "@/lib/shift-card-row-layout";
import {
  buildShiftCardDisplayContent,
  resolveJobLabelsForEmployee,
  type ShiftCardDisplayContent,
  type ShiftCardDensity,
} from "@/lib/shift-card-display-content";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

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
};

const DASHBOARD_SHIFT_CARD_CLASS =
  "relative flex shrink-0 overflow-hidden rounded shadow-md";

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
    const name = display.lastName
      ? `${display.firstName} ${display.lastName}`
      : display.firstName;
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px]">
        <span className="min-w-0 truncate font-medium leading-none">{name}</span>
        <span className="shrink-0 whitespace-nowrap leading-none tabular-nums">
          {display.line1Secondary}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-px">
      <div className="flex min-w-0 items-baseline gap-1.5 text-[11px] leading-none">
        <span className="min-w-0 truncate font-medium">{display.firstName}</span>
        {display.lastName ? (
          <span className="min-w-0 truncate font-medium">{display.lastName}</span>
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
}: Props) {
  const employeeColor =
    shift.employeeColor?.trim() || DASHBOARD_SHIFT_CARD_EMPLOYEE_FALLBACK_COLOR;

  return (
    <div
      className="self-start max-w-full"
      style={{
        ...(marginLeftPx !== undefined ? { marginLeft: marginLeftPx } : undefined),
      }}
    >
      <Tooltip
        content={display.tooltipBody}
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
            height:
              density === "marker"
                ? DASHBOARD_SHIFT_CARD_MARKER_MIN_HEIGHT_PX
                : SHIFT_CARD_TWO_LINE_HEIGHT_PX,
            minHeight:
              density === "marker"
                ? DASHBOARD_SHIFT_CARD_MARKER_MIN_HEIGHT_PX
                : SHIFT_CARD_TWO_LINE_HEIGHT_PX,
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
            className={cn(DASHBOARD_SHIFT_CARD_CONTENT_CLASS, "items-center gap-1.5")}
            style={{
              backgroundImage: buildShiftCardTimeGradientCss(
                shift.startTime,
                shift.endTime
              ),
            }}
          >
            <ShiftCardTextRows display={display} density={density} />
          </div>
        )}
        </div>
      </Tooltip>
    </div>
  );
}

export { buildShiftCardDisplayContent, resolveJobLabelsForEmployee };
