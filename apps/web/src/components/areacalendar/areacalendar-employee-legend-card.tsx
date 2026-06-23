"use client";

import type { MouseEvent, ReactNode } from "react";
import { Tooltip, employeeAvailabilityTooltipContentClassName, employeeAvailabilityTooltipPlacement, HOVER_TOOLTIP_OPEN_DELAY_MS } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { AreaCalendarWeekLegendEmployee } from "@/lib/areacalendar-week-employee-legend";
import {
  AREA_CALENDAR_EMPLOYEE_LEGEND_CARD_HEIGHT_PX,
  AREA_CALENDAR_EMPLOYEE_LEGEND_CARD_LIST_ITEM_HEIGHT_PX,
  AREA_CALENDAR_EMPLOYEE_LEGEND_PRIMARY_FONT_PX,
  AREA_CALENDAR_EMPLOYEE_LEGEND_SECONDARY_FONT_PX,
} from "@/lib/areacalendar-week-employee-legend";
import { splitEmployeeDisplayName } from "@/lib/shift-card-display-content";
import { SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX } from "@/lib/shift-card-time-gradient";
import { SHIFT_CARD_SHADOW_BLEED_PX } from "@/lib/shift-card-row-layout";
import { formatPlanningHoursRatio } from "@/lib/planning-utils";

const EMPLOYEE_LEGEND_CARD_FRAME_CLASS =
  "box-border w-full overflow-hidden rounded border border-black/[0.07]";

const EMPLOYEE_LEGEND_CARD_DROP_SHADOW = "0 1px 2px rgba(0, 0, 0, 0.45)";

const EMPLOYEE_COLOR_FALLBACK = "#94a3b8";

const SHIFT_CARD_SURFACE_CLASS =
  "relative flex shrink-0 overflow-hidden rounded";

type Props = {
  employee: AreaCalendarWeekLegendEmployee;
  weekHours: number;
  targetHours: number;
  locale: string;
  employeeHoursLabel: string;
  availabilityTooltip: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
};

export function AreaCalendarEmployeeLegendCard({
  employee,
  weekHours,
  targetHours,
  locale,
  employeeHoursLabel,
  availabilityTooltip,
  onMouseEnter,
  onMouseLeave,
  onContextMenu,
}: Props) {
  const employeeColor = employee.color?.trim() || EMPLOYEE_COLOR_FALLBACK;
  const { firstName, lastName } = splitEmployeeDisplayName(employee.full_name);
  const overHours = weekHours > targetHours;
  const hoursLabel = formatPlanningHoursRatio(weekHours, targetHours, locale);
  const cardHeightPx = AREA_CALENDAR_EMPLOYEE_LEGEND_CARD_HEIGHT_PX;

  return (
    <Tooltip
      className="block w-full"
      content={availabilityTooltip}
      contentClassName={employeeAvailabilityTooltipContentClassName}
      placement={employeeAvailabilityTooltipPlacement}
      openDelayMs={HOVER_TOOLTIP_OPEN_DELAY_MS}
    >
      <div
        className="shrink-0 self-start"
        style={{
          width: `calc(100% - ${SHIFT_CARD_SHADOW_BLEED_PX}px)`,
          height: AREA_CALENDAR_EMPLOYEE_LEGEND_CARD_LIST_ITEM_HEIGHT_PX,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
      >
      <div
        className={EMPLOYEE_LEGEND_CARD_FRAME_CLASS}
        data-employee-availability-tooltip-anchor
        style={{
          boxShadow: EMPLOYEE_LEGEND_CARD_DROP_SHADOW,
          height: cardHeightPx,
          minHeight: cardHeightPx,
        }}
      >
        <div
          className={cn(
            SHIFT_CARD_SURFACE_CLASS,
            "h-full w-full cursor-default"
          )}
          style={{
            height: cardHeightPx,
            minHeight: cardHeightPx,
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
          <div className="relative flex min-w-0 flex-1 items-center bg-white px-2 py-1 text-black">
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <div
                className="flex min-w-0 items-baseline gap-1.5 leading-tight"
                style={{ fontSize: AREA_CALENDAR_EMPLOYEE_LEGEND_PRIMARY_FONT_PX }}
              >
                <span className="shrink-0 font-medium">{firstName}</span>
                {lastName ? (
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {lastName}
                  </span>
                ) : null}
              </div>
              <div
                className={cn(
                  "min-w-0 truncate leading-tight",
                  overHours ? "font-medium text-amber-600" : "text-black/85"
                )}
                style={{ fontSize: AREA_CALENDAR_EMPLOYEE_LEGEND_SECONDARY_FONT_PX }}
              >
                {employeeHoursLabel} {hoursLabel}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </Tooltip>
  );
}
