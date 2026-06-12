import type {
  AbsenceRequest,
  LocationAreaStaffing,
  PlanningMode,
  ProfileRecurringAvailability,
} from "@schichtwerk/types";
import { getOrgFeaturesFromPlanningMode } from "./org-features";
import type { AreaServiceHourRef } from "./location-service-hours";
import { serviceWeekdayForShiftDate } from "./shift-service-hours";
import { validateStaffingWeekdayForCountry } from "./labor-compliance-validation";
import {
  validateEmployeeNotAbsentOnDate,
  validateEmployeeShiftAvailability,
} from "./shift-assign-eligibility";
import { evaluateShiftStaffingQualification } from "./shift-staffing-qualification";
import { validateShiftServiceHoursForArea } from "./shift-service-hours";

export type ShiftAssignEligibilityContext = {
  countryCode: string;
  recurringAvailability: ProfileRecurringAvailability[];
  absences: AbsenceRequest[];
  staffingRules?: LocationAreaStaffing[];
  serviceHours?: AreaServiceHourRef[];
  profileQualificationIds?: Map<string, Set<string>>;
  qualificationNameById?: Map<string, string>;
};

export type ShiftAssignEligibilityInput = {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  locationAreaId: string | null;
};

function mergeWarnings(...groups: (string[] | undefined)[]): string[] | undefined {
  const merged = groups.flatMap((group) => group ?? []);
  return merged.length ? merged : undefined;
}

export function mergeShiftAssignWarnings(
  ...groups: (string[] | undefined)[]
): string[] | undefined {
  return mergeWarnings(...groups);
}

export function validateShiftAssignEligibility(
  planningMode: PlanningMode,
  ctx: ShiftAssignEligibilityContext,
  input: ShiftAssignEligibilityInput
): { ok: true; warnings?: string[] } | { ok: false; error: string } {
  const absenceCheck = validateEmployeeNotAbsentOnDate(
    input.employeeId,
    ctx.absences,
    input.shiftDate
  );
  if (!absenceCheck.ok) return absenceCheck;

  const weekday = serviceWeekdayForShiftDate(ctx.countryCode, input.shiftDate);
  const availabilityCheck = validateEmployeeShiftAvailability(
    input.employeeId,
    ctx.recurringAvailability,
    weekday,
    input.startTime,
    input.endTime
  );
  if (!availabilityCheck.ok) return availabilityCheck;

  const orgFeatures = getOrgFeaturesFromPlanningMode(planningMode);
  if (!orgFeatures.qualifications || !input.locationAreaId) {
    return { ok: true };
  }

  const serviceHours = ctx.serviceHours ?? [];
  const staffingRules = ctx.staffingRules ?? [];
  const profileQualificationIds = ctx.profileQualificationIds ?? new Map();
  const qualificationNameById = ctx.qualificationNameById ?? new Map();

  if (orgFeatures.serviceHours) {
    const serviceHoursCheck = validateShiftServiceHoursForArea(
      serviceHours,
      input.locationAreaId,
      ctx.countryCode,
      input.shiftDate,
      input.startTime,
      input.endTime
    );
    if (!serviceHoursCheck.ok) return serviceHoursCheck;
  }

  const employeeQualificationIds =
    profileQualificationIds.get(input.employeeId) ?? new Set<string>();
  const qualificationCheck = evaluateShiftStaffingQualification({
    areaId: input.locationAreaId,
    countryCode: ctx.countryCode,
    shiftDate: input.shiftDate,
    startTime: input.startTime,
    endTime: input.endTime,
    employeeId: input.employeeId,
    serviceHours,
    staffingRules,
    employeeQualificationIds,
    qualificationNameById,
  });

  if (qualificationCheck.status === "missing") {
    const names = qualificationCheck.missingNames.join(", ");
    return {
      ok: false,
      error:
        names.length > 0
          ? `Personal erfüllt die erforderliche Qualifikation nicht (${names}).`
          : "Personal erfüllt die erforderliche Qualifikation für diese Servicezeit nicht.",
    };
  }

  const staffingWeekday = validateStaffingWeekdayForCountry({
    countryCode: ctx.countryCode,
    weekday,
  });

  const warnings =
    staffingWeekday.ok && staffingWeekday.warnings.length
      ? [...staffingWeekday.warnings]
      : undefined;

  return { ok: true, warnings };
}

/** @deprecated Use validateShiftAssignEligibility with planningMode instead. */
export function validateShiftEmployeeEligibility(
  ctx: ShiftAssignEligibilityContext,
  input: ShiftAssignEligibilityInput & { locationAreaId: string }
): { ok: true; warnings?: string[] } | { ok: false; error: string } {
  return validateShiftAssignEligibility("advanced", ctx, input);
}
