/** Montag der Woche (lokal) */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekDates(weekStartISO: string): string[] {
  const start = parseISODate(weekStartISO);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
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
  end.setDate(start.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
  const kw = getISOWeek(start);
  return `KW ${kw} · ${fmt.format(start)} – ${fmt.format(end)}`;
}

export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
