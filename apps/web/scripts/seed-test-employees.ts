/**
 * Legt Test-Mitarbeiter per Admin-API an — ohne E-Mail-Versand.
 * Nutzt ausschließlich SchichtwerkDatabase (keine direkten Tabellenzugriffe).
 *
 * Usage (from apps/web):
 *   npm run seed:employees
 *   npm run seed:employees -- --org-owner oli.kessler62@gmail.com
 *   npm run seed:employees -- --count 15
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "@schichtwerk/database";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../.env.local");

const DEFAULT_COUNT = 15;
const DEFAULT_PASSWORD = "TestMitarbeiter123!";

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
  let count = DEFAULT_COUNT;
  let orgOwner: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count" && args[i + 1]) {
      count = Number.parseInt(args[++i], 10);
    } else if (args[i] === "--org-owner" && args[i + 1]) {
      orgOwner = args[++i].toLowerCase();
    }
  }

  if (!Number.isFinite(count) || count < 1) {
    throw new Error("--count muss eine positive Zahl sein");
  }

  return { count, orgOwner };
}

async function resolveOrganizationId(
  db: ReturnType<typeof createDatabase>,
  orgOwner?: string
) {
  if (orgOwner) {
    const organizationId = await db.getOrganizationIdByProfileEmail(orgOwner);
    if (!organizationId) {
      throw new Error(`Kein Profil für Inhaber-E-Mail gefunden: ${orgOwner}`);
    }
    return organizationId;
  }

  const org = await db.getFirstOrganization();
  if (!org) {
    throw new Error(
      "Keine Organisation gefunden. Bitte zuerst einen Betrieb registrieren oder --org-owner angeben."
    );
  }

  console.log(`Organisation: ${org.name} (${org.id})`);
  return org.id;
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

  const { count, orgOwner } = parseArgs();
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const db = createDatabase(admin);

  const organizationId = await resolveOrganizationId(db, orgOwner);
  const profiles = await db.listOrganizationProfiles(organizationId);
  const existingEmails = new Set(
    profiles
      .map((profile) => profile.email)
      .filter((email) => email.startsWith("test.mitarbeiter."))
  );

  let created = 0;
  let skipped = 0;

  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(2, "0");
    const fullName = `Test Mitarbeiter ${num}`;
    const email = `test.mitarbeiter.${num}@schichtwerk.test`;

    if (existingEmails.has(email)) {
      console.log(`Übersprungen (existiert): ${email}`);
      skipped++;
      continue;
    }

    const { data: createdUser, error: userError } = await db.authAdminCreateUser(
      email,
      { full_name: fullName, password: DEFAULT_PASSWORD }
    );

    if (userError || !createdUser?.user) {
      console.error(`Fehler bei ${email}:`, userError ?? "Unbekannt");
      continue;
    }

    try {
      await db.insertProfile({
        id: createdUser.user.id,
        organization_id: organizationId,
        role: "basic",
        full_name: fullName,
        email,
      });
    } catch (e) {
      await db.authDeleteUser(createdUser.user.id);
      console.error(
        `Profil-Fehler bei ${email}:`,
        e instanceof Error ? e.message : "Unbekannt"
      );
      continue;
    }

    console.log(`Angelegt: ${fullName} (${email})`);
    created++;
  }

  console.log("");
  console.log(`Fertig: ${created} neu, ${skipped} übersprungen.`);
  console.log(`Passwort für alle Test-Accounts: ${DEFAULT_PASSWORD}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
