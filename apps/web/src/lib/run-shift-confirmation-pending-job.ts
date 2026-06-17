import {

  type SchichtwerkDatabase,

  type ShiftConfirmationPendingJobResult,

} from "@schichtwerk/database";

import { getAdminDatabase, getDatabase } from "@/lib/db";



async function resolvePendingJobDatabase(

  fallbackDb?: SchichtwerkDatabase

): Promise<SchichtwerkDatabase> {

  try {

    return getAdminDatabase();

  } catch {

    if (fallbackDb) return fallbackDb;

    return getDatabase();

  }

}



/** Führt den Pending-Übergang (requested → pending) aus. Bevorzugt Service Role. */

export async function runShiftConfirmationPendingJobSafe(

  fallbackDb?: SchichtwerkDatabase

): Promise<ShiftConfirmationPendingJobResult | null> {

  try {

    const database = await resolvePendingJobDatabase(fallbackDb);

    return await database.runShiftConfirmationPendingJob();

  } catch (error) {

    console.warn("[shift-confirmation-pending]", error);

    return null;

  }

}


