"use client";

import { useMemo } from "react";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import { AreaCalendarEmployeeLegendCard } from "@/components/areacalendar/areacalendar-employee-legend-card";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { cn } from "@/lib/cn";
import {
  collectWeekLegendEmployeesFromAreaCalendarShifts,
  areaCalendarEmployeeWeekHours,
  AREA_CALENDAR_EMPLOYEE_LIST_WIDTH_PX,
  AREA_CALENDAR_EMPLOYEE_LIST_TOP_OFFSET_PX,
} from "@/lib/areacalendar-week-employee-legend";
import { SHIFT_CARD_LIST_GAP_PX } from "@/lib/shift-card-row-layout";
import type { AbsenceRequest, Profile } from "@schichtwerk/types";

type Props = {
  shifts: readonly AreaCalendarShiftCard[];
  profiles: readonly Profile[];
  absences?: readonly AbsenceRequest[];
  locale: string;
  employeeHoursLabel: string;
  emptyLabel: string;
  onEmployeeHover?: (employeeId: string | null) => void;
  onEmployeeContextMenu?: (
    employeeId: string,
    clientX: number,
    clientY: number
  ) => void;
  className?: string;
};

export function AreaCalendarEmployeeLegendSidebar({
  shifts,
  profiles,
  absences = [],
  locale,
  employeeHoursLabel,
  emptyLabel,
  onEmployeeHover,
  onEmployeeContextMenu,
  className,
}: Props) {
  const employees = useMemo(
    () =>
      collectWeekLegendEmployeesFromAreaCalendarShifts(
        shifts,
        profiles,
        absences
      ),
    [shifts, profiles, absences]
  );

  return (
    <aside
      className={cn(
        "relative z-10 box-border flex h-full min-h-0 shrink-0 flex-col overflow-visible",
        className
      )}
      style={{
        width: AREA_CALENDAR_EMPLOYEE_LIST_WIDTH_PX,
        marginTop: AREA_CALENDAR_EMPLOYEE_LIST_TOP_OFFSET_PX,
      }}
    >
      {employees.length === 0 ? (
        <p className="px-1 text-xs text-muted">{emptyLabel}</p>
      ) : (
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto pb-1",
            MODAL_SCROLLBAR_CLASS
          )}
        >
          <div
            className="flex flex-col"
            style={{ gap: SHIFT_CARD_LIST_GAP_PX }}
          >
            {employees.map((employee) => {
              const weekHours = areaCalendarEmployeeWeekHours(
                employee.id,
                shifts,
                absences
              );
              const targetHours = employee.weekly_hours ?? 40;

              return (
                <AreaCalendarEmployeeLegendCard
                  key={employee.id}
                  employee={employee}
                  weekHours={weekHours}
                  targetHours={targetHours}
                  locale={locale}
                  employeeHoursLabel={employeeHoursLabel}
                  onMouseEnter={() => onEmployeeHover?.(employee.id)}
                  onMouseLeave={() => onEmployeeHover?.(null)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onEmployeeContextMenu?.(employee.id, event.clientX, event.clientY);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
