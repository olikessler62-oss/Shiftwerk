"use client";

import { useCallback, useRef, useState } from "react";
import { fetchPlanningEmployeeTooltip } from "@/app/actions/areacalendar-shift-assign";
import type { DashboardStaffingCandidateEmployeeTooltipPayload } from "@/lib/dashboard-staffing-candidate-employee-tooltip";

type TooltipCacheEntry =
  | { status: "loading" }
  | { status: "loaded"; data: DashboardStaffingCandidateEmployeeTooltipPayload }
  | { status: "error" };

export function usePlanningEmployeeTooltip(
  employeeId: string,
  contextDateISO: string,
  todayISO: string
) {
  const [cacheEntry, setCacheEntry] = useState<TooltipCacheEntry | null>(null);
  const fetchStartedRef = useRef(false);

  const activate = useCallback(() => {
    if (fetchStartedRef.current) return;
    fetchStartedRef.current = true;

    setCacheEntry({ status: "loading" });

    void fetchPlanningEmployeeTooltip(
      employeeId,
      contextDateISO,
      todayISO
    ).then((result) => {
      setCacheEntry(
        result.ok
          ? { status: "loaded", data: result.data }
          : { status: "error" }
      );
    });
  }, [employeeId, contextDateISO, todayISO]);

  return {
    activate,
    payload:
      cacheEntry?.status === "loaded" ? cacheEntry.data : null,
    loading: !cacheEntry || cacheEntry.status === "loading",
    error: cacheEntry?.status === "error",
  };
}
