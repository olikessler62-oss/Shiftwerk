import { DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES } from "./organization-shift-confirmation-settings";

/** Stunden nach requested_at bei Voreinstellung (24/7). */
export const PENDING_ELAPSED_HOURS_REQUIRED =
  DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES / 60;

export const PENDING_ELAPSED_MINUTES_REQUIRED =
  DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES;

/** Alias für bestehende Importe. */
export const PENDING_BUSINESS_MINUTES_REQUIRED =
  PENDING_ELAPSED_MINUTES_REQUIRED;

export function elapsedMinutesBetween(
  from: string | Date,
  to: string | Date
): number {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return 0;
  }
  return Math.floor((toMs - fromMs) / 60_000);
}

/** True wenn seit requested_at die konfigurierte Frist vergangen ist. */
export function isShiftConfirmationPendingDue(
  requestedAt: string,
  now: string | Date,
  pendingAfterMinutes: number = DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES
): boolean {
  return elapsedMinutesBetween(requestedAt, now) >= pendingAfterMinutes;
}
