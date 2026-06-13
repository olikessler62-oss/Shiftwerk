import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Supabase-Client für unstable_cache — ohne cookies(), nur JWT. */
export function createClientWithAccessToken(accessToken: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
