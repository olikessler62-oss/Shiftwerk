import {
  findServiceHourIdForShift,
  serviceWeekdayForShiftDate,
} from "@schichtwerk/database";
import {
  mapAssignmentQualificationIds,
  qualificationRulesForServiceHour,
} from "@/lib/bulk-staffing-header";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type { LocationAreaStaffing } from "@schichtwerk/types";

export function profileQualificationIdSetMap(
  profileQualificationIds: Record<string, string[]>
): Map<string, ReadonlySet<string>> {
  return new Map(
    Object.entries(profileQualificationIds).map(([profileId, qualificationIds]) => [
      profileId,
      new Set(qualificationIds),
    ])
  );
}

/** Tätigkeit pro Schicht — eine Funktion je Zuweisung im Personalbedarf-Fenster. */
export function resolvePlanningShiftJobLabels(input: {
  shifts: readonly PlanningShift[];
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  profileQualificationIds: Record<string, string[]>;
  qualificationNameById: ReadonlyMap<string, string>;
  countryCode?: string;
}): Map<string, string> {
  const result = new Map<string, string>();
  const countryCode = input.countryCode ?? "DE";
  const profileQualificationSets = profileQualificationIdSetMap(
    input.profileQualificationIds
  );

  const groups = new Map<
    string,
    { serviceHourId: string; shifts: PlanningShift[] }
  >();

  for (const shift of input.shifts) {
    const areaId = shift.location_area_id;
    if (!areaId) continue;

    const weekday = serviceWeekdayForShiftDate(countryCode, shift.shift_date);
    const serviceHourId = findServiceHourIdForShift(
      input.serviceHours,
      areaId,
      weekday,
      shift.startTime,
      shift.endTime
    );
    if (!serviceHourId) continue;

    const key = `${areaId}|${shift.shift_date}|${serviceHourId}`;
    const group = groups.get(key);
    if (group) {
      group.shifts.push(shift);
    } else {
      groups.set(key, { serviceHourId, shifts: [shift] });
    }
  }

  for (const { serviceHourId, shifts } of groups.values()) {
    const areaId = shifts[0]?.location_area_id;
    if (!areaId) continue;

    const sortedShifts = [...shifts].sort(
      (a, b) =>
        a.startTime.localeCompare(b.startTime) ||
        a.employee_id.localeCompare(b.employee_id) ||
        a.id.localeCompare(b.id)
    );

    const hourAssignments = sortedShifts.map((shift) => ({
      startTime: shift.startTime,
      endTime: shift.endTime,
      employeeId: shift.employee_id,
    }));

    const qualRules = qualificationRulesForServiceHour(
      input.staffingRules,
      areaId,
      serviceHourId
    );
    const qualByIndex = mapAssignmentQualificationIds(
      hourAssignments,
      qualRules,
      profileQualificationSets
    );

    sortedShifts.forEach((shift, index) => {
      const qualId = qualByIndex.get(index);
      if (!qualId) return;
      const name = input.qualificationNameById.get(qualId)?.trim();
      if (name) result.set(shift.id, name);
    });
  }

  return result;
}
