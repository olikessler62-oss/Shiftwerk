import {
  areAreaCalendarShiftTimesComplete,
  areaCalendarTimeKey,
} from "@/lib/available-employees-for-shift";
import { timeToMinutes } from "@schichtwerk/database";
import type { AreaShiftTemplateWithBreaks } from "@schichtwerk/types";

export type AreaCalendarAssignmentPreset = {
  id: string;
  name: string;
  color: string;
  start_time: string;
  end_time: string;
};

type TimePresetRef = {
  id: string;
  start_time: string;
  end_time: string;
};

export function areaCalendarAssignmentPresetsForArea(
  areaTemplates: readonly AreaShiftTemplateWithBreaks[]
): AreaCalendarAssignmentPreset[] {
  return areaTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    color: template.color,
    start_time: template.start_time,
    end_time: template.end_time,
  }));
}

export function usesAreaShiftTemplatesForAssign(
  areaTemplates: readonly AreaShiftTemplateWithBreaks[]
): boolean {
  return areaTemplates.length > 0;
}

export function areaShiftTemplateIdForAssign(presetId: string): string | null {
  return presetId || null;
}

export function resolvePresetIdFromTimes(
  startTime: string,
  endTime: string,
  presets: readonly TimePresetRef[]
): string | null {
  if (!areAreaCalendarShiftTimesComplete(startTime, endTime)) return null;

  const start = areaCalendarTimeKey(startTime);
  const end = areaCalendarTimeKey(endTime);

  return (
    presets.find(
      (preset) =>
        areaCalendarTimeKey(preset.start_time) === start &&
        areaCalendarTimeKey(preset.end_time) === end
    )?.id ?? null
  );
}

/** Nur Schichtvorlagen, deren Von/Bis exakt den Bedarfszeiten entsprechen. */
export function filterAssignmentPresetsMatchingTimes(
  startTime: string,
  endTime: string,
  presets: readonly AreaCalendarAssignmentPreset[]
): AreaCalendarAssignmentPreset[] {
  if (!areAreaCalendarShiftTimesComplete(startTime, endTime)) return [];

  const start = areaCalendarTimeKey(startTime);
  const end = areaCalendarTimeKey(endTime);

  return presets.filter(
    (preset) =>
      areaCalendarTimeKey(preset.start_time) === start &&
      areaCalendarTimeKey(preset.end_time) === end
  );
}

/** Anzeigename(n) passender Schichtvorlagen für exakte Von/Bis-Zeiten. */
export function shiftTemplateLabelForDemandTimes(
  startTime: string,
  endTime: string,
  presets: readonly AreaCalendarAssignmentPreset[]
): string | undefined {
  const matching = filterAssignmentPresetsMatchingTimes(
    startTime,
    endTime,
    presets
  );
  if (matching.length === 0) return undefined;
  return matching
    .map((preset) => preset.name)
    .sort((a, b) => a.localeCompare(b, "de"))
    .join(", ");
}

/** Name der passenden Schichtvorlage für exakte Von/Bis-Zeiten (Tooltip). */
export function resolveShiftTemplateNameForAssignment(
  startTime: string,
  endTime: string,
  areaShiftTemplateId: string | null | undefined,
  presets: readonly AreaCalendarAssignmentPreset[]
): string | null {
  const matching = filterAssignmentPresetsMatchingTimes(
    startTime,
    endTime,
    presets
  );
  if (matching.length === 0) return null;
  if (matching.length === 1) return matching[0]!.name;
  if (areaShiftTemplateId) {
    const byId = matching.find((preset) => preset.id === areaShiftTemplateId);
    if (byId) return byId.name;
  }
  return null;
}

/** Eine passende Vorlage vorauswählen; bei mehreren Treffern leer lassen. */
export function resolvePresetShiftTemplateForDemandTimes(
  startTime: string,
  endTime: string,
  presets: readonly AreaCalendarAssignmentPreset[],
  currentPresetId = ""
): string {
  const matching = filterAssignmentPresetsMatchingTimes(
    startTime,
    endTime,
    presets
  );
  if (matching.length === 1) return matching[0]!.id;
  if (
    currentPresetId &&
    matching.some((preset) => preset.id === currentPresetId)
  ) {
    return currentPresetId;
  }
  return "";
}

/** Früheste Schichtvorlage nach Startzeit (Bereich). */
export function earliestAssignmentPreset(
  presets: readonly AreaCalendarAssignmentPreset[]
): AreaCalendarAssignmentPreset | null {
  if (!presets.length) return null;
  return (
    [...presets].sort((a, b) => {
      const startDiff =
        timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
      if (startDiff !== 0) return startDiff;
      const endDiff = timeToMinutes(a.end_time) - timeToMinutes(b.end_time);
      if (endDiff !== 0) return endDiff;
      const nameCmp = a.name.localeCompare(b.name, "de");
      if (nameCmp !== 0) return nameCmp;
      return a.id.localeCompare(b.id);
    })[0] ?? null
  );
}

export function prefillBulkRowWithEarliestAssignmentPreset<
  T extends {
    shiftTypeId: string;
    startTime: string;
    endTime: string;
    requestedStartTime?: string;
    requestedEndTime?: string;
  },
>(row: T, presets: readonly AreaCalendarAssignmentPreset[]): boolean {
  const earliest = earliestAssignmentPreset(presets);
  if (!earliest) return false;

  const startTime = areaCalendarTimeKey(earliest.start_time);
  const endTime = areaCalendarTimeKey(earliest.end_time);
  if (!areAreaCalendarShiftTimesComplete(startTime, endTime)) return false;

  row.shiftTypeId = earliest.id;
  row.startTime = startTime;
  row.endTime = endTime;
  row.requestedStartTime = startTime;
  row.requestedEndTime = endTime;
  return true;
}

export function findAreaShiftTemplateByTimes(
  areaId: string,
  startTime: string,
  endTime: string,
  templates: readonly AreaShiftTemplateWithBreaks[]
): AreaShiftTemplateWithBreaks | null {
  const presetId = resolvePresetIdFromTimes(startTime, endTime, templates);
  if (!presetId) return null;
  return (
    templates.find(
      (template) =>
        template.location_area_id === areaId && template.id === presetId
    ) ?? null
  );
}

export function areaShiftTemplatesForArea(
  areaId: string,
  templates: readonly AreaShiftTemplateWithBreaks[]
): AreaShiftTemplateWithBreaks[] {
  return templates.filter((template) => template.location_area_id === areaId);
}
