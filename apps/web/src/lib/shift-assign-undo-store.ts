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

/** Undo-Batches verfallen nach 30 Minuten (kein unbegrenztes Leaken). */
const UNDO_TTL_MS = 30 * 60 * 1000;

type StoredUndoBatch = {
  batch: ShiftAssignUndoBatch;
  expiresAt: number;
};

/**
 * Prozess-lokaler Store — bei mehreren Server-Instanzen ist Undo nicht garantiert.
 * Für Multi-Instance-Deployments später durch DB/Redis ersetzen.
 */
const store = new Map<string, StoredUndoBatch>();

function pruneExpired(userId?: string): void {
  const now = Date.now();
  if (userId) {
    const entry = store.get(userId);
    if (entry && entry.expiresAt <= now) {
      store.delete(userId);
    }
  }
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function setShiftAssignUndoBatch(
  userId: string,
  batch: ShiftAssignUndoBatch
): void {
  pruneExpired();
  store.set(userId, {
    batch,
    expiresAt: Date.now() + UNDO_TTL_MS,
  });
}

export function takeShiftAssignUndoBatch(
  userId: string
): ShiftAssignUndoBatch | null {
  pruneExpired(userId);
  const entry = store.get(userId) ?? null;
  if (!entry) return null;
  store.delete(userId);
  return entry.batch;
}
