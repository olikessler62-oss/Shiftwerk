import { cache } from "react";
import { createDatabase, type SchichtwerkDatabase } from "@schichtwerk/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type { SchichtwerkDatabase, ShiftTypeBreakInput } from "@schichtwerk/database";

/** Ein Client pro Request — alle Server Components teilen dieselbe Instanz. */
export const getDatabase = cache(async (): Promise<SchichtwerkDatabase> => {
  return createDatabase(await createClient());
});

export function getAdminDatabase(): SchichtwerkDatabase {
  return createDatabase(createAdminClient());
}
