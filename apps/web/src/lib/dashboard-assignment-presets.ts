import {
  areDashboardShiftTimesComplete,
  dashboardTimeKey,
} from "@/lib/available-employees-for-shift";
import type {
  AreaShiftTemplateWithBreaks,
  ShiftTypeWithBreaks,
} from "@schichtwerk/types";

export type DashboardAssignmentPresetSource = "area_template" | "shift_type";

export type DashboardAssignmentPreset = {
  id: string;
  name: string;
  color: string;
  start_time: string;
  end_time: string;
  source: DashboardAssignmentPresetSource;
};

type TimePresetRef = {
  id: string;
  start_time: string;
  end_time: string;
};

export function dashboardAssignmentPresetsForArea(
  areaTemplates: readonly AreaShiftTemplateWithBreaks[],
  orgShiftTypes: readonly ShiftTypeWithBreaks[]
): DashboardAssignmentPreset[] {
  if (areaTemplates.length > 0) {
    return areaTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      color: template.color,
      start_time: template.start_time,
      end_time: template.end_time,
      source: "area_template",
    }));
  }

  return orgShiftTypes.map((shiftType) => ({
    id: shiftType.id,
    name: shiftType.name,
    color: shiftType.color,
    start_time: shiftType.start_time,
    end_time: shiftType.end_time,
    source: "shift_type",
  }));
}

export function usesAreaShiftTemplatesForAssign(
  areaTemplates: readonly AreaShiftTemplateWithBreaks[]
): boolean {
  return areaTemplates.length > 0;
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

export function shiftTypeIdForAssign(
  presetId: string,
  presets: readonly DashboardAssignmentPreset[]
): string | null {
  if (!presetId) return null;
  const preset = presets.find((entry) => entry.id === presetId);
  if (!preset || preset.source !== "shift_type") return null;
  return preset.id;
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
