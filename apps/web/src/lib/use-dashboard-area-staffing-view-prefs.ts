"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadDashboardAreaStaffingViewPrefs,
  saveDashboardAreaStaffingViewPrefs,
  type DashboardAreaStaffingViewPrefs,
} from "@/lib/dashboard-area-staffing-view-prefs";

export function useDashboardAreaStaffingViewPrefs(areaId: string) {
  const [prefs, setPrefs] = useState<DashboardAreaStaffingViewPrefs>(() =>
    loadDashboardAreaStaffingViewPrefs(areaId)
  );

  useEffect(() => {
    setPrefs(loadDashboardAreaStaffingViewPrefs(areaId));
  }, [areaId]);

  const updatePrefs = useCallback(
    (patch: Partial<DashboardAreaStaffingViewPrefs>) => {
      setPrefs((previous) => {
        const next = { ...previous, ...patch };
        saveDashboardAreaStaffingViewPrefs(areaId, next);
        return next;
      });
    },
    [areaId]
  );

  return [prefs, updatePrefs] as const;
}
