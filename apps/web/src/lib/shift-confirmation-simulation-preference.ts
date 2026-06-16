/** Temporär: Schichtbestätigung in der UI simulieren (ohne Versand). */
export const SHIFT_CONFIRMATION_SIMULATION_STORAGE_KEY =
  "shiftwerk.dev.shiftConfirmationSimulatedEnabled";

export function readShiftConfirmationSimulationPreference(
  fallback: boolean
): boolean {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(
    SHIFT_CONFIRMATION_SIMULATION_STORAGE_KEY
  );
  if (stored === "true") return true;
  if (stored === "false") return false;
  return fallback;
}

export function writeShiftConfirmationSimulationPreference(
  enabled: boolean
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SHIFT_CONFIRMATION_SIMULATION_STORAGE_KEY,
    enabled ? "true" : "false"
  );
}
