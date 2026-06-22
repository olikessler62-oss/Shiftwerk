/**
 * Setzt das Login-Passwort für einen Mitarbeiter direkt (ohne E-Mail / Passwort-vergessen).
 *
 * Usage (from apps/web):
 *   npm run set:employee-password -- daxtrader@arcor.de KlausDemo123!
 *   npm run set:employee-password -- daxtrader@arcor.de KlausDemo123! --org-owner oli.kessler62@gmail.com
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "@schichtwerk/database";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../.env.local");

const MIN_PASSWORD_LENGTH = 8;

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let password: string | undefined;
  let orgOwner: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org-owner" && args[i + 1]) {
      orgOwner = args[++i].toLowerCase();
    } else if (!email) {
      email = args[i].toLowerCase();
    } else if (!password) {
      password = args[i];
    }
  }

  if (!email || !password) {
    throw new Error(
      "Bitte E-Mail und Passwort angeben: npm run set:employee-password -- <email> <passwort>"
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`);
  }

  return { email, password, orgOwner };
}

async function resolveOrganizationId(
  db: ReturnType<typeof createDatabase>,
  orgOwner?: string
) {
  const ownerEmail = orgOwner ?? "oli.kessler62@gmail.com";
  const organizationId = await db.getOrganizationIdByProfileEmail(ownerEmail);
  if (!organizationId) {
    throw new Error(`Kein Profil für Inhaber-E-Mail gefunden: ${ownerEmail}`);
  }
  return organizationId;
}

async function main() {
  loadEnvFile(ENV_PATH);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SECRET_KEY (oder SUPABASE_SERVICE_ROLE_KEY) in .env.local fehlen"
    );
  }

  const { email, password, orgOwner } = parseArgs();
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const db = createDatabase(admin);

  const organizationId = await resolveOrganizationId(db, orgOwner);
  const profile = await db.findProfileByEmail(organizationId, email);

  if (!profile) {
    throw new Error(`Kein Profil mit E-Mail ${email} in dieser Organisation gefunden.`);
  }

  const { error } = await admin.auth.admin.updateUserById(profile.id, {
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Passwort konnte nicht gesetzt werden: ${error.message}`);
  }

  console.log(`Passwort gesetzt für ${email} (Profil-ID ${profile.id}).`);
  console.log("Jetzt in der Mobile-App mit dieser E-Mail und dem Passwort anmelden.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
