import {
  DEFAULT_ORGANIZATION_TIME_ZONE,
  resolveOrganizationTimeZone,
  type OrganizationTimeZoneInput,
} from "./organization-timezone";

export {
  DEFAULT_ORGANIZATION_TIME_ZONE,
  resolveOrganizationTimeZone,
  type OrganizationTimeZoneInput,
};

/** @deprecated Verwende `DEFAULT_ORGANIZATION_TIME_ZONE` oder `resolveOrganizationTimeZone`. */
export const SHIFT_TIME_ZONE = DEFAULT_ORGANIZATION_TIME_ZONE;

function normalizeTime(time: string): string {
  return time.length >= 8 ? time.slice(0, 8) : `${time.slice(0, 5)}:00`;
}

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

function getTimeZoneOffsetMs(timeZone: string, utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(utcDate);
  const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - utcDate.getTime();
}

/** Wandelt Kalenderdatum + Wanduhrzeit in UTC-Instant (Organisations-Zeitzone). */
export function zonedWallClockToUtc(
  dateISO: string,
  time: string,
  timeZone: string = DEFAULT_ORGANIZATION_TIME_ZONE
): Date {
  const normalized = normalizeTime(time);
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm, ss = "0"] = normalized.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, Number(ss));
  const offsetMs = getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
  return new Date(utcGuess - offsetMs);
}

/** Ortszeit aus gespeichertem timestamptz — nicht UTC-Substring. */
export function shiftTimeFromTimestamp(
  timestamp: string,
  timeZone: string = DEFAULT_ORGANIZATION_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

/** Zeitstempel für Schicht in der Organisations-Zeitzone (CET/CEST o. ä.). */
export function buildShiftTimestamps(
  shiftDate: string,
  startTime: string,
  endTime: string,
  timeZone: string = DEFAULT_ORGANIZATION_TIME_ZONE
): { starts_at: string; ends_at: string } {
  const startNorm = normalizeTime(startTime);
  const endNorm = normalizeTime(endTime);
  const startH = parseInt(startNorm.slice(0, 2), 10);
  const endH = parseInt(endNorm.slice(0, 2), 10);

  let endDate = shiftDate;
  if (endH < startH || (endH === startH && endNorm < startNorm)) {
    const d = parseISODate(shiftDate);
    d.setDate(d.getDate() + 1);
    endDate = toISODate(d);
  }

  return {
    starts_at: zonedWallClockToUtc(shiftDate, startNorm, timeZone).toISOString(),
    ends_at: zonedWallClockToUtc(endDate, endNorm, timeZone).toISOString(),
  };
}
