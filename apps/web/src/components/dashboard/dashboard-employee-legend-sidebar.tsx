"use client";

import { useMemo } from "react";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { cn } from "@/lib/cn";
import { SHIFT_CARD_TWO_LINE_HEIGHT_PX } from "@/lib/shift-card-row-layout";
import { SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX } from "@/lib/shift-card-time-gradient";
import {
  collectWeekLegendEmployeesFromDashboardShifts,
  dashboardEmployeeWeekHours,
  DASHBOARD_SIDEBAR_EMPLOYEE_LIST_MAX_HEIGHT_PX,
} from "@/lib/dashboard-week-employee-legend";
import { PLANNING_ROW_DIVIDER_CLASS } from "@/lib/planning-calendar-layout";
import { formatPlanningHoursRatio } from "@/lib/planning-utils";
import type { AbsenceRequest, Profile } from "@schichtwerk/types";

const EMPLOYEE_COLOR_FALLBACK = "#94a3b8";

type Props = {
  shifts: readonly DashboardShiftCard[];
  profiles: readonly Profile[];
  absences?: readonly AbsenceRequest[];
  locale: string;
  employeeHoursLabel: string;
  emptyLabel: string;
  highlightedEmployeeId?: string | null;
  onEmployeeHover?: (employeeId: string | null) => void;
  className?: string;
};

export function DashboardEmployeeLegendSidebar({
  shifts,
  profiles,
  absences = [],
  locale,
  employeeHoursLabel,
  emptyLabel,
  highlightedEmployeeId = null,
  onEmployeeHover,
  className,
}: Props) {
  const employees = useMemo(
    () =>
      collectWeekLegendEmployeesFromDashboardShifts(
        shifts,
        profiles,
        absences
      ),
    [shifts, profiles, absences]
  );

  return (
    <section className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      {employees.length === 0 ? (
        <p className="text-xs text-muted">{emptyLabel}</p>
      ) : (
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-300 bg-surface",
            MODAL_SCROLLBAR_CLASS
          )}
          style={{
            maxHeight: `min(${DASHBOARD_SIDEBAR_EMPLOYEE_LIST_MAX_HEIGHT_PX}px, 100%)`,
          }}
        >
          {employees.map((employee, index) => {
            const weekHours = dashboardEmployeeWeekHours(
              employee.id,
              shifts,
              absences
            );
            const targetHours = employee.weekly_hours ?? 40;
            const overHours = weekHours > targetHours;
            const isHighlighted = highlightedEmployeeId === employee.id;

            return (
              <div
                key={employee.id}
                className={cn(
                  "flex h-11 min-h-11 shrink-0 cursor-default items-center gap-2 py-0 pl-3 pr-2 transition-colors",
                  index < employees.length - 1 && PLANNING_ROW_DIVIDER_CLASS,
                  isHighlighted && "bg-subtle"
                )}
                onMouseEnter={() => onEmployeeHover?.(employee.id)}
                onMouseLeave={() => onEmployeeHover?.(null)}
              >
                <span
                  className="shrink-0 rounded-l"
                  style={{
                    width: SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
                    height: SHIFT_CARD_TWO_LINE_HEIGHT_PX,
                    backgroundColor:
                      employee.color?.trim() || EMPLOYEE_COLOR_FALLBACK,
                  }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium leading-tight">
                    {employee.full_name}
                  </div>
                  <div
                    className={cn(
                      "truncate text-xs leading-tight",
                      overHours ? "font-medium text-amber-600" : "text-muted"
                    )}
                  >
                    {employeeHoursLabel}{" "}
                    {formatPlanningHoursRatio(weekHours, targetHours, locale)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
