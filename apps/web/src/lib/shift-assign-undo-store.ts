export type ShiftUndoSnapshot = {
  id: string;
  employee_id: string;
  area_shift_template_id: string | null;
  location_id: string | null;
  location_area_id: string | null;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  created_by: string | null;
};

export type ShiftAssignUndoBatch = {
  createdIds: string[];
  deletedIds: string[];
  replacements: ShiftUndoSnapshot[];
};

const store = new Map<string, ShiftAssignUndoBatch>();

export function setShiftAssignUndoBatch(
  userId: string,
  batch: ShiftAssignUndoBatch
): void {
  store.set(userId, batch);
}

export function takeShiftAssignUndoBatch(
  userId: string
): ShiftAssignUndoBatch | null {
  const batch = store.get(userId) ?? null;
  if (batch) store.delete(userId);
  return batch;
}
