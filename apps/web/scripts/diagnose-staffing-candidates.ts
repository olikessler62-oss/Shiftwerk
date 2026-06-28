/**
 * Diagnose: warum das Personal-Vorschlagen-Modal leer ist.
 *
 *   npx tsx scripts/diagnose-staffing-candidates.ts --date 2026-06-28 --area küche --from 12:00 --to 15:00
 */

import { createClient } from "@supabase/supabase-js";
import {
  createDatabase,
  isoWeekEndFromWeekStart,
  isoWeekStartFromShiftDate,
  organizationTodayISO,
  profileEligibleForShiftConfirmationAssignment,
  resolveOrganizationTimeZone,
  shiftTimeFromTimestamp,
} from "@schichtwerk/database";
import { weekDates } from "@/lib/dates";
import {
  areAreaCalendarShiftTimesComplete,
  employeeEligibleForBulkShiftAssignment,
  filterAreaCalendarShiftAssignEmployeesByWindow,
  filterEmployeesAvailableOnWeekday,
  filterEmployeesNotAbsentOnDate,
  filterProfilesForShiftAssignment,
  filterProfilesForShiftConfirmationAssign,
  profileAvailabilityWeekdayFromAreaCalendarDate,
} from "@/lib/available-employees-for-shift";
import { filterEmployeesByQualification } from "@/lib/bulk-shift-qualification";
import {
  filterEmployeesWithinWeeklyMinutesForShift,
} from "@/lib/dashboard-staffing-candidates";
import { filterEmployeesWithinWeeklyHoursForShift } from "@/lib/shift-weekly-hours-validation-client";
import { areaCalendarShiftWindowsOverlap } from "@/lib/shift-overlap";
import {
  findAreaByKey,
  loadEnvFile,
  loadE2ESeedEnv,
  profileHasQualification,
  resolveManagerContext,
  E2E_ENV_PATH,
} from "./e2e/seed-shared";

function parseArgs() {
  const args = process.argv.slice(2);
  let date = organizationTodayISO("Europe/Berlin");
  let areaKey = "küche";
  let from = "12:00";
  let to = "15:00";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--date" && args[i + 1]) date = args[++i];
    else if (arg === "--area" && args[i + 1]) areaKey = args[++i];
    else if (arg === "--from" && args[i + 1]) from = args[++i];
    else if (arg === "--to" && args[i + 1]) to = args[++i];
  }

  return { date, areaKey, from, to };
}

function overlapReason(
  employeeId: string,
  shiftDate: string,
  from: string,
  to: string,
  shifts: {
    employee_id: string;
    shift_date: string;
    startTime: string;
    endTime: string;
    location_area_id: string | null;
    areaName?: string;
  }[],
  areaId: string,
  timeZone: string
): string | null {
  for (const shift of shifts) {
    if (shift.employee_id !== employeeId || shift.shift_date !== shiftDate) continue;
    if (
      areaCalendarShiftWindowsOverlap(
        shiftDate,
        from,
        to,
        shift.startTime,
        shift.endTime,
        timeZone
      )
    ) {
      const where =
        shift.location_area_id === areaId
          ? "gleicher Bereich"
          : shift.areaName ?? "anderer Bereich";
      return `${shift.startTime}–${shift.endTime} (${where})`;
    }
  }
  return null;
}

async function main() {
  loadE2ESeedEnv();
  loadEnvFile(E2E_ENV_PATH, true);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SECRET_KEY (oder SUPABASE_SERVICE_ROLE_KEY) fehlen"
    );
  }

  const { date, areaKey, from, to } = parseArgs();
  const admin = createClient(url, serviceKey);
  const db = createDatabase(admin);
  const ctx = await resolveManagerContext(db, admin);
  const area = await findAreaByKey(db, ctx.organizationId, areaKey);
  const timeZone = resolveOrganizationTimeZone(ctx.organization);
  const shiftConfirmationEnabled = ctx.organization.shift_confirmation_enabled;

  const qualifications = await db.listQualifications(ctx.organizationId);
  const spuelQual = qualifications.find((q) => q.name === "Spülkraft");
  if (!spuelQual) throw new Error("Qualifikation Spülkraft nicht gefunden");

  const weekday = profileAvailabilityWeekdayFromAreaCalendarDate(date);
  const weekStart = isoWeekStartFromShiftDate(date);
  const weekEnd = isoWeekEndFromWeekStart(weekStart);
  const weekDatesList = weekDates(weekStart);

  const [availability, absences, orgShifts, locations] = await Promise.all([
    db.listOrganizationRecurringAvailability(ctx.organizationId),
    db.listOrganizationAbsences(ctx.organizationId, { statuses: ["approved"] }),
    db.listOrganizationShiftsInDateRange(ctx.organizationId, weekStart, weekEnd),
    db.listLocations(ctx.organizationId),
  ]);

  const areaNameById = new Map<string, string>();
  for (const location of locations) {
    const areas = await db.listLocationAreas(location.id);
    for (const a of areas) areaNameById.set(a.id, a.name);
  }

  const planningShifts = orgShifts.map((shift) => ({
    id: shift.id,
    employee_id: shift.employee_id,
    shift_date: shift.shift_date,
    startTime: shiftTimeFromTimestamp(shift.starts_at, timeZone),
    endTime: shiftTimeFromTimestamp(shift.ends_at, timeZone),
    location_id: shift.location_id,
    location_area_id: shift.location_area_id,
    areaName: shift.location_area_id
      ? areaNameById.get(shift.location_area_id)
      : undefined,
  }));

  const availabilityByProfile = new Map<string, typeof availability>();
  for (const slot of availability) {
    const list = availabilityByProfile.get(slot.profile_id) ?? [];
    list.push(slot);
    availabilityByProfile.set(slot.profile_id, list);
  }

  const schedulable = filterProfilesForShiftAssignment(
    ctx.profiles,
    ctx.organizationId
  );
  const afterAppGate = filterProfilesForShiftConfirmationAssign(
    schedulable,
    shiftConfirmationEnabled,
    false
  );
  const afterAbsence = filterEmployeesNotAbsentOnDate(afterAppGate, absences, date);
  const afterWeekday = filterEmployeesAvailableOnWeekday(
    afterAbsence,
    availability,
    weekday,
    ctx.organizationId
  );

  const employees = afterWeekday.map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
    weekly_hours: profile.weekly_hours,
    availabilities: (availabilityByProfile.get(profile.id) ?? []).map((slot) => ({
      weekday: slot.weekday,
      start_time: slot.start_time,
      end_time: slot.end_time,
    })),
  }));

  const afterWindow = filterAreaCalendarShiftAssignEmployeesByWindow(
    employees,
    weekday,
    from,
    to
  );

  const areaAssignments = planningShifts
    .filter(
      (s) => s.shift_date === date && s.location_area_id === area.id
    )
    .map((s) => ({
      employeeId: s.employee_id,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

  const otherAreaAssignments = planningShifts
    .filter(
      (s) =>
        s.shift_date === date &&
        s.location_area_id &&
        s.location_area_id !== area.id
    )
    .map((s) => ({
      employeeId: s.employee_id,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

  const assignContext = {
    shiftDate: date,
    countryCode: (await db.getOrganizationCountryCode(ctx.organizationId)) ?? "DE",
    timeZone,
    areaAssignments,
    otherAreaAssignments,
  };

  const afterOverlap = afterWindow.filter((employee) =>
    employeeEligibleForBulkShiftAssignment(employee.id, from, to, assignContext)
  );

  const qualMap = ctx.qualIdsByProfile;
  const profileQualificationIds = new Map(
    [...qualMap.entries()].map(([id, ids]) => [id, new Set(ids)])
  );

  const spuelProfiles = ctx.profiles.filter((p) =>
    profileHasQualification(qualMap, p.id, spuelQual.id)
  );

  const afterQual = filterEmployeesByQualification(
    afterOverlap,
    spuelQual.id,
    profileQualificationIds
  );

  const weekShiftRefs = planningShifts.map((s) => ({
    id: s.id,
    employee_id: s.employee_id,
    shift_date: s.shift_date,
    startTime: s.startTime,
    endTime: s.endTime,
  }));

  const afterWeeklyHours = filterEmployeesWithinWeeklyHoursForShift(afterQual, {
    weekShifts: weekShiftRefs,
    shiftDate: date,
    startTime: from,
    endTime: to,
    timeZone,
  });

  const finalCandidates = filterEmployeesWithinWeeklyMinutesForShift(
    afterWeeklyHours,
    planningShifts,
    weekDatesList,
    from,
    to
  );

  console.log("=== Personal-Vorschläge Diagnose ===");
  console.log(`Organisation: ${ctx.organization.name}`);
  console.log(`Datum: ${date} (Wochentag-Index ${weekday})`);
  console.log(`Bereich: ${area.name}`);
  console.log(`Fenster: ${from}–${to}`);
  console.log(`Schichtbestätigung aktiv: ${shiftConfirmationEnabled}`);
  console.log("");
  console.log("Filter-Stufen (Anzahl):");
  console.log(`  Spülkraft-Qualifikation gesamt: ${spuelProfiles.length}`);
  console.log(`  Planbar: ${schedulable.length}`);
  console.log(
    `  Nach App-Registrierungs-Gate: ${afterAppGate.length}${
      shiftConfirmationEnabled
        ? ` (${schedulable.length - afterAppGate.length} ohne App/E-Mail-Fallback)`
        : ""
    }`
  );
  console.log(`  Nicht abwesend: ${afterAbsence.length}`);
  console.log(`  Verfügbar am Wochentag: ${afterWeekday.length}`);
  console.log(`  Verfügbarkeit deckt ${from}–${to}: ${afterWindow.length}`);
  console.log(`  Kein Overlap / Tages-Compliance: ${afterOverlap.length}`);
  console.log(`  Mit Spülkraft-Qualifikation: ${afterQual.length}`);
  console.log(`  Wochenstunden (validate): ${afterWeeklyHours.length}`);
  console.log(`  Wochenstunden (Minuten): ${finalCandidates.length}`);
  console.log("");
  console.log(
    finalCandidates.length > 0
      ? `Ergebnis: ${finalCandidates.length} Kandidat(en) — ${finalCandidates.map((e) => e.full_name).join(", ")}`
      : "Ergebnis: Kein passendes Personal (alle Filter)"
  );

  if (finalCandidates.length === 0 && spuelProfiles.length > 0) {
    console.log("\n--- Spülkraft-Profile: Ausschlussgrund ---");
    for (const profile of spuelProfiles) {
      const reasons: string[] = [];
      if (!schedulable.some((p) => p.id === profile.id)) {
        reasons.push("nicht planbar/inaktiv");
      }
      if (
        shiftConfirmationEnabled &&
        !profileEligibleForShiftConfirmationAssignment(profile)
      ) {
        reasons.push("keine App-Registrierung / kein E-Mail-Fallback");
      }
      if (!afterAbsence.some((p) => p.id === profile.id)) {
        reasons.push("abwesend");
      }
      if (!afterWeekday.some((p) => p.id === profile.id)) {
        reasons.push("keine Verfügbarkeit am Wochentag");
      }
      if (!afterWindow.some((p) => p.id === profile.id)) {
        reasons.push(`Verfügbarkeit deckt ${from}–${to} nicht`);
      }
      if (afterWindow.some((p) => p.id === profile.id) && !afterOverlap.some((p) => p.id === profile.id)) {
        const overlap = overlapReason(
          profile.id,
          date,
          from,
          to,
          planningShifts,
          area.id,
          timeZone
        );
        reasons.push(overlap ? `Überschneidung: ${overlap}` : "Overlap/Compliance");
      }
      if (afterOverlap.some((p) => p.id === profile.id) && !afterWeeklyHours.some((p) => p.id === profile.id)) {
        reasons.push("Wochenstunden-Ziel überschritten");
      }
      if (afterWeeklyHours.some((p) => p.id === profile.id) && !finalCandidates.some((p) => p.id === profile.id)) {
        reasons.push("Wochenstunden (Minuten-Summe) überschritten");
      }
      console.log(`  ${profile.full_name}: ${reasons.length ? reasons.join("; ") : "sollte Kandidat sein — prüfen"}`);
    }
  }

  const kitchenDayShifts = planningShifts.filter(
    (s) => s.shift_date === date && s.location_area_id === area.id
  );
  if (kitchenDayShifts.length) {
    console.log("\n--- Schichten Küche an diesem Tag ---");
    for (const s of kitchenDayShifts) {
      const name =
        ctx.profiles.find((p) => p.id === s.employee_id)?.full_name ?? s.employee_id;
      console.log(`  ${s.startTime}–${s.endTime}: ${name}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
