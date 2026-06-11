import { shiftHoursFromWindow } from "@/lib/planning-utils";

export function formatClock(time: string): string {
  const [h, m] = time.slice(0, 5).split(":");
  return `${parseInt(h, 10)}:${m}`;
}

export function toTimeInputValue(time: string): string {
  return time.slice(0, 5);
}

export function formatDurationHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function shiftTypeDuration(startTime: string, endTime: string): string {
  return formatDurationHours(shiftHoursFromWindow(startTime, endTime));
}

function breakMinutes(start: string, end: string): number {
  const [sh, sm] = start.slice(0, 5).split(":").map(Number);
  const [eh, em] = end.slice(0, 5).split(":").map(Number);
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM < startM) endM += 24 * 60;
  return Math.max(0, endM - startM);
}

export function formatBreakTotal(
  breaks: readonly { break_start: string; break_end: string }[]
): string {
  const total = breaks.reduce(
    (sum, b) => sum + breakMinutes(b.break_start, b.break_end),
    0
  );
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDurationLabel(startTime: string, endTime: string): string {
  return `${shiftTypeDuration(startTime, endTime)} Std/Min`;
}
