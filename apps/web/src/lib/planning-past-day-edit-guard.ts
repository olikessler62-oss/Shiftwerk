import type { PlanningShiftMomentInput } from "@schichtwerk/database";

import type { PlanningPastShiftChecker } from "@/lib/planning-past-shift-time";

/** Vergangenheit ohne Org-Einstellung oder gesperrte Woche — keine Interaktion. */
export function isPlanningEditHardBlocked(
  checker: PlanningPastShiftChecker,
  allowPastShiftChanges: boolean,
  moment: PlanningShiftMomentInput,
  readOnlyWeek = false
): boolean {
  if (readOnlyWeek) return true;
  if (!checker.isMomentInPast(moment)) return false;
  return !allowPastShiftChanges;
}

/** Org erlaubt Vergangenheit, Nutzer:in hat das Bestätigungsmodal noch nicht bestätigt. */
export function requiresPastPlanningConfirm(
  checker: PlanningPastShiftChecker,
  allowPastShiftChanges: boolean,
  allowPastDayStaffingEdits: boolean,
  moment: PlanningShiftMomentInput
): boolean {
  if (!allowPastShiftChanges || allowPastDayStaffingEdits) return false;
  return checker.isMomentInPast(moment);
}

/** Zelle/Schicht ist für Planungsänderungen gesperrt (hart oder bis Modal bestätigt). */
export function isPlanningDayEditLocked(
  checker: PlanningPastShiftChecker,
  allowPastShiftChanges: boolean,
  allowPastDayStaffingEdits: boolean,
  moment: PlanningShiftMomentInput,
  readOnlyWeek = false
): boolean {
  return (
    isPlanningEditHardBlocked(
      checker,
      allowPastShiftChanges,
      moment,
      readOnlyWeek
    ) ||
    requiresPastPlanningConfirm(
      checker,
      allowPastShiftChanges,
      allowPastDayStaffingEdits,
      moment
    )
  );
}
