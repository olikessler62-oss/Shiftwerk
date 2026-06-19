/** Superadmin: App-Registrierungs-Gate bei Zuweisung umgehen (Session). */
export const SHIFT_CONFIRMATION_RELAX_APP_GATE_STORAGE_KEY =
  "shiftwerk.dev.shiftConfirmationRelaxAppRegistrationGate";

export function readShiftConfirmationRelaxAppGatePreference(
  fallback = false
): boolean {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(
    SHIFT_CONFIRMATION_RELAX_APP_GATE_STORAGE_KEY
  );
  if (stored === "true") return true;
  if (stored === "false") return false;
  return fallback;
}

export function writeShiftConfirmationRelaxAppGatePreference(
  enabled: boolean
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SHIFT_CONFIRMATION_RELAX_APP_GATE_STORAGE_KEY,
    enabled ? "true" : "false"
  );
}
