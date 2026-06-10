import { parseServiceHourTimeToMinutes } from "@schichtwerk/database";

/** Vorläufiges Maximum bis Länder-Tabelle mit gesetzlichen Arbeitszeiten existiert. */
export const MAX_STAFFING_WINDOW_HOURS = 9;

export function maxStaffingWindowMinutes(): number {
  return MAX_STAFFING_WINDOW_HOURS * 60;
}

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Begrenzt Von/Bis auf die erlaubte maximale Dauer (Ende wird gekürzt). */
export function capStaffingWindowDuration(
  start_time: string,
  end_time: string,
  maxMinutes: number = maxStaffingWindowMinutes()
): { start_time: string; end_time: string } {
  const start = parseServiceHourTimeToMinutes(timeFieldValue(start_time));
  const end = parseServiceHourTimeToMinutes(timeFieldValue(end_time));
  const normalizedStart = timeFieldValue(start_time);

  if (start == null || end == null || end <= start) {
    return { start_time: normalizedStart, end_time: timeFieldValue(end_time) };
  }

  if (end - start <= maxMinutes) {
    return { start_time: normalizedStart, end_time: timeFieldValue(end_time) };
  }

  return {
    start_time: normalizedStart,
    end_time: minutesToTime(start + maxMinutes),
  };
}
