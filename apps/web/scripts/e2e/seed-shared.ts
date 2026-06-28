import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildShiftTimestamps,
  createDatabase,
  organizationTodayISO,
  type SchichtwerkDatabase,
} from "@schichtwerk/database";
import type { Profile, ShiftConfirmationStatus } from "@schichtwerk/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const E2E_ENV_PATH = resolve(__dirname, "../../.env.local");
/** Monorepo-Root (SHIFTWERK/), nicht apps/web/ */
export const E2E_ROOT = resolve(__dirname, "../../../..");
export const E2E_CACHE_DIR = resolve(E2E_ROOT, "e2e/.cache");

export const CLOSED_WEEKDAY = 3; // Donnerstag (Mo=0 … So=6)

export function loadEnvFile(path: string, force = false) {
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
    if (force || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadE2ESeedEnv() {
  loadEnvFile(E2E_ENV_PATH);
  loadEnvFile(resolve(E2E_ROOT, ".env.local"));
  loadEnvFile(resolve(E2E_ROOT, ".env.e2e.local"), true);
  loadEnvFile(resolve(E2E_ROOT, "apps/web/.env.e2e.local"), true);
}

export function e2eCredentialsEnvHint(): string {
  const primary = resolve(E2E_ROOT, ".env.e2e.local");
  return [
    "E2E-Zugangsdaten fehlen.",
    "",
    `Lege diese Datei an: ${primary}`,
    "(Vorlage im Repo-Root: .env.e2e.example)",
    "",
    "Inhalt:",
    "  E2E_MANAGER_EMAIL=deine-manager@email.de",
    "  E2E_MANAGER_PASSWORD=dein-passwort",
    "",
    "Windows:",
    "  copy .env.e2e.example .env.e2e.local",
    "",
    "Danach die E-Mail/Passwort eintragen — dieselben wie beim Login unter /login.",
  ].join("\n");
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function isoToPlanningWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function weekStartForDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const jsDay = date.getDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  date.setDate(date.getDate() + diff);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function dateInWeek(weekStart: string, dayOffset: number): string {
  return addDaysISO(weekStart, dayOffset);
}

export type ResolvedArea = {
  id: string;
  location_id: string;
  name: string;
};

export async function resolveManagerContext(
  db: SchichtwerkDatabase,
  admin: SupabaseClient
) {
  const managerEmail = process.env.E2E_MANAGER_EMAIL?.trim().toLowerCase();
  if (!managerEmail) {
    throw new Error(e2eCredentialsEnvHint());
  }

  const organizationId = await db.getOrganizationIdByProfileEmail(managerEmail);
  if (!organizationId) {
    throw new Error(`Kein Profil für E2E_MANAGER_EMAIL: ${managerEmail}`);
  }

  const organization = await db.getOrganization(organizationId);
  if (!organization) {
    throw new Error("Organisation nicht gefunden");
  }

  const profiles = await db.listOrganizationProfiles(organizationId);
  const manager = profiles.find(
    (profile) => profile.email?.trim().toLowerCase() === managerEmail
  );
  if (!manager) {
    throw new Error(`Manager-Profil nicht gefunden: ${managerEmail}`);
  }

  const qualIdsByProfile =
    await db.listProfileQualificationIdsByOrganization(organizationId);

  const sortedProfiles = [...profiles].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.full_name.localeCompare(b.full_name) ||
      a.id.localeCompare(b.id)
  );

  return {
    admin,
    db,
    organizationId,
    organization,
    manager,
    profiles: sortedProfiles,
    qualIdsByProfile,
    timeZone: organization.timezone ?? "Europe/Berlin",
    todayISO: organizationTodayISO(organization.timezone ?? "Europe/Berlin"),
  };
}

export async function findAreaByKey(
  db: SchichtwerkDatabase,
  organizationId: string,
  areaKey: string
): Promise<ResolvedArea> {
  const locations = await db.listLocations(organizationId);
  for (const location of locations) {
    const areas = await db.listLocationAreas(location.id);
    const match = areas.find(
      (area) => area.name.trim().toLowerCase() === areaKey.toLowerCase()
    );
    if (match) {
      return {
        id: match.id,
        location_id: location.id,
        name: match.name,
      };
    }
  }
  throw new Error(
    `Bereich „${areaKey}“ nicht gefunden — Gastronomie-Template / Schicht-Reset ausführen`
  );
}

export function profileHasQualification(
  qualIdsByProfile: Map<string, string[]>,
  profileId: string,
  qualificationId: string
): boolean {
  return (qualIdsByProfile.get(profileId) ?? []).includes(qualificationId);
}

export function findProfileWithQualification(
  profiles: readonly Profile[],
  qualIdsByProfile: Map<string, string[]>,
  qualificationId: string,
  options?: { mustNotHaveQualificationId?: string; startIndex?: number }
): Profile {
  const startIndex = options?.startIndex ?? 0;
  const match = profiles
    .slice(startIndex)
    .find(
      (profile) =>
        profileHasQualification(qualIdsByProfile, profile.id, qualificationId) &&
        (!options?.mustNotHaveQualificationId ||
          !profileHasQualification(
            qualIdsByProfile,
            profile.id,
            options.mustNotHaveQualificationId
          ))
    );
  if (!match) {
    throw new Error("Passendes Profil für Seed nicht gefunden");
  }
  return match;
}

export async function clearAreaShiftsOnDate(
  admin: SupabaseClient,
  db: SchichtwerkDatabase,
  organizationId: string,
  areaId: string,
  shiftDate: string,
  deletedBy: string
) {
  const { data, error } = await admin
    .from("shifts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("location_area_id", areaId)
    .eq("shift_date", shiftDate);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    await db.deleteShift(row.id as string, organizationId, deletedBy);
  }
}

export async function insertConfirmedShift(
  db: SchichtwerkDatabase,
  input: {
    organizationId: string;
    employeeId: string;
    locationId: string;
    areaId: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    timeZone: string;
    createdBy: string;
    confirmationStatus?: ShiftConfirmationStatus;
  }
): Promise<string> {
  const { starts_at, ends_at } = buildShiftTimestamps(
    input.shiftDate,
    input.startTime,
    input.endTime,
    input.timeZone
  );

  const confirmationStatus = input.confirmationStatus ?? "confirmed";
  const confirmationUpdatedAt = new Date().toISOString();

  const { id } = await db.insertShift({
    organization_id: input.organizationId,
    employee_id: input.employeeId,
    location_id: input.locationId,
    location_area_id: input.areaId,
    shift_date: input.shiftDate,
    starts_at,
    ends_at,
    created_by: input.createdBy,
    confirmation_status: confirmationStatus,
    confirmation_status_updated_at: confirmationUpdatedAt,
  });

  return id;
}
