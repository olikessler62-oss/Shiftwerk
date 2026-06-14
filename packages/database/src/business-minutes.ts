import { zonedWallClockToUtc } from "./shift-timestamps";

export const PENDING_BUSINESS_HOUR_START = 8;
export const PENDING_BUSINESS_HOUR_END = 20;
export const PENDING_BUSINESS_MINUTES_REQUIRED = 180;

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLocalDateISO(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Counts minutes between two instants that fall in [startHour:00, endHour:00) org local time. */
export function businessMinutesBetween(
  from: string | Date,
  to: string | Date,
  timeZone: string,
  options?: {
    startHour?: number;
    endHour?: number;
  }
): number {
  const startHour = options?.startHour ?? PENDING_BUSINESS_HOUR_START;
  const endHour = options?.endHour ?? PENDING_BUSINESS_HOUR_END;
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return 0;
  }

  let total = 0;
  let cursorDate = parseISODate(getLocalDateISO(new Date(fromMs), timeZone));
  const endLocalDate = parseISODate(getLocalDateISO(new Date(toMs), timeZone));

  while (cursorDate <= endLocalDate) {
    const dateISO = toISODate(cursorDate);
    const windowStart = zonedWallClockToUtc(
      dateISO,
      `${String(startHour).padStart(2, "0")}:00:00`,
      timeZone
    ).getTime();
    const windowEnd = zonedWallClockToUtc(
      dateISO,
      `${String(endHour).padStart(2, "0")}:00:00`,
      timeZone
    ).getTime();

    const overlapStart = Math.max(fromMs, windowStart);
    const overlapEnd = Math.min(toMs, windowEnd);
    if (overlapEnd > overlapStart) {
      total += Math.floor((overlapEnd - overlapStart) / 60_000);
    }

    cursorDate.setDate(cursorDate.getDate() + 1);
  }

  return total;
}

export function isShiftConfirmationPendingDue(
  requestedAt: string,
  now: string | Date,
  timeZone: string
): boolean {
  return (
    businessMinutesBetween(requestedAt, now, timeZone) >=
    PENDING_BUSINESS_MINUTES_REQUIRED
  );
}
