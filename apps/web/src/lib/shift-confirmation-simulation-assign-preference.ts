/** Superadmin: neue Zuweisungen als proposed speichern (Simulation). */
export const SHIFT_CONFIRMATION_SIMULATION_ASSIGN_STORAGE_KEY =
  "shiftwerk.dev.shiftConfirmationSimulatedProposedOnAssign";

export function readShiftConfirmationSimulationAssignPreference(
  fallback = false
): boolean {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(
    SHIFT_CONFIRMATION_SIMULATION_ASSIGN_STORAGE_KEY
  );
  if (stored === "true") return true;
  if (stored === "false") return false;
  return fallback;
}

export function writeShiftConfirmationSimulationAssignPreference(
  enabled: boolean
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SHIFT_CONFIRMATION_SIMULATION_ASSIGN_STORAGE_KEY,
    enabled ? "true" : "false"
  );
}
