import type { ShiftTypeBreakInput } from "./interface";

export function mapTemplateBreaksToInputs(
  breaks:
    | readonly { break_start: string; break_end: string }[]
    | null
    | undefined
): ShiftTypeBreakInput[] {
  if (!breaks?.length) return [];
  return breaks.map((entry) => ({
    break_start: entry.break_start,
    break_end: entry.break_end,
  }));
}

export function buildBreaksByTemplateIdMap(
  templates: readonly {
    id: string;
    area_shift_template_breaks?:
      | readonly { break_start: string; break_end: string }[]
      | null;
  }[]
): Map<string, ShiftTypeBreakInput[]> {
  const map = new Map<string, ShiftTypeBreakInput[]>();
  for (const template of templates) {
    map.set(template.id, mapTemplateBreaksToInputs(template.area_shift_template_breaks));
  }
  return map;
}

export function resolveBreaksForTemplateId(
  templateId: string | null | undefined,
  breaksByTemplateId: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>
): readonly ShiftTypeBreakInput[] {
  if (!templateId) return [];
  return breaksByTemplateId.get(templateId) ?? [];
}

export function mergeBreaksByTemplateIdMaps(
  ...maps: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>[]
): Map<string, ShiftTypeBreakInput[]> {
  const merged = new Map<string, ShiftTypeBreakInput[]>();
  for (const map of maps) {
    for (const [templateId, breaks] of map) {
      merged.set(templateId, [...breaks]);
    }
  }
  return merged;
}

export function toWeeklyHoursExistingShift(input: {
  id: string;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  area_shift_template_id?: string | null;
  startTime: string;
  endTime: string;
  breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>;
}): import("./employee-weekly-hours-validation").WeeklyHoursExistingShift {
  const breaks = resolveBreaksForTemplateId(
    input.area_shift_template_id,
    input.breaksByTemplateId ?? new Map()
  );
  return {
    id: input.id,
    shift_date: input.shift_date,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    startTime: input.startTime,
    endTime: input.endTime,
    breaks,
  };
}

export function toWeeklyShiftHourWindow(input: {
  shiftDate: string;
  startTime: string;
  endTime: string;
  area_shift_template_id?: string | null;
  breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>;
}): import("./employee-weekly-hours-validation").WeeklyShiftHourWindow {
  return {
    shiftDate: input.shiftDate,
    startTime: input.startTime,
    endTime: input.endTime,
    breaks: resolveBreaksForTemplateId(
      input.area_shift_template_id,
      input.breaksByTemplateId ?? new Map()
    ),
  };
}

export function toDayShiftTimeWindow(input: {
  startTime: string;
  endTime: string;
  area_shift_template_id?: string | null;
  breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>;
}): import("./employee-day-shift-compliance").DayShiftTimeWindow {
  return {
    startTime: input.startTime,
    endTime: input.endTime,
    breaks: resolveBreaksForTemplateId(
      input.area_shift_template_id,
      input.breaksByTemplateId ?? new Map()
    ),
  };
}
