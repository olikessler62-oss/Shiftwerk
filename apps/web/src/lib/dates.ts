/** Kalenderdatum-Helfer — UTC, unabhängig von der Server-Zeitzone. */

/** Montag der Woche (UTC-Kalenderdatum). */
export function startOfWeek(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function weekDates(weekStartISO: string): string[] {
  const start = parseISODate(weekStartISO);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return toISODate(d);
  });
}

/** Kalendertag liegt vor heute (lokal). */
export function isPastCalendarDate(
  dateISO: string,
  todayISO = toISODate(new Date())
): boolean {
  return dateISO < todayISO;
}

/** Schicht-Zeitstempel — Zeitzone aus Organisation (`resolveOrganizationTimeZone`). */
export {
  buildShiftTimestamps,
  shiftTimeFromTimestamp,
  zonedWallClockToUtc,
  resolveOrganizationTimeZone,
  DEFAULT_ORGANIZATION_TIME_ZONE,
  type OrganizationTimeZoneInput,
} from "@schichtwerk/database";

export function formatWeekLabel(weekStartISO: string): string {
  const start = parseISODate(weekStartISO);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const kw = getISOWeek(start);
  return `KW ${kw} · ${fmt.format(start)} – ${fmt.format(end)}`;
}

export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
