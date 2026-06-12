import {
  evaluateShiftStaffingQualification,
  findServiceHourIdForShift,
  serviceWeekdayForShiftDate,
  staffingQualificationIdsForServiceHour,
} from "@schichtwerk/database";
import type { LocationAreaStaffing, Qualification } from "@schichtwerk/types";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import {
  buildDemandWindowsForAreaDay,
  resolveBestDemandServiceHourForAssignment,
} from "@/lib/bulk-staffing-header";
import {
  tagAreaHeaderStaffingEntries,
  type AreaServiceHourRef,
} from "@/lib/location-staffing-client";

export type QualificationAmpel = "neutral" | "ok" | "missing";

export type StaffingQualificationOption = {
  id: string;
  name: string;
};

export function areaStaffingQualificationOptions(
  staffingRules: readonly LocationAreaStaffing[],
  areaId: string,
  qualifications: readonly Qualification[]
): StaffingQualificationOption[] {
  const ids = new Set<string>();
  for (const rule of staffingRules) {
    if (rule.location_area_id !== areaId) continue;
    if (rule.required_count > 0) ids.add(rule.qualification_id);
  }

  return qualifications
    .filter((qualification) => ids.has(qualification.id))
    .slice()
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.name.localeCompare(b.name, "de")
    )
    .map((qualification) => ({
      id: qualification.id,
      name: qualification.name,
    }));
}

export function filterEmployeesByQualification<
  T extends { id: string },
>(
  employees: readonly T[],
  qualificationId: string,
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>
): T[] {
  if (!qualificationId) return [...employees];
  return employees.filter((employee) =>
    profileQualificationIds.get(employee.id)?.has(qualificationId)
  );
}

/** Personal mit mindestens einer für den Bereich relevanten Funktion. */
export function filterEmployeesWithAnyAreaQualification<
  T extends { id: string },
>(
  employees: readonly T[],
  areaQualificationIds: ReadonlySet<string>,
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>
): T[] {
  return filterEmployeesWithAnyQualificationInSet(
    employees,
    areaQualificationIds,
    profileQualificationIds
  );
}

/** Personal mit mindestens einer Funktion aus der angegebenen Menge. */
export function filterEmployeesWithAnyQualificationInSet<
  T extends { id: string },
>(
  employees: readonly T[],
  qualificationIds: ReadonlySet<string>,
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>
): T[] {
  if (!qualificationIds.size) return [...employees];
  return employees.filter((employee) => {
    const ids = profileQualificationIds.get(employee.id);
    if (!ids?.size) return false;
    for (const qualId of qualificationIds) {
      if (ids.has(qualId)) return true;
    }
    return false;
  });
}

export { staffingQualificationIdsForServiceHour };

/** Funktionen, die für den Personalbedarf im angegebenen Zeitfenster benötigt werden. */
export function staffingQualificationIdsForDemand(
  staffingRules: readonly LocationAreaStaffing[],
  areaId: string,
  serviceHours: readonly AreaServiceHourRef[],
  countryCode: string,
  dateISO: string,
  startTime: string,
  endTime: string
): Set<string> {
  const weekday = serviceWeekdayForShiftDate(countryCode, dateISO);
  const serviceHourId = findServiceHourIdForShift(
    serviceHours,
    areaId,
    weekday,
    startTime,
    endTime
  );
  return staffingQualificationIdsForServiceHour(
    staffingRules,
    areaId,
    serviceHourId
  );
}

/** Bedarf-Funktionen für eine konkrete Zuweisung (bestes Personalbedarf-Fenster). */
export function staffingQualificationIdsForAssignment(
  staffingRules: readonly LocationAreaStaffing[],
  areaId: string,
  serviceHours: readonly AreaServiceHourRef[],
  assignmentPresets: readonly DashboardAssignmentPreset[],
  dateISO: string,
  startTime: string,
  endTime: string
): Set<string> {
  const baseEntries = tagAreaHeaderStaffingEntries(
    [...staffingRules],
    areaId,
    dateISO,
    [...serviceHours],
    []
  );
  const demandWindows = buildDemandWindowsForAreaDay(
    baseEntries,
    serviceHours,
    assignmentPresets,
    staffingRules,
    areaId
  );
  const serviceHourId = resolveBestDemandServiceHourForAssignment(
    startTime,
    endTime,
    demandWindows
  );
  if (!serviceHourId) {
    return staffingQualificationIdsForServiceHour(staffingRules, areaId, null);
  }
  return staffingQualificationIdsForServiceHour(
    staffingRules,
    areaId,
    serviceHourId
  );
}

export function employeeAreaQualificationOptions(
  employeeId: string,
  areaQualifications: readonly StaffingQualificationOption[],
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>,
  emptyEmployeeId: string
): StaffingQualificationOption[] {
  if (!employeeId || employeeId === emptyEmployeeId) return [];
  const ids = profileQualificationIds.get(employeeId);
  if (!ids?.size) return [];
  return areaQualifications.filter((option) => ids.has(option.id));
}

/** Eine passende Funktion vorauswählen; bei mehreren Optionen leer lassen. */
export function resolvePresetQualificationForEmployee(
  employeeId: string,
  areaQualifications: readonly StaffingQualificationOption[],
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>,
  emptyEmployeeId: string,
  currentQualificationId = ""
): string {
  const options = employeeAreaQualificationOptions(
    employeeId,
    areaQualifications,
    profileQualificationIds,
    emptyEmployeeId
  );
  if (options.length === 1) return options[0]!.id;
  if (
    currentQualificationId &&
    options.some((option) => option.id === currentQualificationId)
  ) {
    return currentQualificationId;
  }
  return "";
}

export function presetQualificationForServiceHour(
  staffingRules: readonly LocationAreaStaffing[],
  areaId: string,
  serviceHourId: string | null | undefined
): string {
  if (!serviceHourId) return "";
  const rule = staffingRules.find(
    (entry) =>
      entry.location_area_id === areaId &&
      entry.service_hour_id === serviceHourId &&
      entry.required_count > 0
  );
  return rule?.qualification_id ?? "";
}

export function evaluateBulkRowQualification(input: {
  areaId: string;
  dateISO: string;
  startTime: string;
  endTime: string;
  employeeId: string;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  employeeQualificationIds: ReadonlySet<string>;
  qualificationNameById: ReadonlyMap<string, string>;
  countryCode?: string;
}): { status: QualificationAmpel; missingNames: string[] } {
  const result = evaluateShiftStaffingQualification({
    areaId: input.areaId,
    countryCode: input.countryCode ?? "DE",
    shiftDate: input.dateISO,
    startTime: input.startTime,
    endTime: input.endTime,
    employeeId: input.employeeId,
    serviceHours: input.serviceHours,
    staffingRules: input.staffingRules,
    employeeQualificationIds: input.employeeQualificationIds,
    qualificationNameById: input.qualificationNameById,
  });
  return { status: result.status, missingNames: result.missingNames };
}

/** @deprecated Use serviceWeekdayForShiftDate from @/lib/service-hours-shift-validation */
export function serviceWeekdayForDate(isoDate: string): number {
  return serviceWeekdayForShiftDate("DE", isoDate);
}
