"use client";

import type { ReactNode } from "react";
import type { Qualification } from "@schichtwerk/types";
import { PlanningEmployeeTooltipContent } from "@/components/dashboard/dashboard-staffing-candidate-employee-tooltip-content";
import type { EmployeeWeeklyHoursDisplay } from "@/lib/employee-weekly-hours-display";
import { usePlanningEmployeeTooltip } from "@/lib/use-planning-employee-tooltip";

type Props = {
  employeeId: string;
  employeeName: string;
  /** Kontexttag für Abwesenheit (Planungstag im Modal, sonst heute). */
  contextDateISO: string;
  /** Bezug für Einsatz-Offsets — immer heute. */
  todayISO: string;
  qualifications: readonly Qualification[];
  weeklyHoursDisplay?: EmployeeWeeklyHoursDisplay | null;
};

export function usePlanningEmployeeTooltipNode({
  employeeId,
  employeeName,
  contextDateISO,
  todayISO,
  qualifications,
  weeklyHoursDisplay,
}: Props): { activate: () => void; node: ReactNode } {
  const { activate, payload, loading, error } = usePlanningEmployeeTooltip(
    employeeId,
    contextDateISO,
    todayISO
  );

  return {
    activate,
    node: (
      <PlanningEmployeeTooltipContent
        employeeName={employeeName}
        todayISO={todayISO}
        payload={payload}
        loading={loading}
        error={error}
        qualifications={qualifications}
        weeklyHoursDisplay={weeklyHoursDisplay}
      />
    ),
  };
}
