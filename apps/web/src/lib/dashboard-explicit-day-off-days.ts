/** Client-seitig: Tage, die per Context-Menü explizit als „arbeitsfrei“ gesetzt wurden. */

const STORAGE_KEY = "schichtwerk:dashboard-explicit-day-off-days";

type StoredDayOffByLocation = Record<string, string[]>;

function readAll(): StoredDayOffByLocation {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredDayOffByLocation;
  } catch {
    return {};
  }
}

function writeAll(data: StoredDayOffByLocation): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function readExplicitDayOffDays(locationId: string): Set<string> {
  const all = readAll();
  const dates = all[locationId];
  return new Set(Array.isArray(dates) ? dates : []);
}

export function writeExplicitDayOffDays(
  locationId: string,
  dates: ReadonlySet<string>
): void {
  const all = readAll();
  if (dates.size === 0) {
    delete all[locationId];
  } else {
    all[locationId] = [...dates].sort();
  }
  writeAll(all);
}

export function addExplicitDayOffDay(locationId: string, dateISO: string): void {
  const dates = readExplicitDayOffDays(locationId);
  dates.add(dateISO);
  writeExplicitDayOffDays(locationId, dates);
}

export function removeExplicitDayOffDay(
  locationId: string,
  dateISO: string
): void {
  const dates = readExplicitDayOffDays(locationId);
  dates.delete(dateISO);
  writeExplicitDayOffDays(locationId, dates);
}
