/** Stunden nach requested_at, danach Übergang requested → pending (24/7). */
export const PENDING_ELAPSED_HOURS_REQUIRED = 3;

export const PENDING_ELAPSED_MINUTES_REQUIRED =
  PENDING_ELAPSED_HOURS_REQUIRED * 60;

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

/** True wenn seit requested_at mindestens 3 h vergangen sind (unabhängig von Tageszeit). */
export function isShiftConfirmationPendingDue(
  requestedAt: string,
  now: string | Date
): boolean {
  return (
    elapsedMinutesBetween(requestedAt, now) >= PENDING_ELAPSED_MINUTES_REQUIRED
  );
}
