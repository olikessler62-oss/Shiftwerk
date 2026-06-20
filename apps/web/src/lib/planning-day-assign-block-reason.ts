import { employeeHasRecurringAvailabilityOnWeekday, isEmployeeAbsentOnDate } from "@schichtwerk/database";
import type { AbsenceRequest, ProfileRecurringAvailability } from "@schichtwerk/types";

import { profileAvailabilityWeekdayFromAreaCalendarDate } from "@/lib/available-employees-for-shift";
import { recurringAvailabilityEffectiveOnCalendarDate } from "@/lib/planning-availability-calendar-effective";

export type PlanningDayAssignBlockReason = "absent" | "no_availability";

export function getPlanningDayAssignBlockReason(
  employeeId: string,
  date: string,
  todayISO: string,
  recurringAvailability: readonly ProfileRecurringAvailability[],
  absences: readonly AbsenceRequest[]
): PlanningDayAssignBlockReason | null {
  if (isEmployeeAbsentOnDate(employeeId, absences, date)) return "absent";

  const effectiveAvailability = recurringAvailabilityEffectiveOnCalendarDate(
    recurringAvailability,
    date,
    todayISO
  );
  const weekday = profileAvailabilityWeekdayFromAreaCalendarDate(date);
  if (
    !employeeHasRecurringAvailabilityOnWeekday(
      employeeId,
      effectiveAvailability,
      weekday
    )
  ) {
    return "no_availability";
  }
  return null;
}
