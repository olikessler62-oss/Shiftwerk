export type CancellationReasonShiftContext = {
  shiftDate: string;
  startTime?: string;
  endTime?: string;
  shiftTemplateName?: string | null;
};

export function readCancellationReasonShiftContextFromPayload(
  payload: Record<string, unknown>,
  fallback?: CancellationReasonShiftContext
): CancellationReasonShiftContext | undefined {
  const shiftDate =
    typeof payload.shift_date === "string"
      ? payload.shift_date
      : fallback?.shiftDate;
  if (!shiftDate) return fallback;

  const startTime =
    typeof payload.start_time === "string"
      ? payload.start_time
      : fallback?.startTime;
  const endTime =
    typeof payload.end_time === "string" ? payload.end_time : fallback?.endTime;
  const shiftTemplateName =
    typeof payload.shift_template_name === "string"
      ? payload.shift_template_name
      : fallback?.shiftTemplateName;

  return {
    shiftDate,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(shiftTemplateName ? { shiftTemplateName } : {}),
  };
}
