import {
  buildShiftTimestamps,
  isoWeekStartFromShiftDate,
  isShiftDateInIsoWeek,
  resolveProfileWeeklyHoursTarget,
  shiftDurationHours,
  type SchichtwerkDatabase,
} from "@schichtwerk/database";
import type { Profile } from "@schichtwerk/types";

export const BIERGARTEN_HADRIAN_SCENARIO_LOCATION_NAMES = [
  "Biergarten",
  "Hadrian-Eck",
] as const;

const AREA_NAMES = ["Restaurant", "Küche", "Bar"] as const;

const OPEN_WEEKDAYS = [0, 1, 2, 4, 5, 6] as const;

const SERVICE_WINDOWS = [
  { start: "08:00", end: "10:00" },
  { start: "12:00", end: "15:00" },
  { start: "18:00", end: "22:00" },
] as const;

const SHIFT_TEMPLATES = [
  { name: "Früh", start: "08:00", end: "10:00", color: "#3b82f6" },
  { name: "Mittel", start: "12:00", end: "15:00", color: "#22c55e" },
  { name: "Spät", start: "18:00", end: "22:00", color: "#f97316" },
] as const;

type StaffingQualRule = { qualName: string; count: number };

type StaffingWindowRule = {
  start: string;
  end: string;
  qualifications: readonly StaffingQualRule[];
};

const STAFFING_BY_AREA_KEY: Record<
  string,
  (barQualName: string) => readonly StaffingWindowRule[]
> = {
  restaurant: () =>
    SERVICE_WINDOWS.map((window) => ({
      start: window.start,
      end: window.end,
      qualifications: [{ qualName: "Kellner/in", count: 2 }],
    })),
  küche: () => [
    {
      start: "08:00",
      end: "10:00",
      qualifications: [{ qualName: "Koch/Köchin", count: 1 }],
    },
    {
      start: "12:00",
      end: "15:00",
      qualifications: [
        { qualName: "Koch/Köchin", count: 1 },
        { qualName: "Spülkraft", count: 1 },
      ],
    },
    {
      start: "18:00",
      end: "22:00",
      qualifications: [
        { qualName: "Koch/Köchin", count: 1 },
        { qualName: "Spülkraft", count: 1 },
      ],
    },
  ],
  bar: (barQualName) =>
    SERVICE_WINDOWS.map((window) => ({
      start: window.start,
      end: window.end,
      qualifications: [
        { qualName: barQualName, count: 1 },
        { qualName: "Spülkraft", count: 1 },
      ],
    })),
};

type PlannedShift = {
  employeeId: string;
  locationId: string;
  areaId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
};

type ExistingShiftRef = {
  id: string;
  employee_id: string;
  location_id: string;
  shift_date: string;
  starts_at: string;
  ends_at: string;
};

export type BiergartenHadrianScenarioResult = {
  weekStart: string;
  locationCount: number;
  areaCount: number;
  shiftCount: number;
  openSlots: number;
  coveredSlots: number;
};

function areaKey(name: string): string {
  return name.trim().toLowerCase();
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function isoToPlanningWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index));
}

function openDatesInWeek(weekStart: string): string[] {
  return weekDates(weekStart).filter((date) =>
    (OPEN_WEEKDAYS as readonly number[]).includes(isoToPlanningWeekday(date))
  );
}

function shiftsOverlapIso(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a0 = new Date(startA).getTime();
  const a1 = new Date(endA).getTime();
  const b0 = new Date(startB).getTime();
  const b1 = new Date(endB).getTime();
  return a0 < b1 && b0 < a1;
}

function windowsOverlap(
  shiftDate: string,
  startA: string,
  endA: string,
  startB: string,
  endB: string,
  timeZone: string
): boolean {
  const a = buildShiftTimestamps(shiftDate, startA, endA, timeZone);
  const b = buildShiftTimestamps(shiftDate, startB, endB, timeZone);
  return shiftsOverlapIso(a.starts_at, a.ends_at, b.starts_at, b.ends_at);
}

function slotSeed(parts: readonly string[]): number {
  let hash = 0;
  const joined = parts.join("|");
  for (let index = 0; index < joined.length; index++) {
    hash = (hash * 31 + joined.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function coverageTarget(requiredCount: number, seed: number): number {
  const bucket = seed % 10;
  if (bucket < 3) return 0;
  if (bucket < 6) {
    return requiredCount <= 1 ? 0 : Math.max(1, requiredCount - 1);
  }
  return requiredCount;
}

function profileHasQualification(
  qualIdsByProfile: Map<string, string[]>,
  profileId: string,
  qualificationId: string
): boolean {
  return (qualIdsByProfile.get(profileId) ?? []).includes(qualificationId);
}

function employeeWeekHours(
  employeeId: string,
  weekStart: string,
  existing: readonly ExistingShiftRef[],
  planned: readonly PlannedShift[]
): number {
  let total = 0;

  for (const shift of existing) {
    if (shift.employee_id !== employeeId) continue;
    if (!isShiftDateInIsoWeek(shift.shift_date, weekStart)) continue;
    const ms =
      new Date(shift.ends_at).getTime() - new Date(shift.starts_at).getTime();
    total += Math.round((ms / 3_600_000) * 10) / 10;
  }

  for (const shift of planned) {
    if (shift.employeeId !== employeeId) continue;
    if (!isShiftDateInIsoWeek(shift.shiftDate, weekStart)) continue;
    total += shiftDurationHours(shift.startTime, shift.endTime);
  }

  return Math.round(total * 10) / 10;
}

function canAssignEmployee(input: {
  employee: Profile;
  qualificationId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  weekStart: string;
  timeZone: string;
  qualIdsByProfile: Map<string, string[]>;
  existingShifts: readonly ExistingShiftRef[];
  plannedShifts: readonly PlannedShift[];
}): boolean {
  if (
    !profileHasQualification(
      input.qualIdsByProfile,
      input.employee.id,
      input.qualificationId
    )
  ) {
    return false;
  }

  for (const planned of input.plannedShifts) {
    if (planned.employeeId !== input.employee.id) continue;
    if (planned.shiftDate !== input.shiftDate) continue;
    if (
      windowsOverlap(
        input.shiftDate,
        input.startTime,
        input.endTime,
        planned.startTime,
        planned.endTime,
        input.timeZone
      )
    ) {
      return false;
    }
  }

  for (const existing of input.existingShifts) {
    if (existing.employee_id !== input.employee.id) continue;
    if (existing.shift_date !== input.shiftDate) continue;
    const start = existing.starts_at;
    const end = existing.ends_at;
    const proposed = buildShiftTimestamps(
      input.shiftDate,
      input.startTime,
      input.endTime,
      input.timeZone
    );
    if (shiftsOverlapIso(proposed.starts_at, proposed.ends_at, start, end)) {
      return false;
    }
  }

  const targetHours = resolveProfileWeeklyHoursTarget(input.employee.weekly_hours);
  const proposedHours = shiftDurationHours(input.startTime, input.endTime);
  const weekHours =
    employeeWeekHours(
      input.employee.id,
      input.weekStart,
      input.existingShifts,
      input.plannedShifts
    ) + proposedHours;

  return weekHours <= targetHours;
}

async function ensureLocation(
  db: SchichtwerkDatabase,
  organizationId: string,
  name: string
): Promise<{ id: string; name: string }> {
  const locations = await db.listLocations(organizationId);
  const existing = locations.find(
    (location) => location.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (existing) return { id: existing.id, name: existing.name };

  const sortOrder = await db.getNextLocationSortOrder(organizationId);
  const created = await db.insertLocation({
    organization_id: organizationId,
    name,
    sort_order: sortOrder,
  });
  return { id: created.id, name };
}

async function ensureAreas(
  db: SchichtwerkDatabase,
  locationId: string
): Promise<{ id: string; name: string }[]> {
  let areas = await db.listLocationAreas(locationId);
  const barArea = areas.find((area) => area.name === "BAR");
  if (barArea) {
    await db.updateLocationArea(barArea.id, locationId, {
      name: "Bar",
      planning_mode: "advanced",
    });
    areas = await db.listLocationAreas(locationId);
  }

  const byKey = new Map(areas.map((area) => [areaKey(area.name), area]));

  for (const areaName of AREA_NAMES) {
    const key = areaKey(areaName);
    if (!byKey.has(key)) {
      const sortOrder = await db.getNextLocationAreaSortOrder(locationId);
      await db.insertLocationArea({
        location_id: locationId,
        name: areaName,
        sort_order: sortOrder,
        planning_mode: "advanced",
      });
    } else {
      const area = byKey.get(key)!;
      await db.updateLocationArea(area.id, locationId, {
        name: areaName,
        planning_mode: "advanced",
      });
    }
  }

  const refreshed = await db.listLocationAreas(locationId);
  return refreshed
    .filter((area) =>
      AREA_NAMES.some((name) => areaKey(name) === areaKey(area.name))
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((area) => ({ id: area.id, name: area.name }));
}

async function configureAreaServiceHours(
  db: SchichtwerkDatabase,
  locationId: string,
  areaId: string
) {
  const rows = OPEN_WEEKDAYS.flatMap((weekday) =>
    SERVICE_WINDOWS.map((window) => ({
      weekday,
      start_time: window.start,
      end_time: window.end,
    }))
  );
  await db.replaceLocationAreaServiceHours(areaId, locationId, rows);
}

async function configureAreaShiftTemplates(
  db: SchichtwerkDatabase,
  locationId: string,
  areaId: string
) {
  await db.clearAreaShiftTemplatesForArea(areaId, locationId);
  for (const [index, template] of SHIFT_TEMPLATES.entries()) {
    await db.insertAreaShiftTemplate({
      location_area_id: areaId,
      name: template.name,
      start_time: template.start,
      end_time: template.end,
      color: template.color,
      sort_order: index,
    });
  }
}

async function configureAreaStaffing(
  db: SchichtwerkDatabase,
  locationId: string,
  areaId: string,
  areaName: string,
  qualificationIdsByName: Map<string, string>,
  barQualName: string
) {
  const ruleFactory = STAFFING_BY_AREA_KEY[areaKey(areaName)];
  if (!ruleFactory) {
    throw new Error(`Kein Personalbedarf für Bereich „${areaName}“ definiert`);
  }
  const rules = ruleFactory(barQualName);

  const hours = await db.listLocationAreaServiceHoursForArea(areaId, locationId);
  const staffingRules: {
    service_hour_id: string;
    qualification_id: string;
    required_count: number;
  }[] = [];

  for (const rule of rules) {
    const matchingHours = hours.filter(
      (hour) =>
        hour.start_time.slice(0, 5) === rule.start &&
        hour.end_time.slice(0, 5) === rule.end &&
        (OPEN_WEEKDAYS as readonly number[]).includes(hour.weekday)
    );
    const serviceHourIds = [...new Set(matchingHours.map((hour) => hour.id))];
    if (serviceHourIds.length === 0) {
      throw new Error(
        `Servicezeit ${rule.start}–${rule.end} fehlt für Bereich „${areaName}“`
      );
    }

    for (const serviceHourId of serviceHourIds) {
      for (const qualRule of rule.qualifications) {
        const qualificationId = qualificationIdsByName.get(qualRule.qualName);
        if (!qualificationId) {
          throw new Error(`Qualifikation „${qualRule.qualName}“ nicht gefunden`);
        }
        staffingRules.push({
          service_hour_id: serviceHourId,
          qualification_id: qualificationId,
          required_count: qualRule.count,
        });
      }
    }
  }

  await db.replaceLocationAreaStaffing(areaId, locationId, staffingRules);
}

async function deleteOrganizationShiftsInDateRange(
  db: SchichtwerkDatabase,
  organizationId: string,
  fromDate: string,
  toDate: string,
  deletedBy: string
) {
  const shifts = await db.listOrganizationShiftsForSuperadmin(organizationId);
  for (const shift of shifts) {
    if (shift.shift_date < fromDate || shift.shift_date > toDate) continue;
    await db.deleteShift(shift.id, organizationId, deletedBy);
  }
}

function existingShiftsOutsideDateRange(
  shifts: Awaited<ReturnType<SchichtwerkDatabase["listOrganizationShiftsForSuperadmin"]>>,
  fromDate: string,
  toDate: string
): ExistingShiftRef[] {
  return shifts
    .filter((shift) => shift.shift_date < fromDate || shift.shift_date > toDate)
    .map((shift) => ({
      id: shift.id,
      employee_id: shift.employee_id,
      location_id: shift.location_id ?? "",
      shift_date: shift.shift_date,
      starts_at: shift.starts_at,
      ends_at: shift.ends_at,
    }));
}

async function deleteAllLocationShifts(
  db: SchichtwerkDatabase,
  organizationId: string,
  locationIds: readonly string[],
  deletedBy: string
) {
  const shifts = await db.listOrganizationShiftsForSuperadmin(organizationId);
  const locationIdSet = new Set(locationIds);

  for (const shift of shifts) {
    if (!shift.location_id || !locationIdSet.has(shift.location_id)) continue;
    await db.deleteShift(shift.id, organizationId, deletedBy);
  }
}

function orderEmployeesByWeeklyHoursForAssign(
  employees: readonly Profile[],
  weekStart: string,
  existingShifts: readonly ExistingShiftRef[],
  plannedShifts: readonly PlannedShift[]
): Profile[] {
  return [...employees].sort((a, b) => {
    const hoursDiff =
      employeeWeekHours(a.id, weekStart, existingShifts, plannedShifts) -
      employeeWeekHours(b.id, weekStart, existingShifts, plannedShifts);
    if (hoursDiff !== 0) return hoursDiff;
    return a.full_name.localeCompare(b.full_name, "de");
  });
}

function planRandomShifts(input: {
  locations: readonly { id: string; areas: readonly { id: string; name: string }[] }[];
  openDates: readonly string[];
  weekStart: string;
  timeZone: string;
  employees: readonly Profile[];
  qualIdsByProfile: Map<string, string[]>;
  qualificationIdsByName: Map<string, string>;
  existingShifts: readonly ExistingShiftRef[];
  barQualName: string;
}): { planned: PlannedShift[]; openSlots: number; coveredSlots: number } {
  const planned: PlannedShift[] = [];
  let openSlots = 0;
  let coveredSlots = 0;

  for (const location of input.locations) {
    for (const area of location.areas) {
      const ruleFactory = STAFFING_BY_AREA_KEY[areaKey(area.name)];
      const staffingRules = ruleFactory ? ruleFactory(input.barQualName) : [];

      for (const date of input.openDates) {
        for (const rule of staffingRules) {
          for (const qualRule of rule.qualifications) {
            const qualificationId = input.qualificationIdsByName.get(
              qualRule.qualName
            );
            if (!qualificationId) continue;

            const seed = slotSeed([
              location.id,
              area.id,
              date,
              rule.start,
              rule.end,
              qualRule.qualName,
            ]);
            const targetCount = coverageTarget(qualRule.count, seed);
            openSlots += Math.max(0, qualRule.count - targetCount);
            coveredSlots += targetCount;

            const candidates = orderEmployeesByWeeklyHoursForAssign(
              input.employees.filter((employee) =>
                profileHasQualification(
                  input.qualIdsByProfile,
                  employee.id,
                  qualificationId
                )
              ),
              input.weekStart,
              input.existingShifts,
              planned
            );

            let assigned = 0;
            for (const employee of candidates) {
              if (assigned >= targetCount) break;
              if (
                !canAssignEmployee({
                  employee,
                  qualificationId,
                  shiftDate: date,
                  startTime: rule.start,
                  endTime: rule.end,
                  weekStart: input.weekStart,
                  timeZone: input.timeZone,
                  qualIdsByProfile: input.qualIdsByProfile,
                  existingShifts: input.existingShifts,
                  plannedShifts: planned,
                })
              ) {
                continue;
              }

              planned.push({
                employeeId: employee.id,
                locationId: location.id,
                areaId: area.id,
                shiftDate: date,
                startTime: rule.start,
                endTime: rule.end,
              });
              assigned += 1;
            }

            openSlots += Math.max(0, targetCount - assigned);
            coveredSlots -= Math.max(0, targetCount - assigned);
          }
        }
      }
    }
  }

  return { planned, openSlots, coveredSlots };
}

function planFullyCoveredShifts(input: {
  locations: readonly { id: string; areas: readonly { id: string; name: string }[] }[];
  openDates: readonly string[];
  weekStart: string;
  timeZone: string;
  employees: readonly Profile[];
  qualIdsByProfile: Map<string, string[]>;
  qualificationIdsByName: Map<string, string>;
  existingShifts: readonly ExistingShiftRef[];
  barQualName: string;
}): { planned: PlannedShift[]; openSlots: number; coveredSlots: number } {
  const planned: PlannedShift[] = [];
  let openSlots = 0;
  let coveredSlots = 0;

  for (const location of input.locations) {
    for (const area of location.areas) {
      const ruleFactory = STAFFING_BY_AREA_KEY[areaKey(area.name)];
      const staffingRules = ruleFactory ? ruleFactory(input.barQualName) : [];

      for (const date of input.openDates) {
        for (const rule of staffingRules) {
          for (const qualRule of rule.qualifications) {
            const qualificationId = input.qualificationIdsByName.get(
              qualRule.qualName
            );
            if (!qualificationId) continue;

            const seed = slotSeed([
              location.id,
              area.id,
              date,
              rule.start,
              rule.end,
              qualRule.qualName,
            ]);
            const targetCount = qualRule.count;

            const candidates = orderEmployeesByWeeklyHoursForAssign(
              input.employees.filter((employee) =>
                profileHasQualification(
                  input.qualIdsByProfile,
                  employee.id,
                  qualificationId
                )
              ),
              input.weekStart,
              input.existingShifts,
              planned
            );

            let assigned = 0;
            for (const employee of candidates) {
              if (assigned >= targetCount) break;
              if (
                !canAssignEmployee({
                  employee,
                  qualificationId,
                  shiftDate: date,
                  startTime: rule.start,
                  endTime: rule.end,
                  weekStart: input.weekStart,
                  timeZone: input.timeZone,
                  qualIdsByProfile: input.qualIdsByProfile,
                  existingShifts: input.existingShifts,
                  plannedShifts: planned,
                })
              ) {
                continue;
              }

              planned.push({
                employeeId: employee.id,
                locationId: location.id,
                areaId: area.id,
                shiftDate: date,
                startTime: rule.start,
                endTime: rule.end,
              });
              assigned += 1;
            }

            coveredSlots += assigned;
            openSlots += Math.max(0, targetCount - assigned);
          }
        }
      }
    }
  }

  return { planned, openSlots, coveredSlots };
}

async function configureBiergartenHadrianLocations(
  db: SchichtwerkDatabase,
  organizationId: string,
  qualificationIdsByName: Map<string, string>,
  barQualName: string
): Promise<{ id: string; areas: { id: string; name: string }[] }[]> {
  const configuredLocations: {
    id: string;
    areas: { id: string; name: string }[];
  }[] = [];

  for (const locationName of BIERGARTEN_HADRIAN_SCENARIO_LOCATION_NAMES) {
    const location = await ensureLocation(db, organizationId, locationName);
    const areas = await ensureAreas(db, location.id);

    for (const area of areas) {
      await configureAreaServiceHours(db, location.id, area.id);
      await configureAreaShiftTemplates(db, location.id, area.id);
      await configureAreaStaffing(
        db,
        location.id,
        area.id,
        area.name,
        qualificationIdsByName,
        barQualName
      );
    }

    configuredLocations.push({ id: location.id, areas });
  }

  return configuredLocations;
}

async function resolveBiergartenHadrianQualifications(
  db: SchichtwerkDatabase,
  organizationId: string
): Promise<{
  qualificationIdsByName: Map<string, string>;
  barQualName: string;
}> {
  const qualifications = await db.listQualifications(organizationId);
  const qualificationIdsByName = new Map(
    qualifications.map((qualification) => [qualification.name, qualification.id])
  );

  for (const qualName of ["Kellner/in", "Koch/Köchin", "Spülkraft"]) {
    if (!qualificationIdsByName.has(qualName)) {
      throw new Error(`Qualifikation „${qualName}“ fehlt in der Organisation`);
    }
  }

  const barQualName = qualificationIdsByName.has("Barista")
    ? "Barista"
    : qualificationIdsByName.has("Barkeeper/in")
      ? "Barkeeper/in"
      : null;
  if (!barQualName) {
    throw new Error(
      "Qualifikation „Barista“ oder „Barkeeper/in“ fehlt in der Organisation"
    );
  }

  return { qualificationIdsByName, barQualName };
}

async function insertPlannedConfirmedShifts(
  db: SchichtwerkDatabase,
  organizationId: string,
  actorId: string,
  timeZone: string,
  planned: readonly PlannedShift[]
) {
  for (const shift of planned) {
    const timestamps = buildShiftTimestamps(
      shift.shiftDate,
      shift.startTime,
      shift.endTime,
      timeZone
    );
    await db.insertShift({
      organization_id: organizationId,
      employee_id: shift.employeeId,
      location_id: shift.locationId,
      location_area_id: shift.areaId,
      shift_date: shift.shiftDate,
      starts_at: timestamps.starts_at,
      ends_at: timestamps.ends_at,
      created_by: actorId,
      confirmation_status: "confirmed",
      confirmation_status_updated_at: new Date().toISOString(),
    });
  }
}

export async function runBiergartenHadrianEckScenario(
  db: SchichtwerkDatabase,
  input: {
    organizationId: string;
    actorId: string;
    timeZone: string;
    todayISO: string;
  }
): Promise<BiergartenHadrianScenarioResult> {
  const { qualificationIdsByName, barQualName } =
    await resolveBiergartenHadrianQualifications(db, input.organizationId);

  const configuredLocations = await configureBiergartenHadrianLocations(
    db,
    input.organizationId,
    qualificationIdsByName,
    barQualName
  );

  const weekStart = isoWeekStartFromShiftDate(input.todayISO);
  const weekEnd = addDaysISO(weekStart, 6);
  const openDates = openDatesInWeek(weekStart).filter(
    (date) => date >= input.todayISO
  );
  const seedDates =
    openDates.length >= 3 ? openDates : openDatesInWeek(weekStart);

  const existingBeforeDelete = await db.listOrganizationShiftsForSuperadmin(
    input.organizationId
  );

  await deleteOrganizationShiftsInDateRange(
    db,
    input.organizationId,
    weekStart,
    weekEnd,
    input.actorId
  );

  const employees = await db.listPlanningEmployees(input.organizationId);
  const qualIdsByProfile =
    await db.listProfileQualificationIdsByOrganization(input.organizationId);

  const { planned, openSlots, coveredSlots } = planRandomShifts({
    locations: configuredLocations,
    openDates: seedDates,
    weekStart,
    timeZone: input.timeZone,
    employees,
    qualIdsByProfile,
    qualificationIdsByName,
    existingShifts: existingShiftsOutsideDateRange(
      existingBeforeDelete,
      weekStart,
      weekEnd
    ),
    barQualName,
  });

  await insertPlannedConfirmedShifts(
    db,
    input.organizationId,
    input.actorId,
    input.timeZone,
    planned
  );

  return {
    weekStart,
    locationCount: configuredLocations.length,
    areaCount: configuredLocations.reduce(
      (sum, location) => sum + location.areas.length,
      0
    ),
    shiftCount: planned.length,
    openSlots,
    coveredSlots,
  };
}

/** Wie Biergarten/Hadrian-Eck, aber alle Schichten der Standorte löschen und nur die aktuelle KW voll besetzt (confirmed) anlegen. */
export async function runBiergartenHadrianEckCurrentWeekFullyCoveredScenario(
  db: SchichtwerkDatabase,
  input: {
    organizationId: string;
    actorId: string;
    timeZone: string;
    todayISO: string;
  }
): Promise<BiergartenHadrianScenarioResult> {
  const { qualificationIdsByName, barQualName } =
    await resolveBiergartenHadrianQualifications(db, input.organizationId);

  const configuredLocations = await configureBiergartenHadrianLocations(
    db,
    input.organizationId,
    qualificationIdsByName,
    barQualName
  );

  const weekStart = isoWeekStartFromShiftDate(input.todayISO);
  const weekEnd = addDaysISO(weekStart, 6);
  const seedDates = openDatesInWeek(weekStart);
  const locationIds = configuredLocations.map((location) => location.id);

  const existingBeforeDelete = await db.listOrganizationShiftsForSuperadmin(
    input.organizationId
  );

  await deleteAllLocationShifts(
    db,
    input.organizationId,
    locationIds,
    input.actorId
  );

  await deleteOrganizationShiftsInDateRange(
    db,
    input.organizationId,
    weekStart,
    weekEnd,
    input.actorId
  );

  const employees = await db.listPlanningEmployees(input.organizationId);
  const qualIdsByProfile =
    await db.listProfileQualificationIdsByOrganization(input.organizationId);

  const { planned, openSlots, coveredSlots } = planFullyCoveredShifts({
    locations: configuredLocations,
    openDates: seedDates,
    weekStart,
    timeZone: input.timeZone,
    employees,
    qualIdsByProfile,
    qualificationIdsByName,
    existingShifts: existingShiftsOutsideDateRange(
      existingBeforeDelete,
      weekStart,
      weekEnd
    ),
    barQualName,
  });

  await insertPlannedConfirmedShifts(
    db,
    input.organizationId,
    input.actorId,
    input.timeZone,
    planned
  );

  return {
    weekStart,
    locationCount: configuredLocations.length,
    areaCount: configuredLocations.reduce(
      (sum, location) => sum + location.areas.length,
      0
    ),
    shiftCount: planned.length,
    openSlots,
    coveredSlots,
  };
}
