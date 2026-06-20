const LEGAL_WEEKLY_HOURS_MARKERS = [
  "Gesetzliche Höchstarbeitszeit überschritten",
  "Legal maximum working time exceeded",
] as const;

export function isLegalWeeklyHoursLimitError(error: string): boolean {
  return LEGAL_WEEKLY_HOURS_MARKERS.some((marker) => error.includes(marker));
}

const AVAILABILITY_EXCEEDS_TARGET_PREFIX = "Verfügbarkeiten erlauben ";
const AVAILABILITY_EXCEEDS_TARGET_SUFFIX = " — über dem Soll von ";

export function isAvailabilityExceedsTargetError(error: string): boolean {
  return (
    error.includes(AVAILABILITY_EXCEEDS_TARGET_PREFIX) &&
    error.includes(AVAILABILITY_EXCEEDS_TARGET_SUFFIX)
  );
}

export function parseAvailabilityExceedsTargetError(
  error: string
): { hours: string; targetHours: string } | null {
  const match = error.match(
    /Verfügbarkeiten erlauben ([0-9]+(?:[.,][0-9]+)?) Std\.\/Woche — über dem Soll von ([0-9]+(?:[.,][0-9]+)?) Std\./
  );
  if (!match) return null;
  return { hours: match[1], targetHours: match[2] };
}
