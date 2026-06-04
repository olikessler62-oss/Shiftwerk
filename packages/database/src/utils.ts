import type { ShiftTypeWithBreaks } from "@schichtwerk/types";
import { DEFAULT_SHIFT_TYPES } from "@schichtwerk/types";
import type { ShiftTypeBreakInput } from "./interface";
import { Schema } from "./schema";
import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeTime(value: string): string {
  const parts = value.trim().split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}:00`;
}

export function normalizeShiftTypesWithBreaks(rows: unknown[]): ShiftTypeWithBreaks[] {
  return rows.map((row) => {
    const r = row as ShiftTypeWithBreaks & {
      shift_type_breaks?: ShiftTypeWithBreaks["shift_type_breaks"];
    };
    const breaks = r.shift_type_breaks;
    const list = Array.isArray(breaks) ? breaks : breaks ? [breaks] : [];
    return {
      ...r,
      shift_type_breaks: [...list].sort((a, b) => a.sort_order - b.sort_order),
    };
  });
}

export async function seedDefaultShiftTypes(
  client: SupabaseClient,
  organizationId: string
): Promise<void> {
  const rows = DEFAULT_SHIFT_TYPES.map((t) => ({
    organization_id: organizationId,
    ...t,
  }));

  const { error } = await client.from(Schema.tables.shiftTypes).insert(rows);
  if (error) throw new Error(error.message);
}

export async function replaceShiftTypeBreaks(
  client: SupabaseClient,
  shiftTypeId: string,
  breaks: ShiftTypeBreakInput[]
): Promise<void> {
  const { error: delError } = await client
    .from(Schema.tables.shiftTypeBreaks)
    .delete()
    .eq("shift_type_id", shiftTypeId);

  if (delError) throw new Error(delError.message);

  if (breaks.length === 0) return;

  const rows = breaks.map((b, index) => ({
    shift_type_id: shiftTypeId,
    break_start: normalizeTime(b.break_start),
    break_end: normalizeTime(b.break_end),
    sort_order: index,
  }));

  const { error: insError } = await client
    .from(Schema.tables.shiftTypeBreaks)
    .insert(rows);

  if (insError) throw new Error(insError.message);
}
