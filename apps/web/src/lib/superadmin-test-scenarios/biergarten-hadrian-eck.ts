import {
  buildShiftTimestamps,
  employeeMatchesShiftAvailability,
  isEmployeeAbsentOnDate,
  isoWeekStartFromShiftDate,
  isShiftDateInIsoWeek,
  resolveProfileWeeklyHoursTarget,
  shiftAssignWeekdayFromDate,
  shiftDurationHours,
  type SchichtwerkDatabase,
} from "@schichtwerk/database";
import type { AbsenceRequest, Profile, ProfileRecurringAvailability } from "@schichtwerk/types";
import { insertPlannedConfirmedShifts } from "@/lib/superadmin-test-scenarios/insert-planned-confirmed-shifts";
import {
  buildSuperadminTestScenarioShiftSchedule,
  coverageTargetForMixedMode,
  targetShiftCountForMode,
  type SuperadminTestScenarioSeedSettings,
  type SuperadminTestScenarioShiftCoverageMode,
  type SuperadminTestScenarioShiftsPerDayMode,
  type TestScenarioShiftTemplate,
  type TestScenarioShiftWindow,
} from "@/lib/superadmin-test-scenarios/superadmin-test-scenario-settings";

export const BIERGARTEN_HADRIAN_SCENARIO_ORG_NAME = "Giovanni's Gastro";

export type {
  SuperadminTestScenarioShiftCoverageMode as BiergartenHadrianShiftCoverageMode,
  SuperadminTestScenarioShiftsPerDayMode as BiergartenHadrianShiftsPerDayMode,
} from "@/lib/superadmin-test-scenarios/superadmin-test-scenario-settings";


export const BIERGARTEN_HADRIAN_SCENARIO_LOCATION_NAMES = [
  "L'Orangerie",
  "Biergarten",
] as const;

const AREA_NAMES = ["Restaurant", "Küche", "Bar"] as const;

export const BIERGARTEN_HADRIAN_QUALIFICATION_NAMES = [
  "Kellner/in",
  "Barista",
  "Koch/Köchin",
  "Spülkraft",
] as const;

const AREA_QUALIFICATION_NAMES: Record<string, readonly string[]> = {
  restaurant: ["Kellner/in"],
  küche: ["Koch/Köchin", "Spülkraft"],
  bar: ["Barista", "Spülkraft"],
};

const OPEN_WEEKDAYS = [0, 1, 2, 4, 5, 6] as const;

type StaffingQualRule = { qualName: string; count: number };

type StaffingWindowRule = {
  start: string;
  end: string;
  qualifications: readonly StaffingQualRule[];
};

type ShiftWindow = TestScenarioShiftWindow;

type ShiftTemplateDef = TestScenarioShiftTemplate;

export type BiergartenHadrianShiftScenarioConfig = {
  shiftsPerDayMode: SuperadminTestScenarioShiftsPerDayMode;
  serviceWindows: readonly ShiftWindow[];
  shiftTemplates: readonly ShiftTemplateDef[];
  staffingByAreaKey: Record<string, () => readonly StaffingWindowRule[]>;
};

export function buildBiergartenHadrianShiftConfig(
  settings: Pick<SuperadminTestScenarioSeedSettings, "shiftsPerDayMode" | "shifts">
): BiergartenHadrianShiftScenarioConfig {
  const schedule = buildSuperadminTestScenarioShiftSchedule(settings);
  const { shiftsPerDayMode, serviceWindows, shiftTemplates } = schedule;

  if (shiftsPerDayMode === "one") {
    const window = serviceWindows[0]!;
    return {
      shiftsPerDayMode,
      serviceWindows,
      shiftTemplates,
      staffingByAreaKey: {
        restaurant: () => [
          {
            start: window.start,
            end: window.end,
            qualifications: [{ qualName: "Kellner/in", count: 2 }],
          },
        ],
        küche: () => [
          {
            start: window.start,
            end: window.end,
            qualifications: [{ qualName: "Koch/Köchin", count: 1 }],
          },
        ],
        bar: () => [
          {
            start: window.start,
            end: window.end,
            qualifications: [
              { qualName: "Barista", count: 1 },
              { qualName: "Spülkraft", count: 1 },
            ],
          },
        ],
      },
    };
  }

  if (shiftsPerDayMode === "two") {
    const earlyWindow = serviceWindows[0]!;
    const lateWindow = serviceWindows[1]!;
    return {
      shiftsPerDayMode,
      serviceWindows,
      shiftTemplates,
      staffingByAreaKey: {
        restaurant: () =>
          serviceWindows.map((window) => ({
            start: window.start,
            end: window.end,
            qualifications: [{ qualName: "Kellner/in", count: 2 }],
          })),
        küche: () => [
          {
            start: earlyWindow.start,
            end: earlyWindow.end,
            qualifications: [{ qualName: "Koch/Köchin", count: 1 }],
          },
          {
            start: lateWindow.start,
            end: lateWindow.end,
            qualifications: [
              { qualName: "Koch/Köchin", count: 1 },
              { qualName: "Spülkraft", count: 1 },
            ],
          },
        ],
        bar: () =>
          serviceWindows.map((window) => ({
            start: window.start,
            end: window.end,
            qualifications: [
              { qualName: "Barista", count: 1 },
              { qualName: "Spülkraft", count: 1 },
            ],
          })),
      },
    };
  }

  const earlyWindow = serviceWindows[0]!;
  const midWindow = serviceWindows[1]!;
  const lateWindow = serviceWindows[2]!;
  return {
    shiftsPerDayMode,
    serviceWindows,
    shiftTemplates,
    staffingByAreaKey: {
      restaurant: () =>
        serviceWindows.map((window) => ({
          start: window.start,
          end: window.end,
          qualifications: [{ qualName: "Kellner/in", count: 2 }],
        })),
      küche: () => [
        {
          start: earlyWindow.start,
          end: earlyWindow.end,
          qualifications: [{ qualName: "Koch/Köchin", count: 1 }],
        },
        {
          start: midWindow.start,
          end: midWindow.end,
          qualifications: [
            { qualName: "Koch/Köchin", count: 1 },
            { qualName: "Spülkraft", count: 1 },
          ],
        },
        {
          start: lateWindow.start,
          end: lateWindow.end,
          qualifications: [
            { qualName: "Koch/Köchin", count: 1 },
            { qualName: "Spülkraft", count: 1 },
          ],
        },
      ],
      bar: () =>
        serviceWindows.map((window) => ({
          start: window.start,
          end: window.end,
          qualifications: [
            { qualName: "Barista", count: 1 },
            { qualName: "Spülkraft", count: 1 },
          ],
        })),
    },
  };
}

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
  return coverageTargetForMixedMode(requiredCount, seed);
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

function employeeEligibleForScenarioShift(input: {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  availability: readonly ProfileRecurringAvailability[];
  absences: readonly AbsenceRequest[];
}): boolean {
  if (isEmployeeAbsentOnDate(input.employeeId, input.absences, input.shiftDate)) {
    return false;
  }

  const employeeSlots = input.availability.filter(
    (slot) => slot.profile_id === input.employeeId
  );
  if (employeeSlots.length === 0) {
    return true;
  }

  return employeeMatchesShiftAvailability(
    input.employeeId,
    input.availability,
    shiftAssignWeekdayFromDate(input.shiftDate),
    input.startTime,
    input.endTime
  );
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
  availability: readonly ProfileRecurringAvailability[];
  absences: readonly AbsenceRequest[];
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

  if (
    !employeeEligibleForScenarioShift({
      employeeId: input.employee.id,
      shiftDate: input.shiftDate,
      startTime: input.startTime,
      endTime: input.endTime,
      availability: input.availability,
      absences: input.absences,
    })
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

async function createScenarioLocation(
  db: SchichtwerkDatabase,
  organizationId: string,
  name: string
): Promise<{ id: string; name: string }> {
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
  areaId: string,
  serviceWindows: readonly ShiftWindow[]
) {
  const rows = OPEN_WEEKDAYS.flatMap((weekday) =>
    serviceWindows.map((window) => ({
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
  areaId: string,
  shiftTemplates: readonly ShiftTemplateDef[]
) {
  await db.clearAreaShiftTemplatesForArea(areaId, locationId);
  for (const [index, template] of shiftTemplates.entries()) {
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
  staffingByAreaKey: BiergartenHadrianShiftScenarioConfig["staffingByAreaKey"]
) {
  const ruleFactory = staffingByAreaKey[areaKey(areaName)];
  if (!ruleFactory) {
    throw new Error(`Kein Personalbedarf für Bereich „${areaName}“ definiert`);
  }
  const rules = ruleFactory();

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

async function configureAreaQualificationTemplates(
  db: SchichtwerkDatabase,
  organizationId: string,
  locationId: string,
  areaId: string,
  areaName: string,
  qualificationIdsByName: Map<string, string>
) {
  const qualNames = AREA_QUALIFICATION_NAMES[areaKey(areaName)] ?? [];
  const templates = await db.listAreaQualificationTemplatesForArea(
    areaId,
    locationId
  );
  for (const template of templates) {
    await db.removeAreaQualificationTemplate(areaId, locationId, template.id);
  }
  for (const qualName of qualNames) {
    const qualificationId = qualificationIdsByName.get(qualName);
    if (!qualificationId) {
      throw new Error(`Qualifikation „${qualName}“ nicht gefunden`);
    }
    await db.assignAreaQualificationTemplate(
      organizationId,
      areaId,
      locationId,
      qualificationId
    );
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
  shiftConfig: BiergartenHadrianShiftScenarioConfig;
  locations: readonly { id: string; areas: readonly { id: string; name: string }[] }[];
  openDates: readonly string[];
  weekStart: string;
  timeZone: string;
  employees: readonly Profile[];
  qualIdsByProfile: Map<string, string[]>;
  qualificationIdsByName: Map<string, string>;
  existingShifts: readonly ExistingShiftRef[];
  priorPlannedShifts?: readonly PlannedShift[];
  availability: readonly ProfileRecurringAvailability[];
  absences: readonly AbsenceRequest[];
}): { planned: PlannedShift[]; openSlots: number; coveredSlots: number } {
  const planned: PlannedShift[] = [];
  const priorPlanned = input.priorPlannedShifts ?? [];
  let openSlots = 0;
  let coveredSlots = 0;

  for (const location of input.locations) {
    for (const area of location.areas) {
      const ruleFactory = input.shiftConfig.staffingByAreaKey[areaKey(area.name)];
      const staffingRules = ruleFactory ? ruleFactory() : [];

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
              [...priorPlanned, ...planned]
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
                  plannedShifts: [...priorPlanned, ...planned],
                  availability: input.availability,
                  absences: input.absences,
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
  shiftConfig: BiergartenHadrianShiftScenarioConfig;
  locations: readonly { id: string; areas: readonly { id: string; name: string }[] }[];
  openDates: readonly string[];
  weekStart: string;
  timeZone: string;
  employees: readonly Profile[];
  qualIdsByProfile: Map<string, string[]>;
  qualificationIdsByName: Map<string, string>;
  existingShifts: readonly ExistingShiftRef[];
  priorPlannedShifts?: readonly PlannedShift[];
  availability: readonly ProfileRecurringAvailability[];
  absences: readonly AbsenceRequest[];
}): { planned: PlannedShift[]; openSlots: number; coveredSlots: number } {
  const planned: PlannedShift[] = [];
  const priorPlanned = input.priorPlannedShifts ?? [];
  let openSlots = 0;
  let coveredSlots = 0;

  for (const location of input.locations) {
    for (const area of location.areas) {
      const ruleFactory = input.shiftConfig.staffingByAreaKey[areaKey(area.name)];
      const staffingRules = ruleFactory ? ruleFactory() : [];

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
              [...priorPlanned, ...planned]
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
                  plannedShifts: [...priorPlanned, ...planned],
                  availability: input.availability,
                  absences: input.absences,
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

function scaleStaffingCountsInConfig(
  config: BiergartenHadrianShiftScenarioConfig,
  scale: number
): BiergartenHadrianShiftScenarioConfig {
  if (scale === 1) return config;

  const scaleRules = (rules: readonly StaffingWindowRule[]): StaffingWindowRule[] =>
    rules.map((rule) => ({
      ...rule,
      qualifications: rule.qualifications.map((qualRule) => ({
        ...qualRule,
        count: Math.max(1, Math.round(qualRule.count * scale)),
      })),
    }));

  const staffingByAreaKey: BiergartenHadrianShiftScenarioConfig["staffingByAreaKey"] = {};
  for (const key of Object.keys(config.staffingByAreaKey)) {
    const factory = config.staffingByAreaKey[key]!;
    staffingByAreaKey[key] = () => scaleRules(factory());
  }

  return { ...config, staffingByAreaKey };
}

function scaleShiftConfigToWeeklyTarget(
  config: BiergartenHadrianShiftScenarioConfig,
  locations: readonly { id: string; areas: readonly { id: string; name: string }[] }[],
  openDates: readonly string[],
  qualificationIdsByName: Map<string, string>,
  targetPerWeek: number
): BiergartenHadrianShiftScenarioConfig {
  const current = countStaffingDemandSlots({
    shiftConfig: config,
    locations,
    openDates,
    qualificationIdsByName,
  });
  if (current <= 0 || current === targetPerWeek) return config;
  return scaleStaffingCountsInConfig(config, targetPerWeek / current);
}

function countStaffingDemandSlots(input: {
  shiftConfig: BiergartenHadrianShiftScenarioConfig;
  locations: readonly { id: string; areas: readonly { id: string; name: string }[] }[];
  openDates: readonly string[];
  qualificationIdsByName: Map<string, string>;
}): number {
  let total = 0;

  for (const location of input.locations) {
    for (const area of location.areas) {
      const ruleFactory = input.shiftConfig.staffingByAreaKey[areaKey(area.name)];
      const staffingRules = ruleFactory ? ruleFactory() : [];

      for (const date of input.openDates) {
        for (const rule of staffingRules) {
          for (const qualRule of rule.qualifications) {
            if (!input.qualificationIdsByName.has(qualRule.qualName)) continue;
            total += qualRule.count;
          }
        }
      }
    }
  }

  return total;
}

type ShiftPlanningContext = {
  shiftConfig: BiergartenHadrianShiftScenarioConfig;
  locations: readonly { id: string; areas: readonly { id: string; name: string }[] }[];
  weekStart: string;
  timeZone: string;
  employees: readonly Profile[];
  qualIdsByProfile: Map<string, string[]>;
  qualificationIdsByName: Map<string, string>;
  existingShifts: readonly ExistingShiftRef[];
  plannedShifts: PlannedShift[];
  availability: readonly ProfileRecurringAvailability[];
  absences: readonly AbsenceRequest[];
};

function planShiftsForWeek(
  mode: SuperadminTestScenarioShiftCoverageMode,
  context: ShiftPlanningContext
): { planned: PlannedShift[]; openSlots: number; coveredSlots: number } {
  const openDates = openDatesInWeek(context.weekStart);

  if (mode === "open") {
    return {
      planned: [],
      openSlots: countStaffingDemandSlots({
        shiftConfig: context.shiftConfig,
        locations: context.locations,
        openDates,
        qualificationIdsByName: context.qualificationIdsByName,
      }),
      coveredSlots: 0,
    };
  }

  const plannerInput = {
    shiftConfig: context.shiftConfig,
    locations: context.locations,
    openDates,
    weekStart: context.weekStart,
    timeZone: context.timeZone,
    employees: context.employees,
    qualIdsByProfile: context.qualIdsByProfile,
    qualificationIdsByName: context.qualificationIdsByName,
    existingShifts: context.existingShifts,
    priorPlannedShifts: context.plannedShifts,
    availability: context.availability,
    absences: context.absences,
  };

  if (mode === "covered") {
    return planFullyCoveredShifts(plannerInput);
  }

  return planRandomShifts(plannerInput);
}

function planShiftsForTwoWeeks(
  mode: SuperadminTestScenarioShiftCoverageMode,
  weekStart: string,
  context: Omit<ShiftPlanningContext, "weekStart" | "plannedShifts">
): { planned: PlannedShift[]; openSlots: number; coveredSlots: number } {
  const weekStarts = [weekStart, addDaysISO(weekStart, 7)];
  const planned: PlannedShift[] = [];
  let openSlots = 0;
  let coveredSlots = 0;

  for (const currentWeekStart of weekStarts) {
    const result = planShiftsForWeek(mode, {
      ...context,
      weekStart: currentWeekStart,
      plannedShifts: planned,
    });
    planned.push(...result.planned);
    openSlots += result.openSlots;
    coveredSlots += result.coveredSlots;
  }

  return { planned, openSlots, coveredSlots };
}

async function configureBiergartenHadrianLocations(
  db: SchichtwerkDatabase,
  organizationId: string,
  qualificationIdsByName: Map<string, string>,
  shiftConfig: BiergartenHadrianShiftScenarioConfig
): Promise<{ id: string; areas: { id: string; name: string }[] }[]> {
  const configuredLocations: {
    id: string;
    areas: { id: string; name: string }[];
  }[] = [];

  for (const locationName of BIERGARTEN_HADRIAN_SCENARIO_LOCATION_NAMES) {
    const location = await createScenarioLocation(db, organizationId, locationName);
    const areas = await ensureAreas(db, location.id);

    for (const area of areas) {
      await configureAreaQualificationTemplates(
        db,
        organizationId,
        location.id,
        area.id,
        area.name,
        qualificationIdsByName
      );
      await configureAreaServiceHours(
        db,
        location.id,
        area.id,
        shiftConfig.serviceWindows
      );
      await configureAreaShiftTemplates(
        db,
        location.id,
        area.id,
        shiftConfig.shiftTemplates
      );
      await configureAreaStaffing(
        db,
        location.id,
        area.id,
        area.name,
        qualificationIdsByName,
        shiftConfig.staffingByAreaKey
      );
    }

    configuredLocations.push({ id: location.id, areas });
  }

  return configuredLocations;
}

function partitionEmployeesIntoFourGroups(
  employees: readonly Profile[]
): Profile[][] {
  const sorted = [...employees].sort((a, b) => a.id.localeCompare(b.id));
  const groupCount = BIERGARTEN_HADRIAN_QUALIFICATION_NAMES.length;
  const baseSize = Math.floor(sorted.length / groupCount);
  const remainder = sorted.length % groupCount;
  const groups: Profile[][] = [];
  let index = 0;

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const size = baseSize + (groupIndex < remainder ? 1 : 0);
    groups.push(sorted.slice(index, index + size));
    index += size;
  }

  return groups;
}

async function assignEmployeeQualificationGroups(
  db: SchichtwerkDatabase,
  organizationId: string,
  qualificationIdsByName: Map<string, string>
) {
  const employees = await db.listPlanningEmployees(organizationId);
  const groups = partitionEmployeesIntoFourGroups(employees);

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const qualName = BIERGARTEN_HADRIAN_QUALIFICATION_NAMES[groupIndex];
    const qualificationId = qualificationIdsByName.get(qualName);
    if (!qualificationId) {
      throw new Error(`Qualifikation „${qualName}“ nicht gefunden`);
    }

    for (const employee of groups[groupIndex]) {
      await db.assignProfileQualification(
        organizationId,
        employee.id,
        qualificationId
      );
    }
  }
}

async function prepareBiergartenHadrianQualifications(
  db: SchichtwerkDatabase,
  organizationId: string
): Promise<Map<string, string>> {
  await db.resetOrganizationQualifications(organizationId);

  const qualificationIdsByName = new Map<string, string>();
  for (const [index, qualName] of BIERGARTEN_HADRIAN_QUALIFICATION_NAMES.entries()) {
    const created = await db.insertQualification({
      organization_id: organizationId,
      name: qualName,
      sort_order: index,
    });
    qualificationIdsByName.set(qualName, created.id);
  }

  await assignEmployeeQualificationGroups(
    db,
    organizationId,
    qualificationIdsByName
  );

  return qualificationIdsByName;
}

export async function runBiergartenHadrianEckScenario(
  db: SchichtwerkDatabase,
  input: {
    organizationId: string;
    actorId: string;
    timeZone: string;
    todayISO: string;
    settings: Pick<SuperadminTestScenarioSeedSettings, "shiftCoverageMode" | "shiftsPerDayMode" | "shifts">;
  }
): Promise<BiergartenHadrianScenarioResult> {
  await db.prepareBiergartenHadrianScenario(input.organizationId);

  const qualificationIdsByName = await prepareBiergartenHadrianQualifications(
    db,
    input.organizationId
  );

  const weekStart = isoWeekStartFromShiftDate(input.todayISO);
  const mockLocations = BIERGARTEN_HADRIAN_SCENARIO_LOCATION_NAMES.map((_, locationIndex) => ({
    id: `mock-location-${locationIndex}`,
    areas: AREA_NAMES.map((areaName, areaIndex) => ({
      id: `mock-area-${locationIndex}-${areaIndex}`,
      name: areaName,
    })),
  }));

  const shiftConfig = scaleShiftConfigToWeeklyTarget(
    buildBiergartenHadrianShiftConfig(input.settings),
    mockLocations,
    openDatesInWeek(weekStart),
    qualificationIdsByName,
    targetShiftCountForMode(input.settings.shiftsPerDayMode)
  );

  const configuredLocations = await configureBiergartenHadrianLocations(
    db,
    input.organizationId,
    qualificationIdsByName,
    shiftConfig
  );

  const employees = await db.listPlanningEmployees(input.organizationId);
  if (employees.length === 0) {
    throw new Error("Keine planbaren Mitarbeitenden in der Organisation");
  }

  const qualIdsByProfile =
    await db.listProfileQualificationIdsByOrganization(input.organizationId);
  const [availability, absences] = await Promise.all([
    db.listOrganizationRecurringAvailability(input.organizationId),
    db.listOrganizationAbsences(input.organizationId, {
      statuses: ["approved"],
    }),
  ]);

  const { planned, openSlots, coveredSlots } = planShiftsForTwoWeeks(
    input.settings.shiftCoverageMode,
    weekStart,
    {
      shiftConfig,
      locations: configuredLocations,
      timeZone: input.timeZone,
      employees,
      qualIdsByProfile,
      qualificationIdsByName,
      existingShifts: [],
      availability,
      absences,
    }
  );

  await insertPlannedConfirmedShifts(
    db,
    input.organizationId,
    input.actorId,
    input.timeZone,
    planned
  );

  if (input.settings.shiftCoverageMode !== "open" && planned.length === 0) {
    throw new Error(
      "Keine Schichten geplant — planbare Mitarbeitende mit passenden Qualifikationen und Verfügbarkeit prüfen."
    );
  }

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
