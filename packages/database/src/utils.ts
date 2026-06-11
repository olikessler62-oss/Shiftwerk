import type { AreaShiftTemplateWithBreaks } from "@schichtwerk/types";
import {
  DEFAULT_LOCATION_AREAS,
  DEFAULT_ORG_ROLES,
} from "@schichtwerk/types";
import type { ShiftTypeBreakInput } from "./interface";
import { isServiceHoursTableUnavailable } from "./location-service-hours";
import { Schema } from "./schema";
import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeTime(value: string): string {
  const parts = value.trim().split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}:00`;
}

export function normalizeAreaShiftTemplatesWithBreaks(
  rows: unknown[]
): AreaShiftTemplateWithBreaks[] {
  return rows.map((row) => {
    const r = row as AreaShiftTemplateWithBreaks & {
      area_shift_template_breaks?: AreaShiftTemplateWithBreaks["area_shift_template_breaks"];
    };
    const breaks = r.area_shift_template_breaks;
    const list = Array.isArray(breaks) ? breaks : breaks ? [breaks] : [];
    return {
      ...r,
      area_shift_template_breaks: [...list].sort(
        (a, b) => a.sort_order - b.sort_order
      ),
    };
  });
}

const DEFAULT_SERVICE_WEEKDAYS = [0, 1, 2, 3, 4];
const DEFAULT_SERVICE_START = "09:00:00";
const DEFAULT_SERVICE_END = "18:00:00";

export async function seedDefaultAreaServiceHours(
  client: SupabaseClient,
  locationAreaId: string,
  weekdays: number[] = DEFAULT_SERVICE_WEEKDAYS
): Promise<void> {
  if (!weekdays.length) return;
  const rows = weekdays.map((weekday) => ({
    location_area_id: locationAreaId,
    weekday,
    start_time: DEFAULT_SERVICE_START,
    end_time: DEFAULT_SERVICE_END,
  }));
  const { error } = await client
    .from(Schema.tables.locationAreaServiceHours)
    .insert(rows);
  if (error) {
    if (isServiceHoursTableUnavailable(error.message)) return;
    throw new Error(error.message);
  }
}

export async function seedDefaultLocationAreas(
  client: SupabaseClient,
  locationId: string
): Promise<void> {
  const rows = DEFAULT_LOCATION_AREAS.map((name, sort_order) => ({
    location_id: locationId,
    name,
    sort_order,
  }));
  const { error } = await client.from(Schema.tables.locationAreas).insert(rows);
  if (error) throw new Error(error.message);

  const { data: areas, error: listError } = await client
    .from(Schema.tables.locationAreas)
    .select("id")
    .eq("location_id", locationId)
    .is("archived_at", null);
  if (listError) throw new Error(listError.message);

  for (const area of areas ?? []) {
    await seedDefaultAreaServiceHours(client, area.id as string);
  }
}

export async function seedDefaultRoles(
  client: SupabaseClient,
  organizationId: string
): Promise<void> {
  const { count, error: countError } = await client
    .from(Schema.tables.roles)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("archived_at", null);

  if (countError) throw new Error(countError.message);
  if (count && count > 0) return;

  const rows = DEFAULT_ORG_ROLES.map((role) => ({
    organization_id: organizationId,
    key: role.key,
    name: role.name,
    permission_level: role.permission_level,
    is_system: role.is_system,
    sort_order: role.sort_order,
  }));

  const { error } = await client.from(Schema.tables.roles).insert(rows);
  if (error) throw new Error(error.message);
}

export async function replaceAreaShiftTemplateBreaks(
  client: SupabaseClient,
  templateId: string,
  breaks: ShiftTypeBreakInput[]
): Promise<void> {
  const { error: delError } = await client
    .from(Schema.tables.areaShiftTemplateBreaks)
    .delete()
    .eq("area_shift_template_id", templateId);

  if (delError) throw new Error(delError.message);

  if (breaks.length === 0) return;

  const rows = breaks.map((b, index) => ({
    area_shift_template_id: templateId,
    break_start: normalizeTime(b.break_start),
    break_end: normalizeTime(b.break_end),
    sort_order: index,
  }));

  const { error: insError } = await client
    .from(Schema.tables.areaShiftTemplateBreaks)
    .insert(rows);

  if (insError) throw new Error(insError.message);
}
