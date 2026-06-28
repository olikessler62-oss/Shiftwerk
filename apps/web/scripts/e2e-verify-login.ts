/**
 * Prüft E2E-Login-Credentials gegen Supabase (ohne Browser).
 *
 *   npm run e2e:verify-login --workspace=@schichtwerk/web
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createDatabase } from "@schichtwerk/database";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");

function loadEnvFile(path: string, force = false) {
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (force || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}

function loadAllEnv() {
  loadEnvFile(resolve(ROOT, "apps/web/.env.local"));
  loadEnvFile(resolve(ROOT, ".env.local"));
  loadEnvFile(resolve(ROOT, ".env.e2e.local"), true);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

async function main() {
  loadAllEnv();

  const email = process.env.E2E_MANAGER_EMAIL?.trim();
  const password = process.env.E2E_MANAGER_PASSWORD;

  if (!email || !password) {
    console.error(
      "Fehlt: E2E_MANAGER_EMAIL und E2E_MANAGER_PASSWORD in .env.e2e.local (Repo-Root)."
    );
    console.error("Vorlage: .env.e2e.example → kopieren nach .env.e2e.local");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !anonKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen in apps/web/.env.local"
    );
    process.exit(1);
  }

  console.log(`Prüfe Login für ${maskEmail(email)} …`);

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const db = createDatabase(client);

  const { error } = await db.authSignInWithPassword(email, password);
  if (error) {
    console.error(`Login fehlgeschlagen: ${error}`);
    console.error("");
    console.error("Typische Ursachen:");
    console.error("  • Passwort in .env.e2e.local falsch (Tippfehler, altes Passwort)");
    console.error("  • E-Mail ist kein Manager/Admin in Supabase Auth");
    console.error("  • Konto nur per Einladung — Passwort unter /login → Passwort vergessen setzen");
    process.exit(1);
  }

  console.log("Login OK (Supabase Auth).");

  if (serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminDb = createDatabase(admin);
    const orgId = await adminDb.getOrganizationIdByProfileEmail(email);
    if (!orgId) {
      console.warn(
        "Warnung: Auth ok, aber kein Profil mit dieser E-Mail in der DB."
      );
      process.exit(1);
    }
    const org = await adminDb.getOrganization(orgId);
    console.log(`Organisation: ${org?.name ?? orgId}`);
  }

  console.log("");
  console.log("Credentials sind gültig — npm run test:e2e sollte funktionieren.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
