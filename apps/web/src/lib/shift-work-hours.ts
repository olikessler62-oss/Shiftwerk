import { buildBreaksByTemplateIdMap,
  resolveBreaksForTemplateId,
  shiftNetWorkHours,
  type ShiftTypeBreakInput,
} from "@schichtwerk/database";
import type { AreaShiftTemplateWithBreaks } from "@schichtwerk/types";
import {
  findAreaShiftTemplateByTimes,
  resolvePresetIdFromTimes,
} from "@/lib/areacalendar-assignment-presets";

export type ShiftWorkHoursRef = {
  startTime: string;
  endTime: string;
  area_shift_template_id?: string | null;
  location_area_id?: string | null;
  breaks?: readonly ShiftTypeBreakInput[];
};

export function buildBreaksByTemplateIdFromAreaTemplates(
  templates: readonly AreaShiftTemplateWithBreaks[]
): Map<string, ShiftTypeBreakInput[]> {
  return buildBreaksByTemplateIdMap(templates);
}

function mapTemplateBreaks(
  template: AreaShiftTemplateWithBreaks
): readonly ShiftTypeBreakInput[] {
  if (!template.area_shift_template_breaks?.length) return [];
  return template.area_shift_template_breaks.map((entry) => ({
    break_start: entry.break_start,
    break_end: entry.break_end,
  }));
}

function findShiftWorkBreaksTemplateByTimes(
  shift: ShiftWorkHoursRef,
  templates: readonly AreaShiftTemplateWithBreaks[]
): AreaShiftTemplateWithBreaks | null {
  if (shift.location_area_id) {
    return findAreaShiftTemplateByTimes(
      shift.location_area_id,
      shift.startTime,
      shift.endTime,
      templates
    );
  }
  const presetId = resolvePresetIdFromTimes(
    shift.startTime,
    shift.endTime,
    templates
  );
  if (!presetId) return null;
  return templates.find((template) => template.id === presetId) ?? null;
}

export function resolveShiftWorkBreaks(
  shift: ShiftWorkHoursRef,
  breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>,
  templates?: readonly AreaShiftTemplateWithBreaks[]
): readonly ShiftTypeBreakInput[] {
  if (shift.breaks?.length) return shift.breaks;
  const fromTemplate = resolveBreaksForTemplateId(
    shift.area_shift_template_id,
    breaksByTemplateId ?? new Map()
  );
  if (fromTemplate.length > 0) return fromTemplate;
  if (shift.area_shift_template_id && templates?.length) {
    const byId = templates.find(
      (template) => template.id === shift.area_shift_template_id
    );
    const fromId = byId ? mapTemplateBreaks(byId) : [];
    if (fromId.length > 0) return fromId;
  }
  if (!templates?.length) return [];
  const matched = findShiftWorkBreaksTemplateByTimes(shift, templates);
  return matched ? mapTemplateBreaks(matched) : [];
}

export function shiftWorkHoursFromRef(
  shift: ShiftWorkHoursRef,
  options?: {
    breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>;
    templates?: readonly AreaShiftTemplateWithBreaks[];
  }
): number {
  const breaks = resolveShiftWorkBreaks(
    shift,
    options?.breaksByTemplateId,
    options?.templates
  );
  return shiftNetWorkHours(shift.startTime, shift.endTime, breaks);
}

export function shiftWorkMinutesFromRef(
  shift: ShiftWorkHoursRef,
  options?: {
    breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>;
    templates?: readonly AreaShiftTemplateWithBreaks[];
  }
): number {
  return Math.round(shiftWorkHoursFromRef(shift, options) * 60);
}
