/** Merkt den zuletzt gewählten Standort für paralleles Dashboard-Laden. */
export const PLANNING_SELECTED_LOCATION_COOKIE = "planning_location_id";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function readPlanningLocationCookie(
  cookieValue: string | undefined
): string | undefined {
  const trimmed = cookieValue?.trim();
  return trimmed ? trimmed : undefined;
}

export function writePlanningLocationCookie(locationId: string): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(locationId);
  document.cookie = `${PLANNING_SELECTED_LOCATION_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
