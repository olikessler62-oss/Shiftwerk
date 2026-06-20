import type { ShiftWeeklyHoursConflict } from "@schichtwerk/database";
import type { AbsenceType } from "@schichtwerk/types";
import { absenceTypeLabelKey } from "@/lib/shift-absence-conflict";

export type ShiftAbsenceHubConflict = {
  kind: "absence";
  shiftId: string;
  employeeId: string;
  shiftDate: string;
  absenceType: AbsenceType;
  absenceId: string;
};

export type ShiftWeeklyHoursHubConflict = ShiftWeeklyHoursConflict & {
  kind: "weeklyHours";
};

export type ShiftHubConflict =
  | ShiftAbsenceHubConflict
  | ShiftWeeklyHoursHubConflict;

export function appendShiftHubConflict(
  map: Map<string, ShiftHubConflict[]>,
  conflict: ShiftHubConflict
): void {
  const existing = map.get(conflict.shiftId) ?? [];
  map.set(conflict.shiftId, [...existing, conflict]);
}

export function shiftHubConflictShortLabel(
  conflict: ShiftHubConflict,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (conflict.kind === "absence") {
    return t(absenceTypeLabelKey(conflict.absenceType));
  }
  return t("shiftConfirmation.communication.weeklyHoursConflictShort");
}

export function shiftHubConflictTooltip(
  conflicts: readonly ShiftHubConflict[],
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  return conflicts
    .map((conflict) => {
      if (conflict.kind === "absence") {
        return t("shiftConfirmation.communication.absenceConflictTooltip", {
          absence: t(absenceTypeLabelKey(conflict.absenceType)),
        });
      }
      return t("shiftConfirmation.communication.weeklyHoursConflictTooltip", {
        weekTotal: conflict.weekTotalHours,
        target: conflict.targetHours,
      });
    })
    .join("\n");
}
