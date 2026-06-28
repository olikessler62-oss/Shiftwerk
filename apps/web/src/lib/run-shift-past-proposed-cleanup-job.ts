import {
  type SchichtwerkDatabase,
  type ShiftPastProposedCleanupJobResult,
} from "@schichtwerk/database";
import { getAdminDatabase, getDatabase } from "@/lib/db";

async function resolvePastProposedCleanupDatabase(
  fallbackDb?: SchichtwerkDatabase
): Promise<SchichtwerkDatabase> {
  try {
    return getAdminDatabase();
  } catch {
    if (fallbackDb) return fallbackDb;
    return getDatabase();
  }
}

/** Löscht vergangene Schichten im Status „Geplant“ aus der Datenbank. */
export async function runShiftPastProposedCleanupJobSafe(
  fallbackDb?: SchichtwerkDatabase
): Promise<ShiftPastProposedCleanupJobResult | null> {
  try {
    const database = await resolvePastProposedCleanupDatabase(fallbackDb);
    return await database.runShiftPastProposedCleanupJob();
  } catch (error) {
    console.warn("[shift-past-proposed-cleanup]", error);
    return null;
  }
}
