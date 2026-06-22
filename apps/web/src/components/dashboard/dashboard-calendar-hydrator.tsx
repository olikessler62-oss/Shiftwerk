"use client";

import { useLayoutEffect } from "react";
import type { DashboardCalendarLayerData } from "@/lib/dashboard-calendar-layer-data";
import { useDashboardCalendarLayer } from "@/components/dashboard/dashboard-calendar-context";

export function DashboardCalendarHydrator({
  data,
}: {
  data: DashboardCalendarLayerData;
}) {
  const layer = useDashboardCalendarLayer();

  useLayoutEffect(() => {
    if (!layer) return;
    layer.setLayerData(data);
  }, [data, layer]);

  return null;
}
