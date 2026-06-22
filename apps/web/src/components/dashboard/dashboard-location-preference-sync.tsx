"use client";

import { useEffect } from "react";
import { writePlanningLocationCookie } from "@/lib/planning-location-preference";

export function DashboardLocationPreferenceSync({
  locationId,
}: {
  locationId: string | null;
}) {
  useEffect(() => {
    if (locationId) writePlanningLocationCookie(locationId);
  }, [locationId]);

  return null;
}
