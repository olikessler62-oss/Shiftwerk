import {
  areDashboardShiftTimesComplete,
  dashboardTimeKey,
} from "@/lib/available-employees-for-shift";
import type { AreaShiftTemplateWithBreaks } from "@schichtwerk/types";

export type DashboardAssignmentPreset = {
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

export function dashboardAssignmentPresetsForArea(
  areaTemplates: readonly AreaShiftTemplateWithBreaks[]
): DashboardAssignmentPreset[] {
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
  if (!areDashboardShiftTimesComplete(startTime, endTime)) return null;

  const start = dashboardTimeKey(startTime);
  const end = dashboardTimeKey(endTime);

  return (
    presets.find(
      (preset) =>
        dashboardTimeKey(preset.start_time) === start &&
        dashboardTimeKey(preset.end_time) === end
    )?.id ?? null
  );
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
