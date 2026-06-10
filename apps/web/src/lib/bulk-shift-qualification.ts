import {
  findServiceHourIdForShift,
  serviceWeekdayForDate,
  type AreaServiceHourRef,
} from "@/lib/location-staffing-client";
import type { LocationAreaStaffing, Qualification } from "@schichtwerk/types";

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
}): { status: QualificationAmpel; missingNames: string[] } {
  const {
    areaId,
    dateISO,
    startTime,
    endTime,
    employeeId,
    serviceHours,
    staffingRules,
    employeeQualificationIds,
    qualificationNameById,
  } = input;

  if (!employeeId || !startTime || !endTime) {
    return { status: "neutral", missingNames: [] };
  }

  const serviceHourId = findServiceHourIdForShift(
    [...serviceHours],
    areaId,
    dateISO,
    startTime,
    endTime
  );
  if (!serviceHourId) {
    return { status: "neutral", missingNames: [] };
  }

  const requiredQualIds = staffingRules
    .filter(
      (rule) =>
        rule.location_area_id === areaId &&
        rule.service_hour_id === serviceHourId &&
        rule.required_count > 0
    )
    .map((rule) => rule.qualification_id);

  if (!requiredQualIds.length) {
    return { status: "neutral", missingNames: [] };
  }

  const hasMatch = requiredQualIds.some((id) =>
    employeeQualificationIds.has(id)
  );
  if (hasMatch) {
    return { status: "ok", missingNames: [] };
  }

  const missingNames = requiredQualIds.map(
    (id) => qualificationNameById.get(id) ?? id
  );
  return { status: "missing", missingNames };
}

/** @deprecated Nur für Tests – Wochentag bleibt für Servicezeiten relevant. */
export { serviceWeekdayForDate };
