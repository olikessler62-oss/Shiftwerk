import {
  type SchichtwerkDatabase,
  type ShiftUnresolvedPastJobResult,
} from "@schichtwerk/database";
import { getAdminDatabase, getDatabase } from "@/lib/db";

async function resolveUnresolvedJobDatabase(
  fallbackDb?: SchichtwerkDatabase
): Promise<SchichtwerkDatabase> {
  try {
    return getAdminDatabase();
  } catch {
    if (fallbackDb) return fallbackDb;
    return getDatabase();
  }
}

/** Setzt vergangene Schichten mit unbeantworteter Anfrage auf „unresolved“. */
export async function runShiftUnresolvedPastJobSafe(
  fallbackDb?: SchichtwerkDatabase
): Promise<ShiftUnresolvedPastJobResult | null> {
  try {
    const database = await resolveUnresolvedJobDatabase(fallbackDb);
    return await database.runShiftUnresolvedPastJob();
  } catch (error) {
    console.warn("[shift-unresolved-past]", error);
    return null;
  }
}
