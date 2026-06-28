/** Standort nur in Planungs-UI anzeigen, wenn mehr als ein Standort existiert. */
export function shouldShowLocationInPlanningUi(locationCount: number): boolean {
  return locationCount > 1;
}

export function formatPlanningLocationAreaLabel(
  locationName: string,
  areaName: string,
  locationCount: number
): string {
  if (shouldShowLocationInPlanningUi(locationCount)) {
    return `${locationName} / ${areaName}`;
  }
  return areaName;
}
