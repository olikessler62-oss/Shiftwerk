"use client";

import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import {
  formatPlanningHoursInParens,
  formatTimeRange,
  shiftHours,
} from "@/lib/planning-utils";
import { areAreaCalendarShiftTimesComplete } from "@/lib/available-employees-for-shift";
import { buildShiftCardTimeGradientCss } from "@/lib/shift-card-time-gradient";
import { AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW } from "@/components/areacalendar/areacalendar-shift-card-view";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { cn } from "@/lib/cn";

const PLANNING_SHIFT_TEMPLATE_LIST_CLASS = "space-y-[0.32rem] pb-1";
const PLANNING_SHIFT_TEMPLATE_CARD_INNER_CLASS =
  "relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-white px-2 py-[0.4rem]";
const PLANNING_SHIFT_TEMPLATE_CARD_TITLE_CLASS =
  "min-w-0 text-sm font-medium leading-none text-black";
const PLANNING_SHIFT_TEMPLATE_CARD_META_CLASS =
  "mt-[0.16rem] text-xs leading-none text-black/70";

type Props = {
  presets: readonly AreaCalendarAssignmentPreset[];
  emptyLabel: string;
  locale: string;
  className?: string;
};

export function DashboardShiftTemplateSidebarList({
  presets,
  emptyLabel,
  locale,
  className,
}: Props) {
  return (
    <section
      className={cn(
        "max-h-[min(42vh,22rem)] overflow-y-auto scroll-pb-1.5 pb-1.5",
        MODAL_SCROLLBAR_CLASS,
        className
      )}
    >
      {presets.length === 0 ? (
        <p className="text-xs text-muted">{emptyLabel}</p>
      ) : (
        <ul className={PLANNING_SHIFT_TEMPLATE_LIST_CLASS}>
          {presets.map((preset) => {
            const hours = shiftHours({
              start_time: preset.start_time,
              end_time: preset.end_time,
            });
            const hasShiftCardGradient = areAreaCalendarShiftTimesComplete(
              preset.start_time,
              preset.end_time
            );

            return (
              <li
                key={preset.id}
                className="rounded-lg"
                style={{ boxShadow: AREA_CALENDAR_SHIFT_CARD_BOX_SHADOW }}
              >
                <div
                  className={PLANNING_SHIFT_TEMPLATE_CARD_INNER_CLASS}
                  style={
                    hasShiftCardGradient
                      ? {
                          backgroundImage: buildShiftCardTimeGradientCss(
                            preset.start_time,
                            preset.end_time
                          ),
                        }
                      : undefined
                  }
                >
                  <div className={PLANNING_SHIFT_TEMPLATE_CARD_TITLE_CLASS}>
                    {preset.name}
                  </div>
                  <p className={PLANNING_SHIFT_TEMPLATE_CARD_META_CLASS}>
                    {formatTimeRange(preset.start_time, preset.end_time)}{" "}
                    {formatPlanningHoursInParens(hours, locale)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
