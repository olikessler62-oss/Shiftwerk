import { parseISODate } from "@/lib/dates";

/** True, wenn der letzte Tag der Woche vor heute liegt (nur Ansicht). */
export function isPastWeek(weekEndISO: string): boolean {
  const end = parseISODate(weekEndISO);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
}

export function isPastShiftDate(shiftDateISO: string): boolean {
  const d = parseISODate(shiftDateISO);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}
