/**
 * E2E-Fixtures für Dashboard-Walkthrough (Schritte 1–5).
 *
 *   npm run e2e:seed:dashboard --workspace=@schichtwerk/web
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createDatabase } from "@schichtwerk/database";
import {
  CLOSED_WEEKDAY,
  E2E_CACHE_DIR,
  clearAreaShiftsOnDate,
  dateInWeek,
  findAreaByKey,
  findProfileWithQualification,
  insertConfirmedShift,
  isoToPlanningWeekday,
  loadE2ESeedEnv,
  resolveManagerContext,
  weekStartForDate,
} from "./e2e/seed-shared";

const LUNCH = { start: "12:00", end: "15:00" };
const EVENING = { start: "18:00", end: "22:00" };
const MORNING = { start: "07:00", end: "10:00" };

type ScenarioRef = {
  shiftDate: string;
  areaName: string;
};

export type DashboardScenariosManifest = {
  weekStart: string;
  locationId: string;
  shiftConfirmationEnabled: boolean;
  barUnderstaffed: ScenarioRef;
  restaurantUnderstaffed: ScenarioRef;
  restaurantCovered: ScenarioRef;
  restaurantOverstaffed: ScenarioRef;
  kitchenQualMismatch: ScenarioRef;
  barConfirmation: ScenarioRef;
};

function assertOpenDay(shiftDate: string, label: string) {
  if (isoToPlanningWeekday(shiftDate) === CLOSED_WEEKDAY) {
    throw new Error(`${label}: ${shiftDate} fällt auf Donnerstag (geschlossen)`);
  }
}

function openDaysInWeek(weekStart: string): string[] {
  const days: string[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = dateInWeek(weekStart, offset);
    if (isoToPlanningWeekday(date) !== CLOSED_WEEKDAY) {
      days.push(date);
    }
  }
  return days;
}

/** Genug zukünftige Tage in der KW — sonst nächste Planungswoche. */
function resolveE2ESeedWeek(todayISO: string): {
  weekStart: string;
  openDays: string[];
} {
  let weekStart = weekStartForDate(todayISO);
  let openDays = openDaysInWeek(weekStart).filter((date) => date >= todayISO);

  if (openDays.length < 4) {
    weekStart = dateInWeek(weekStart, 7);
    openDays = openDaysInWeek(weekStart);
  }

  return { weekStart, openDays };
}

function pickOpenDay(openDays: string[], index: number, label: string): string {
  const date = openDays[index];
  if (!date) {
    throw new Error(
      `E2E-Seed: nicht genug offene Tage für „${label}“ (Index ${index})`
    );
  }
  return date;
}

async function main() {
  loadE2ESeedEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local fehlen"
    );
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const db = createDatabase(admin);

  const ctx = await resolveManagerContext(db, admin);
  const qualifications = await db.listQualifications(ctx.organizationId);
  const kellnerQual = qualifications.find((q) => q.name === "Kellner/in");
  const kochQual = qualifications.find((q) => q.name === "Koch/Köchin");
  const baristaQual = qualifications.find((q) => q.name === "Barista");
  const spuelQual = qualifications.find((q) => q.name === "Spülkraft");

  if (!kellnerQual || !kochQual || !baristaQual || !spuelQual) {
    throw new Error("Standard-Qualifikationen fehlen — Schicht-Reset ausführen");
  }

  const barArea = await findAreaByKey(ctx.db, ctx.organizationId, "bar");
  const restaurantArea = await findAreaByKey(ctx.db, ctx.organizationId, "restaurant");
  const kitchenArea = await findAreaByKey(ctx.db, ctx.organizationId, "küche");

  const { weekStart, openDays } = resolveE2ESeedWeek(ctx.todayISO);
  const barDate = pickOpenDay(openDays, 0, "Bar unterbesetzt");
  const restaurantUnderstaffedDate = pickOpenDay(
    openDays,
    1,
    "Restaurant unterbesetzt"
  );
  const restaurantCoveredDate = pickOpenDay(openDays, 2, "Restaurant gedeckt");
  const restaurantOverstaffedDate = pickOpenDay(
    openDays,
    3,
    "Restaurant überbesetzt"
  );
  const kitchenQualDate = restaurantCoveredDate;
  const barConfirmationDate = pickOpenDay(openDays, 4, "Bar Bestätigung");

  for (const [label, date] of [
    ["Bar", barDate],
    ["Restaurant unterbesetzt", restaurantUnderstaffedDate],
    ["Restaurant gedeckt", restaurantCoveredDate],
    ["Restaurant überbesetzt", restaurantOverstaffedDate],
    ["Küche Quali", kitchenQualDate],
    ["Bar Bestätigung", barConfirmationDate],
  ] as const) {
    assertOpenDay(date, label);
  }

  const kellner1 = findProfileWithQualification(
    ctx.profiles,
    ctx.qualIdsByProfile,
    kellnerQual.id
  );
  const kellner2 = findProfileWithQualification(
    ctx.profiles,
    ctx.qualIdsByProfile,
    kellnerQual.id,
    { startIndex: 1 }
  );
  const kellner3 = findProfileWithQualification(
    ctx.profiles,
    ctx.qualIdsByProfile,
    kellnerQual.id,
    { startIndex: 2 }
  );
  const barista = findProfileWithQualification(
    ctx.profiles,
    ctx.qualIdsByProfile,
    baristaQual.id
  );
  const barista2 = findProfileWithQualification(
    ctx.profiles,
    ctx.qualIdsByProfile,
    baristaQual.id,
    { startIndex: 1 }
  );
  const wrongKochProfile = findProfileWithQualification(
    ctx.profiles,
    ctx.qualIdsByProfile,
    kellnerQual.id,
    { mustNotHaveQualificationId: kochQual.id, startIndex: 7 }
  );
  const kochProfile = findProfileWithQualification(
    ctx.profiles,
    ctx.qualIdsByProfile,
    kochQual.id,
    { startIndex: 3 }
  );
  const spuelProfile = findProfileWithQualification(
    ctx.profiles,
    ctx.qualIdsByProfile,
    spuelQual.id,
    { startIndex: 6 }
  );

  const baseShift = {
    organizationId: ctx.organizationId,
    timeZone: ctx.timeZone,
    createdBy: ctx.manager.id,
  };

  // Bar · Abend · 1/2 (Barista, Spülkraft offen)
  await clearAreaShiftsOnDate(
    admin,
    db,
    ctx.organizationId,
    barArea.id,
    barDate,
    ctx.manager.id
  );
  await insertConfirmedShift(db, {
    ...baseShift,
    employeeId: barista.id,
    locationId: barArea.location_id,
    areaId: barArea.id,
    shiftDate: barDate,
    startTime: EVENING.start,
    endTime: EVENING.end,
  });

  // Restaurant · Mittag · 1/2 Kellner
  await clearAreaShiftsOnDate(
    admin,
    db,
    ctx.organizationId,
    restaurantArea.id,
    restaurantUnderstaffedDate,
    ctx.manager.id
  );
  await insertConfirmedShift(db, {
    ...baseShift,
    employeeId: kellner1.id,
    locationId: restaurantArea.location_id,
    areaId: restaurantArea.id,
    shiftDate: restaurantUnderstaffedDate,
    startTime: LUNCH.start,
    endTime: LUNCH.end,
  });

  // Restaurant · alle Fenster · gedeckt (2 Kellner je Fenster)
  await clearAreaShiftsOnDate(
    admin,
    db,
    ctx.organizationId,
    restaurantArea.id,
    restaurantCoveredDate,
    ctx.manager.id
  );
  for (const window of [MORNING, LUNCH, EVENING]) {
    await insertConfirmedShift(db, {
      ...baseShift,
      employeeId: kellner1.id,
      locationId: restaurantArea.location_id,
      areaId: restaurantArea.id,
      shiftDate: restaurantCoveredDate,
      startTime: window.start,
      endTime: window.end,
    });
    await insertConfirmedShift(db, {
      ...baseShift,
      employeeId: kellner2.id,
      locationId: restaurantArea.location_id,
      areaId: restaurantArea.id,
      shiftDate: restaurantCoveredDate,
      startTime: window.start,
      endTime: window.end,
    });
  }

  // Restaurant · Mittag · 3/2 Kellner (Überbesetzung)
  await clearAreaShiftsOnDate(
    admin,
    db,
    ctx.organizationId,
    restaurantArea.id,
    restaurantOverstaffedDate,
    ctx.manager.id
  );
  for (const employeeId of [kellner1.id, kellner2.id, kellner3.id]) {
    await insertConfirmedShift(db, {
      ...baseShift,
      employeeId,
      locationId: restaurantArea.location_id,
      areaId: restaurantArea.id,
      shiftDate: restaurantOverstaffedDate,
      startTime: LUNCH.start,
      endTime: LUNCH.end,
    });
  }

  // Küche · Tag voll besetzt, Mittag mit Qualifikations-Hinweis (Koch-Slot)
  await clearAreaShiftsOnDate(
    admin,
    db,
    ctx.organizationId,
    kitchenArea.id,
    kitchenQualDate,
    ctx.manager.id
  );
  await insertConfirmedShift(db, {
    ...baseShift,
    employeeId: kochProfile.id,
    locationId: kitchenArea.location_id,
    areaId: kitchenArea.id,
    shiftDate: kitchenQualDate,
    startTime: MORNING.start,
    endTime: MORNING.end,
  });
  await insertConfirmedShift(db, {
    ...baseShift,
    employeeId: wrongKochProfile.id,
    locationId: kitchenArea.location_id,
    areaId: kitchenArea.id,
    shiftDate: kitchenQualDate,
    startTime: LUNCH.start,
    endTime: LUNCH.end,
  });
  await insertConfirmedShift(db, {
    ...baseShift,
    employeeId: spuelProfile.id,
    locationId: kitchenArea.location_id,
    areaId: kitchenArea.id,
    shiftDate: kitchenQualDate,
    startTime: LUNCH.start,
    endTime: LUNCH.end,
  });
  await insertConfirmedShift(db, {
    ...baseShift,
    employeeId: kochProfile.id,
    locationId: kitchenArea.location_id,
    areaId: kitchenArea.id,
    shiftDate: kitchenQualDate,
    startTime: EVENING.start,
    endTime: EVENING.end,
  });
  await insertConfirmedShift(db, {
    ...baseShift,
    employeeId: spuelProfile.id,
    locationId: kitchenArea.location_id,
    areaId: kitchenArea.id,
    shiftDate: kitchenQualDate,
    startTime: EVENING.start,
    endTime: EVENING.end,
  });

  await db.updateOrganizationShiftConfirmationEnabled(ctx.organizationId, true);

  // Bar · Sonntag Abend · Bestätigungsstatus (pending + rejected)
  await clearAreaShiftsOnDate(
    admin,
    db,
    ctx.organizationId,
    barArea.id,
    barConfirmationDate,
    ctx.manager.id
  );
  await insertConfirmedShift(db, {
    ...baseShift,
    employeeId: barista.id,
    locationId: barArea.location_id,
    areaId: barArea.id,
    shiftDate: barConfirmationDate,
    startTime: EVENING.start,
    endTime: EVENING.end,
    confirmationStatus: "pending",
  });
  await insertConfirmedShift(db, {
    ...baseShift,
    employeeId: barista2.id,
    locationId: barArea.location_id,
    areaId: barArea.id,
    shiftDate: barConfirmationDate,
    startTime: EVENING.start,
    endTime: EVENING.end,
    confirmationStatus: "rejected",
  });

  const manifest: DashboardScenariosManifest = {
    weekStart,
    locationId: restaurantArea.location_id,
    shiftConfirmationEnabled: true,
    barUnderstaffed: { shiftDate: barDate, areaName: barArea.name },
    restaurantUnderstaffed: {
      shiftDate: restaurantUnderstaffedDate,
      areaName: restaurantArea.name,
    },
    restaurantCovered: {
      shiftDate: restaurantCoveredDate,
      areaName: restaurantArea.name,
    },
    restaurantOverstaffed: {
      shiftDate: restaurantOverstaffedDate,
      areaName: restaurantArea.name,
    },
    kitchenQualMismatch: {
      shiftDate: kitchenQualDate,
      areaName: kitchenArea.name,
    },
    barConfirmation: {
      shiftDate: barConfirmationDate,
      areaName: barArea.name,
    },
  };

  mkdirSync(E2E_CACHE_DIR, { recursive: true });
  const cachePath = resolve(E2E_CACHE_DIR, "dashboard-scenarios.json");
  writeFileSync(cachePath, JSON.stringify(manifest, null, 2), "utf8");

  console.log("E2E Dashboard-Szenarien bereit (KW ab", weekStart + ", heute", ctx.todayISO + "):");
  console.log("  Bar unterbesetzt:", barDate, barArea.name);
  console.log(
    "  Restaurant unterbesetzt:",
    restaurantUnderstaffedDate,
    restaurantArea.name
  );
  console.log("  Restaurant gedeckt:", restaurantCoveredDate, restaurantArea.name);
  console.log(
    "  Restaurant überbesetzt:",
    restaurantOverstaffedDate,
    restaurantArea.name
  );
  console.log("  Küche Quali:", kitchenQualDate, kitchenArea.name);
  console.log(
    "  Bar Bestätigung:",
    barConfirmationDate,
    barArea.name,
    "(pending + rejected)"
  );
  console.log("  Cache:", cachePath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
