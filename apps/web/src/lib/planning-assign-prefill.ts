import type { DashboardShiftAssignEmployee } from "@/app/actions/dashboard-shift-assign";
import {
  areDashboardShiftTimesComplete,
  employeeMatchesDashboardShiftWindow,
  filterEmployeesNotAbsentOnDate,
  profileAvailabilityWeekdayFromDashboardDate,
} from "@/lib/available-employees-for-shift";
import {
  filterEmployeesWithAnyAreaQualification,
  filterEmployeesWithAnyQualificationInSet,
  presetQualificationForServiceHour,
} from "@/lib/bulk-shift-qualification";
import {
  personalbedarfDemandTimesForEntry,
  personalbedarfTimesForServiceHour,
} from "@/lib/bulk-shift-staffing";
import {
  resolvePresetShiftTemplateForDemandTimes,
  type DashboardAssignmentPreset,
} from "@/lib/dashboard-assignment-presets";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import {
  employeeHasRecurringAvailabilityOnWeekday,
  staffingQualificationIdsForServiceHour,
} from "@schichtwerk/database";
import type {
  AbsenceRequest,
  LocationAreaStaffing,
  Profile,
  ProfileRecurringAvailability,
} from "@schichtwerk/types";

export type PlanningAssignPrefill = {
  presetId: string;
  startTime: string;
  endTime: string;
  qualificationId: string;
};

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

function sortOpenStaffingEntriesChronologically(
  staffingEntries: readonly TagAreaHeaderStaffingEntry[],
  serviceHours: readonly AreaServiceHourRef[]
): TagAreaHeaderStaffingEntry[] {
  return [...staffingEntries]
    .filter((entry) => entry.assigned < entry.required)
    .sort((a, b) => {
      const startA =
        personalbedarfTimesForServiceHour(serviceHours, a.serviceHourId)?.startTime ??
        "99:99";
      const startB =
        personalbedarfTimesForServiceHour(serviceHours, b.serviceHourId)?.startTime ??
        "99:99";
      return startA.localeCompare(startB) || a.serviceHourId.localeCompare(b.serviceHourId);
    });
}

function employeeMatchesDemandQualification(
  employeeId: string,
  serviceHourId: string,
  areaId: string,
  staffingRules: readonly LocationAreaStaffing[],
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>,
  areaQualificationIds: ReadonlySet<string>
): boolean {
  const stub = [{ id: employeeId }] as const;
  const demandQualificationIds = staffingQualificationIdsForServiceHour(
    staffingRules,
    areaId,
    serviceHourId
  );

  if (demandQualificationIds.size > 0) {
    return filterEmployeesWithAnyQualificationInSet(
      stub,
      demandQualificationIds,
      profileQualificationIds
    ).length > 0;
  }

  return filterEmployeesWithAnyAreaQualification(
    stub,
    areaQualificationIds,
    profileQualificationIds
  ).length > 0;
}

function employeeEligibleForPlanningDemand(
  employee: Pick<Profile, "id">,
  dateISO: string,
  startTime: string,
  endTime: string,
  recurringAvailability: readonly ProfileRecurringAvailability[],
  absences: readonly AbsenceRequest[]
): boolean {
  if (
    filterEmployeesNotAbsentOnDate([employee as Profile], absences, dateISO).length === 0
  ) {
    return false;
  }

  const weekday = profileAvailabilityWeekdayFromDashboardDate(dateISO);
  if (
    !employeeHasRecurringAvailabilityOnWeekday(
      employee.id,
      recurringAvailability,
      weekday
    )
  ) {
    return false;
  }

  return employeeMatchesDashboardShiftWindow(
    employee.id,
    recurringAvailability,
    weekday,
    startTime,
    endTime
  );
}

/**
 * Erste chronologisch offene Bedarfszeit, die für den Mitarbeiter passt
 * (Abwesenheit, Verfügbarkeit, Qualifikation).
 */
export function resolvePlanningAssignPrefillFromOpenDemand(input: {
  employeeId: string;
  dateISO: string;
  areaId: string;
  staffingEntries: readonly TagAreaHeaderStaffingEntry[];
  serviceHours: readonly AreaServiceHourRef[];
  assignmentPresets: readonly DashboardAssignmentPreset[];
  staffingRules: readonly LocationAreaStaffing[];
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
  recurringAvailability: readonly ProfileRecurringAvailability[];
  absences: readonly AbsenceRequest[];
  employees: readonly Pick<Profile, "id">[];
}): PlanningAssignPrefill | null {
  const employee = input.employees.find((entry) => entry.id === input.employeeId);
  if (!employee) return null;

  const openEntries = sortOpenStaffingEntriesChronologically(
    input.staffingEntries,
    input.serviceHours
  );
  if (openEntries.length === 0) return null;

  const areaQualificationIds = new Set(
    input.staffingRules
      .filter(
        (rule) =>
          rule.location_area_id === input.areaId && rule.required_count > 0
      )
      .map((rule) => rule.qualification_id)
  );

  for (const entry of openEntries) {
    const demand = personalbedarfDemandTimesForEntry(
      entry.serviceHourId,
      input.serviceHours,
      input.assignmentPresets,
      input.staffingRules,
      input.areaId
    );
    if (!demand || !areDashboardShiftTimesComplete(demand.startTime, demand.endTime)) {
      continue;
    }

    if (
      !employeeEligibleForPlanningDemand(
        employee,
        input.dateISO,
        demand.startTime,
        demand.endTime,
        input.recurringAvailability,
        input.absences
      )
    ) {
      continue;
    }

    if (
      !employeeMatchesDemandQualification(
        input.employeeId,
        demand.serviceHourId,
        input.areaId,
        input.staffingRules,
        input.profileQualificationIds,
        areaQualificationIds
      )
    ) {
      continue;
    }

    const presetId = resolvePresetShiftTemplateForDemandTimes(
      demand.startTime,
      demand.endTime,
      input.assignmentPresets
    );

    let startTime = demand.startTime;
    let endTime = demand.endTime;
    if (presetId) {
      const preset = input.assignmentPresets.find((item) => item.id === presetId);
      if (preset) {
        startTime = timeFieldValue(preset.start_time);
        endTime = timeFieldValue(preset.end_time);
      }
    }

    const qualificationId =
      presetQualificationForServiceHour(
        input.staffingRules,
        input.areaId,
        demand.serviceHourId
      ) || "";

    return {
      presetId,
      startTime,
      endTime,
      qualificationId,
    };
  }

  return null;
}

/** Typ-Hilfe für Tests mit vollständigen Mitarbeiterdaten. */
export type PlanningAssignPrefillEmployee = Pick<
  DashboardShiftAssignEmployee,
  "id" | "full_name"
>;
