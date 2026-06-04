/**
 * @deprecated Direkt @schichtwerk/database nutzen (createDatabase / getDatabase).
 * Dieses Paket bleibt als dünne Kompatibilitätsschicht für bestehende Imports.
 */
import { createDatabase } from "@schichtwerk/database";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Shift } from "@schichtwerk/types";

export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: { accessToken?: string }
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: options?.accessToken
      ? { headers: { Authorization: `Bearer ${options.accessToken}` } }
      : undefined,
  });
}

export async function fetchProfile(
  client: SupabaseClient
): Promise<Profile | null> {
  return createDatabase(client).getCurrentUserProfile();
}

export async function fetchMyShifts(
  client: SupabaseClient,
  fromDate: string,
  toDate: string
): Promise<Shift[]> {
  return createDatabase(client).listMyShifts(fromDate, toDate);
}
