/** Client-seitig: manuell geöffnete Kalendertage (Context-Menü), pro Standort.
 *  Sobald Schichten in der DB existieren, gilt der Tag über die Schicht-Daten als geöffnet. */

const STORAGE_KEY = "schichtwerk:dashboard-manual-assignment-days";

type StoredManualDaysByLocation = Record<string, string[]>;

function readAll(): StoredManualDaysByLocation {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredManualDaysByLocation;
  } catch {
    return {};
  }
}

function writeAll(data: StoredManualDaysByLocation): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** ISO-Daten, die am Standort manuell für Zuweisungen geöffnet wurden (noch ohne Schichten). */
export function readManualAssignmentDays(locationId: string): Set<string> {
  const all = readAll();
  const dates = all[locationId];
  return new Set(Array.isArray(dates) ? dates : []);
}

export function writeManualAssignmentDays(
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

export function addManualAssignmentDay(locationId: string, dateISO: string): void {
  const dates = readManualAssignmentDays(locationId);
  dates.add(dateISO);
  writeManualAssignmentDays(locationId, dates);
}

export function removeManualAssignmentDay(
  locationId: string,
  dateISO: string
): void {
  const dates = readManualAssignmentDays(locationId);
  dates.delete(dateISO);
  writeManualAssignmentDays(locationId, dates);
}

/** Nach Schicht-Zuweisung: DB ist maßgeblich, lokales Flag entfernen. */
export function clearManualAssignmentDaysWithShifts(
  locationId: string,
  shiftDates: readonly string[]
): void {
  if (shiftDates.length === 0) return;
  const dates = readManualAssignmentDays(locationId);
  let changed = false;
  for (const date of shiftDates) {
    if (dates.delete(date)) changed = true;
  }
  if (changed) writeManualAssignmentDays(locationId, dates);
}
