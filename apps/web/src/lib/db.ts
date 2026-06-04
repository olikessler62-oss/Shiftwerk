import { createDatabase, type SchichtwerkDatabase } from "@schichtwerk/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type { SchichtwerkDatabase, ShiftTypeBreakInput } from "@schichtwerk/database";

export async function getDatabase(): Promise<SchichtwerkDatabase> {
  return createDatabase(await createClient());
}

export function getAdminDatabase(): SchichtwerkDatabase {
  return createDatabase(createAdminClient());
}
