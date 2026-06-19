"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import {
  estimatePlanningStaffColumnWidthPx,
  resolvePlanningStaffColumnWidthPx,
  type PlanningStaffColumnWidthInput,
} from "@/lib/dashboard-staff-column-width";

/** Hydration-sicher: zuerst Schätzung, danach Canvas-Messung. */
export function useDashboardStaffColumnWidthPx(
  input: PlanningStaffColumnWidthInput
): number {
  const estimatedWidthPx = useMemo(
    () => estimatePlanningStaffColumnWidthPx(input),
    [
      input.employees,
      input.shifts,
      input.locale,
      input.staffColumnHeaderLabel,
      input.employeeHoursLabel,
    ]
  );
  const [widthPx, setWidthPx] = useState(estimatedWidthPx);

  useLayoutEffect(() => {
    setWidthPx(resolvePlanningStaffColumnWidthPx(input));
  }, [
    estimatedWidthPx,
    input.employees,
    input.shifts,
    input.locale,
    input.staffColumnHeaderLabel,
    input.employeeHoursLabel,
  ]);

  return widthPx;
}
