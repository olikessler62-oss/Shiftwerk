"use client";

import { useCallback, useState } from "react";

import {
  isPlanningDayEditLocked,
  isPlanningEditHardBlocked,
  requiresPastPlanningConfirm,
} from "@/lib/planning-past-day-edit-guard";
import type { PlanningPastShiftChecker } from "@/lib/planning-past-shift-time";
import type { PlanningShiftMomentInput } from "@schichtwerk/database";

export function usePastPlanningDayConfirm(
  allowPastShiftChanges: boolean,
  planningPastShiftChecker: PlanningPastShiftChecker,
  readOnlyWeek = false
) {
  const [allowPastDayStaffingEdits, setAllowPastDayStaffingEdits] =
    useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const guardPastPlanningAction = useCallback(
    (moment: PlanningShiftMomentInput, run: () => void) => {
      if (
        isPlanningEditHardBlocked(
          planningPastShiftChecker,
          allowPastShiftChanges,
          moment,
          readOnlyWeek
        )
      ) {
        return;
      }
      if (
        requiresPastPlanningConfirm(
          planningPastShiftChecker,
          allowPastShiftChanges,
          allowPastDayStaffingEdits,
          moment
        )
      ) {
        setPendingAction(() => run);
        return;
      }
      run();
    },
    [
      allowPastDayStaffingEdits,
      allowPastShiftChanges,
      planningPastShiftChecker,
      readOnlyWeek,
    ]
  );

  const confirmPastDayChange = useCallback(() => {
    if (!pendingAction) return;
    setAllowPastDayStaffingEdits(true);
    pendingAction();
    setPendingAction(null);
  }, [pendingAction]);

  const closePastDayChangeConfirm = useCallback(() => {
    setPendingAction(null);
  }, []);

  const isDayEditLocked = useCallback(
    (date: string, startTime?: string | null) =>
      isPlanningDayEditLocked(
        planningPastShiftChecker,
        allowPastShiftChanges,
        allowPastDayStaffingEdits,
        { shiftDateISO: date, startTime },
        readOnlyWeek
      ),
    [
      allowPastDayStaffingEdits,
      allowPastShiftChanges,
      planningPastShiftChecker,
      readOnlyWeek,
    ]
  );

  const isCellAssignHardBlocked = useCallback(
    (date: string) =>
      isPlanningEditHardBlocked(
        planningPastShiftChecker,
        allowPastShiftChanges,
        { shiftDateISO: date },
        readOnlyWeek
      ),
    [allowPastShiftChanges, planningPastShiftChecker, readOnlyWeek]
  );

  const isDatePlanningBlockedForAssign = useCallback(
    (dateISO: string) => isCellAssignHardBlocked(dateISO),
    [isCellAssignHardBlocked]
  );

  return {
    pastDayChangeConfirmOpen: pendingAction != null,
    allowPastDayStaffingEdits,
    guardPastPlanningAction,
    confirmPastDayChange,
    closePastDayChangeConfirm,
    isDayEditLocked,
    isCellAssignHardBlocked,
    isDatePlanningBlockedForAssign,
  };
}
