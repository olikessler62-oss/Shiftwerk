const WEEKLY_HOURS_EXCEEDED_MARKERS = [
  "Wochenstunden überschritten",
  "Weekly hours exceeded",
] as const;

export function isShiftAssignWeeklyHoursExceededError(error: string): boolean {
  return WEEKLY_HOURS_EXCEEDED_MARKERS.some((marker) => error.includes(marker));
}

export type ShiftAssignAlertPrompt = {
  kind: "alert";
  message: string;
  blocking?: boolean;
};

export function shiftAssignAlertPromptForError(
  error: string,
  translate: (error: string) => string
): ShiftAssignAlertPrompt {
  const message = translate(error);
  return {
    kind: "alert",
    message,
    blocking:
      isShiftAssignWeeklyHoursExceededError(error) ||
      isShiftAssignWeeklyHoursExceededError(message),
  };
}

export function shiftAssignAlertPromptHasBlockingFailure(
  errors: readonly string[]
): boolean {
  return errors.some((error) => isShiftAssignWeeklyHoursExceededError(error));
}
