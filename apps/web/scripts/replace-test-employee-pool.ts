/**
 * Ersetzt fiktive Test-Mitarbeiter durch einen festen Namens-Pool.
 * Geschützt (unverändert): Oliver Kessler (Admin), Klaus Mustermann (Basic).
 *
 * Usage (from apps/web):
 *   npm run replace:employee-pool
 *   npm run replace:employee-pool -- --org-owner oli.kessler62@gmail.com
 *   npm run replace:employee-pool -- --dry-run
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "@schichtwerk/database";
import type { Profile } from "@schichtwerk/types";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../.env.local");

const DEFAULT_PASSWORD = "TestMitarbeiter123!";

const PROTECTED_NAMES = new Set(
  ["Oliver Kessler", "Klaus Mustermann"].map((name) => normalizeName(name))
);

const NEW_EMPLOYEE_NAMES = [
  "Manfred Testmann",
  "Alexandra Engeltest",
  "Marion Heimpruef",
  "Alina Testerbach",
  "Josua Sonnentest",
  "Hans Dampf",
  "Ulli Naechstczek",
  "Sofia Prueftest",
  "Monica Okeecheck",
  "Alfons Muster",
  "Sabrina Sommerheiss",
  "Karla Himmelreich",
  "Patricia Lobmich",
  "Frank Besser",
  "Rudi Ratlos",
  "Silke Binauchda",
  "Ronny Brauchtgeld",
  "Anton Test",
] as const;

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isProtected(profile: Profile): boolean {
  return PROTECTED_NAMES.has(normalizeName(profile.full_name));
}

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
  let orgOwner: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org-owner" && args[i + 1]) {
      orgOwner = args[++i].toLowerCase();
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { orgOwner, dryRun };
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
      "Keine Organisation gefunden. Bitte --org-owner angeben."
    );
  }

  console.log(`Organisation: ${org.name} (${org.id})`);
  return org.id;
}

function nextTestEmployeeEmail(existingEmails: Set<string>): string | null {
  for (let i = 1; i <= 99; i++) {
    const email = `test.mitarbeiter.${String(i).padStart(2, "0")}@schichtwerk.test`;
    if (!existingEmails.has(email)) return email;
  }
  return null;
}

async function updateAuthFullName(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  fullName: string,
  dryRun: boolean
) {
  if (dryRun) return;
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`Auth-Metadaten für ${userId}: ${error.message}`);
}

async function renameProfile(
  db: ReturnType<typeof createDatabase>,
  adminClient: ReturnType<typeof createClient>,
  profile: Profile,
  organizationId: string,
  fullName: string,
  dryRun: boolean
) {
  console.log(`Umbenennen: ${profile.full_name} → ${fullName} (${profile.email})`);
  if (dryRun) return;

  await db.updateOrganizationProfile(profile.id, organizationId, {
    full_name: fullName,
    is_active: profile.is_active,
    schedulable: profile.schedulable,
    email: profile.email,
    mobile_phone: profile.mobile_phone,
    color: profile.color,
    email_fallback_mode: profile.email_fallback_mode,
  });
  await updateAuthFullName(adminClient, profile.id, fullName, dryRun);
}

async function deactivateProfile(
  db: ReturnType<typeof createDatabase>,
  profile: Profile,
  organizationId: string,
  dryRun: boolean
) {
  console.log(`Deaktivieren: ${profile.full_name} (${profile.email})`);
  if (dryRun) return;

  await db.updateOrganizationProfile(profile.id, organizationId, {
    full_name: profile.full_name,
    is_active: false,
    schedulable: false,
    email: profile.email,
    mobile_phone: profile.mobile_phone,
    color: profile.color,
    email_fallback_mode: profile.email_fallback_mode,
  });
}

async function createTestEmployee(
  db: ReturnType<typeof createDatabase>,
  adminClient: ReturnType<typeof createClient>,
  organizationId: string,
  fullName: string,
  email: string,
  dryRun: boolean
) {
  console.log(`Neu anlegen: ${fullName} (${email})`);
  if (dryRun) return;

  const { data: createdUser, error: userError } = await db.authAdminCreateUser(
    email,
    { full_name: fullName, password: DEFAULT_PASSWORD }
  );

  if (userError || !createdUser?.user) {
    throw new Error(userError ?? `Auth-Anlage fehlgeschlagen für ${email}`);
  }

  try {
    await db.insertProfile({
      id: createdUser.user.id,
      organization_id: organizationId,
      role: "basic",
      full_name: fullName,
      email,
      is_active: true,
      schedulable: true,
    });
  } catch (error) {
    await db.authDeleteUser(createdUser.user.id);
    throw error;
  }
}

async function main() {
  loadEnvFile(ENV_PATH);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SECRET_KEY in .env.local fehlen"
    );
  }

  const { orgOwner, dryRun } = parseArgs();
  const adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const db = createDatabase(adminClient);

  const organizationId = await resolveOrganizationId(db, orgOwner);
  const profiles = await db.listOrganizationProfiles(organizationId);
  const orgEmails = new Set(
    profiles.map((profile) => profile.email.trim().toLowerCase())
  );

  const protectedProfiles = profiles.filter(isProtected);
  const replaceable = profiles
    .filter((profile) => profile.role === "basic" && !isProtected(profile))
    .sort((a, b) => {
      const orderDiff = a.sort_order - b.sort_order;
      if (orderDiff !== 0) return orderDiff;
      return a.full_name.localeCompare(b.full_name, "de");
    });

  console.log("");
  console.log(`Geschützt (${protectedProfiles.length}):`);
  for (const profile of protectedProfiles) {
    console.log(`  • ${profile.full_name} (${profile.role}, ${profile.email})`);
  }
  console.log("");
  console.log(
    `Ersetzbar: ${replaceable.length} Basic-Profile → Ziel: ${NEW_EMPLOYEE_NAMES.length} Namen`
  );
  if (dryRun) console.log("\n*** DRY RUN — keine Änderungen ***\n");

  let renamed = 0;
  let created = 0;
  let deactivated = 0;

  for (let i = 0; i < NEW_EMPLOYEE_NAMES.length; i++) {
    const targetName = NEW_EMPLOYEE_NAMES[i];
    const existing = replaceable[i];

    if (existing) {
      if (normalizeName(existing.full_name) !== normalizeName(targetName)) {
        await renameProfile(
          db,
          adminClient,
          existing,
          organizationId,
          targetName,
          dryRun
        );
        renamed++;
      } else {
        console.log(`Unverändert: ${targetName} (${existing.email})`);
      }
      continue;
    }

    const email = nextTestEmployeeEmail(orgEmails);
    if (!email) {
      throw new Error("Keine freie test.mitarbeiter.* E-Mail mehr verfügbar.");
    }
    orgEmails.add(email);
    await createTestEmployee(
      db,
      adminClient,
      organizationId,
      targetName,
      email,
      dryRun
    );
    created++;
  }

  for (let i = NEW_EMPLOYEE_NAMES.length; i < replaceable.length; i++) {
    const extra = replaceable[i];
    if (!extra.is_active) continue;
    await deactivateProfile(db, extra, organizationId, dryRun);
    deactivated++;
  }

  console.log("");
  console.log(
    `Fertig: ${renamed} umbenannt, ${created} neu, ${deactivated} deaktiviert.`
  );
  if (created > 0) {
    console.log(`Passwort für neu angelegte Accounts: ${DEFAULT_PASSWORD}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
