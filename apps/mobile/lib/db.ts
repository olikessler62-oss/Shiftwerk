import { createDatabase, type SchichtwerkDatabase } from "@schichtwerk/database";
import { getSupabase } from "@/lib/supabase";

export type { SchichtwerkDatabase };

export function getDatabase(): SchichtwerkDatabase {
  return createDatabase(getSupabase());
}
