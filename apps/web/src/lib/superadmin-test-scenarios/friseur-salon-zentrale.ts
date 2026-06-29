import {
  buildShiftTimestamps,
  isoWeekStartFromShiftDate,
  isShiftDateInIsoWeek,
  resolveProfileWeeklyHoursTarget,
  shiftDurationHours,
  type SchichtwerkDatabase,
  type ShiftTypeBreakInput,
} from "@schichtwerk/database";
import type { Profile } from "@schichtwerk/types";

export const FRISEUR_SALON_SCENARIO_ORG_NAME = "Lucy's Hairstylings";
export const FRISEUR_SALON_SCENARIO_LOCATION_NAME = "Zentrale";
export const FRISEUR_SALON_SCENARIO_AREA_NAME = "Friseur-Salon";
export const FRISEUR_SALON_QUALIFICATION_NAME = "Friseur";

/** Dienstag–Samstag (Planungs-Wochentag Mo=0 … So=6). */
const SERVICE_WEEKDAYS = [1, 2, 3, 4, 5] as const;

const STAFFING_WINDOWS = [
  { start: "08:00", end: "17:00", count: 4 },
  { start: "12:00", end: "20:00", count: 4 },
] as const;

const SHIFT_TEMPLATES = [
  {
    name: "Früh",
    start: "08:00",
    end: "17:00",
    color: "#3b82f6",
    breaks: [{ break_start: "13:00", break_end: "14:00" }],
  },
  {
    name: "Spät",
    start: "12:00",
    end: "20:00",
    color: "#f97316",
    breaks: [{ break_start: "15:30", break_end: "16:30" }],
  },
] as const;

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

export type FriseurSalonScenarioResult = {
  weekStart: string;
  locationCount: number;
  areaCount: number;
  shiftCount: number;
  openSlots: number;
  coveredSlots: number;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
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
    (SERVICE_WEEKDAYS as readonly number[]).includes(isoToPlanningWeekday(date))
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

function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const list = [...items];
  let state = seed || 1;
  for (let index = list.length - 1; index > 0; index--) {
    state = (state * 1103515245 + 12345) >>> 0;
    const swapIndex = state % (index + 1);
    [list[index], list[swapIndex]] = [list[swapIndex]!, list[index]!];
  }
  return list;
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
    const proposed = buildShiftTimestamps(
      input.shiftDate,
      input.startTime,
      input.endTime,
      input.timeZone
    );
    if (
      shiftsOverlapIso(
        proposed.starts_at,
        proposed.ends_at,
        existing.starts_at,
        existing.ends_at
      )
    ) {
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
    (location) => normalizeName(location.name) === normalizeName(name)
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

async function createFriseurSalonArea(
  db: SchichtwerkDatabase,
  locationId: string
): Promise<{ id: string; name: string }> {
  const sortOrder = await db.getNextLocationAreaSortOrder(locationId);
  await db.insertLocationArea({
    location_id: locationId,
    name: FRISEUR_SALON_SCENARIO_AREA_NAME,
    sort_order: sortOrder,
    planning_mode: "advanced",
  });

  const areas = await db.listLocationAreas(locationId);
  const area = areas.find(
    (entry) =>
      normalizeName(entry.name) === normalizeName(FRISEUR_SALON_SCENARIO_AREA_NAME)
  );
  if (!area) {
    throw new Error(
      `Einsatzort „${FRISEUR_SALON_SCENARIO_AREA_NAME}“ konnte nicht angelegt werden`
    );
  }

  return { id: area.id, name: area.name };
}

async function ensureFriseurQualification(
  db: SchichtwerkDatabase,
  organizationId: string
): Promise<string> {
  const qualifications = await db.listQualifications(organizationId);
  const existing = qualifications.find(
    (qualification) =>
      normalizeName(qualification.name) === normalizeName(FRISEUR_SALON_QUALIFICATION_NAME)
  );
  if (existing) return existing.id;

  const sortOrder = await db.getNextQualificationSortOrder(organizationId);
  const created = await db.insertQualification({
    organization_id: organizationId,
    name: FRISEUR_SALON_QUALIFICATION_NAME,
    sort_order: sortOrder,
  });
  return created.id;
}

async function assignFriseurToAllEmployees(
  db: SchichtwerkDatabase,
  organizationId: string,
  friseurQualificationId: string
) {
  const employees = await db.listPlanningEmployees(organizationId);
  const qualIdsByProfile =
    await db.listProfileQualificationIdsByOrganization(organizationId);

  for (const employee of employees) {
    if (profileHasQualification(qualIdsByProfile, employee.id, friseurQualificationId)) {
      continue;
    }
    await db.assignProfileQualification(
      organizationId,
      employee.id,
      friseurQualificationId
    );
  }
}

async function configureAreaQualificationTemplate(
  db: SchichtwerkDatabase,
  organizationId: string,
  locationId: string,
  areaId: string,
  friseurQualificationId: string
) {
  const templates = await db.listAreaQualificationTemplatesForArea(areaId, locationId);
  const alreadyAssigned = templates.some(
    (template) => template.qualification_id === friseurQualificationId
  );
  if (!alreadyAssigned) {
    await db.assignAreaQualificationTemplate(
      organizationId,
      areaId,
      locationId,
      friseurQualificationId
    );
  }
}

async function configureAreaServiceHours(
  db: SchichtwerkDatabase,
  locationId: string,
  areaId: string
) {
  const rows = SERVICE_WEEKDAYS.flatMap((weekday) =>
    STAFFING_WINDOWS.map((window) => ({
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
    const created = await db.insertAreaShiftTemplate({
      location_area_id: areaId,
      name: template.name,
      start_time: template.start,
      end_time: template.end,
      color: template.color,
      sort_order: index,
    });
    if (template.breaks.length > 0) {
      await db.replaceAreaShiftTemplateBreaks(
        created.id,
        template.breaks as ShiftTypeBreakInput[]
      );
    }
  }
}

async function configureAreaStaffing(
  db: SchichtwerkDatabase,
  locationId: string,
  areaId: string,
  friseurQualificationId: string
) {
  const hours = await db.listLocationAreaServiceHoursForArea(areaId, locationId);
  const staffingRules: {
    service_hour_id: string;
    qualification_id: string;
    required_count: number;
  }[] = [];

  for (const window of STAFFING_WINDOWS) {
    const matchingHours = hours.filter(
      (hour) =>
        hour.start_time.slice(0, 5) === window.start &&
        hour.end_time.slice(0, 5) === window.end &&
        (SERVICE_WEEKDAYS as readonly number[]).includes(hour.weekday)
    );
    const serviceHourIds = [...new Set(matchingHours.map((hour) => hour.id))];
    if (serviceHourIds.length === 0) {
      throw new Error(
        `Servicezeit ${window.start}–${window.end} fehlt für Einsatzort „${FRISEUR_SALON_SCENARIO_AREA_NAME}“`
      );
    }

    for (const serviceHourId of serviceHourIds) {
      staffingRules.push({
        service_hour_id: serviceHourId,
        qualification_id: friseurQualificationId,
        required_count: window.count,
      });
    }
  }

  await db.replaceLocationAreaStaffing(areaId, locationId, staffingRules);
}

function planFullyCoveredShifts(input: {
  locationId: string;
  areaId: string;
  openDates: readonly string[];
  weekStart: string;
  timeZone: string;
  employees: readonly Profile[];
  qualIdsByProfile: Map<string, string[]>;
  friseurQualificationId: string;
  existingShifts: readonly ExistingShiftRef[];
}): { planned: PlannedShift[]; openSlots: number; coveredSlots: number } {
  const planned: PlannedShift[] = [];
  let openSlots = 0;
  let coveredSlots = 0;

  const qualifiedEmployees = input.employees.filter((employee) =>
    profileHasQualification(
      input.qualIdsByProfile,
      employee.id,
      input.friseurQualificationId
    )
  );

  for (const date of input.openDates) {
    for (const window of STAFFING_WINDOWS) {
      const seed = slotSeed([
        input.locationId,
        input.areaId,
        date,
        window.start,
        window.end,
        FRISEUR_SALON_QUALIFICATION_NAME,
      ]);
      const candidates = shuffleWithSeed(qualifiedEmployees, seed);
      const targetCount = window.count;

      let assigned = 0;
      for (const employee of candidates) {
        if (assigned >= targetCount) break;
        if (
          !canAssignEmployee({
            employee,
            qualificationId: input.friseurQualificationId,
            shiftDate: date,
            startTime: window.start,
            endTime: window.end,
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
          locationId: input.locationId,
          areaId: input.areaId,
          shiftDate: date,
          startTime: window.start,
          endTime: window.end,
        });
        assigned += 1;
      }

      coveredSlots += assigned;
      openSlots += Math.max(0, targetCount - assigned);
    }
  }

  return { planned, openSlots, coveredSlots };
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

export async function runFriseurSalonZentraleScenario(
  db: SchichtwerkDatabase,
  input: {
    organizationId: string;
    actorId: string;
    timeZone: string;
    todayISO: string;
  }
): Promise<FriseurSalonScenarioResult> {
  await db.prepareFriseurSalonScenario(input.organizationId);

  const friseurQualificationId = await ensureFriseurQualification(
    db,
    input.organizationId
  );
  await assignFriseurToAllEmployees(
    db,
    input.organizationId,
    friseurQualificationId
  );

  const location = await ensureLocation(
    db,
    input.organizationId,
    FRISEUR_SALON_SCENARIO_LOCATION_NAME
  );

  const area = await createFriseurSalonArea(db, location.id);
  await configureAreaQualificationTemplate(
    db,
    input.organizationId,
    location.id,
    area.id,
    friseurQualificationId
  );
  await configureAreaServiceHours(db, location.id, area.id);
  await configureAreaShiftTemplates(db, location.id, area.id);
  await configureAreaStaffing(db, location.id, area.id, friseurQualificationId);

  const weekStart = isoWeekStartFromShiftDate(input.todayISO);
  const seedDates = openDatesInWeek(weekStart);

  const employees = await db.listPlanningEmployees(input.organizationId);
  const qualIdsByProfile =
    await db.listProfileQualificationIdsByOrganization(input.organizationId);

  const { planned, openSlots, coveredSlots } = planFullyCoveredShifts({
    locationId: location.id,
    areaId: area.id,
    openDates: seedDates,
    weekStart,
    timeZone: input.timeZone,
    employees,
    qualIdsByProfile,
    friseurQualificationId,
    existingShifts: [],
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
    locationCount: 1,
    areaCount: 1,
    shiftCount: planned.length,
    openSlots,
    coveredSlots,
  };
}
