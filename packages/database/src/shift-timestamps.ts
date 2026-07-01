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
  return new Date(Date.UTC(y, m - 1, d));
}

function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function wallClockPartsInZone(
  utcDate: Date,
  timeZone: string
): {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
  ss: number;
} {
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
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    hh: Number(map.hour),
    mm: Number(map.minute),
    ss: Number(map.second),
  };
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
  const [hh, mm, ssRaw = "0"] = normalized.split(":").map(Number);
  const ss = Number(ssRaw);
  const wallUtc = Date.UTC(y, m - 1, d, hh, mm, ss);

  let utcMs = wallUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const offsetMs = getTimeZoneOffsetMs(timeZone, new Date(utcMs));
    const nextMs = wallUtc - offsetMs;
    if (nextMs === utcMs) break;
    utcMs = nextMs;
  }

  const matchesWallClock = (candidateMs: number): boolean => {
    const parts = wallClockPartsInZone(new Date(candidateMs), timeZone);
    return (
      parts.y === y &&
      parts.m === m &&
      parts.d === d &&
      parts.hh === hh &&
      parts.mm === mm &&
      parts.ss === ss
    );
  };

  if (matchesWallClock(utcMs)) {
    return new Date(utcMs);
  }

  // Herbst-Umstellung: mehrdeutige Ortszeit — ±1h testen.
  const hourMs = 60 * 60 * 1000;
  for (const delta of [-hourMs, hourMs]) {
    const candidate = utcMs + delta;
    if (matchesWallClock(candidate)) {
      return new Date(candidate);
    }
  }

  // Frühjahrs-Umstellung: angeforderte Zeit existiert nicht — nächste gültige Ortszeit.
  return new Date(utcMs);
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
    d.setUTCDate(d.getUTCDate() + 1);
    endDate = toISODate(d);
  }

  return {
    starts_at: zonedWallClockToUtc(shiftDate, startNorm, timeZone).toISOString(),
    ends_at: zonedWallClockToUtc(endDate, endNorm, timeZone).toISOString(),
  };
}
