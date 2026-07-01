import { createClient } from "@supabase/supabase-js";

/** Nur in Server Actions — Service Role, umgeht RLS */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const legacySecretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const key = serviceRoleKey ?? legacySecretKey;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY fehlt in apps/web/.env.local (SUPABASE_SECRET_KEY ist veraltet)"
    );
  }

  if (!serviceRoleKey && legacySecretKey) {
    console.warn(
      "[supabase/admin] SUPABASE_SECRET_KEY ist veraltet — bitte SUPABASE_SERVICE_ROLE_KEY verwenden."
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
