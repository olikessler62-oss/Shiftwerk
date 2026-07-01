/** HH:MM — gleiche Normalisierung wie Web-Planung (`areaCalendarTimeKey`). */
export function shiftAssignmentTimeKey(raw: string): string {
  const trimmed = raw.trim();
  const parts = trimmed.split(":");
  const hRaw = parts[0] ?? "00";
  const mRaw = (parts[1] ?? "00").slice(0, 2);
  return `${hRaw.padStart(2, "0")}:${mRaw.padStart(2, "0")}`;
}

export type AreaShiftTemplateTimeRef = {
  id: string;
  location_area_id: string;
  start_time: string;
  end_time: string;
};

export function findAreaShiftTemplatesMatchingTimes(
  areaId: string,
  startTime: string,
  endTime: string,
  templates: readonly AreaShiftTemplateTimeRef[]
): AreaShiftTemplateTimeRef[] {
  const start = shiftAssignmentTimeKey(startTime);
  const end = shiftAssignmentTimeKey(endTime);

  return templates.filter(
    (template) =>
      template.location_area_id === areaId &&
      shiftAssignmentTimeKey(template.start_time) === start &&
      shiftAssignmentTimeKey(template.end_time) === end
  );
}

/** Eine eindeutige Vorlage pro exakten Von/Bis-Zeit; sonst null (kein Raten). */
export function resolveAreaShiftTemplateIdByTimes(
  areaId: string,
  startTime: string,
  endTime: string,
  templates: readonly AreaShiftTemplateTimeRef[]
): string | null {
  const matching = findAreaShiftTemplatesMatchingTimes(
    areaId,
    startTime,
    endTime,
    templates
  );
  if (matching.length !== 1) return null;
  return matching[0]!.id;
}
