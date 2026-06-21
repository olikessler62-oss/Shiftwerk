import type { LocationAreaStaffing } from "@schichtwerk/types";

import type { AreaServiceHourRef } from "./location-service-hours";
import {
  findServiceHourIdForShift,
  serviceWeekdayForShiftDate,
} from "./shift-service-hours";
import { staffingQualificationIdsForServiceHour } from "./shift-staffing-qualification";

export type EmployeeShiftJobLabelInput = {
  areaId: string | null;
  countryCode: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  employeeQualificationIds: ReadonlySet<string>;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  qualificationMetaById: ReadonlyMap<
    string,
    { name: string; sortOrder: number }
  >;
};

export function resolveEmployeeShiftJobLabel(
  input: EmployeeShiftJobLabelInput
): string | null {
  if (!input.areaId || !input.startTime || !input.endTime) return null;

  const weekday = serviceWeekdayForShiftDate(input.countryCode, input.shiftDate);
  const serviceHourId = findServiceHourIdForShift(
    input.serviceHours,
    input.areaId,
    weekday,
    input.startTime,
    input.endTime
  );

  const demandIds = serviceHourId
    ? staffingQualificationIdsForServiceHour(
        input.staffingRules,
        input.areaId,
        serviceHourId
      )
    : new Set<string>();

  const relevantIds =
    demandIds.size > 0
      ? [...demandIds].filter((id) => input.employeeQualificationIds.has(id))
      : [...input.employeeQualificationIds];

  if (!relevantIds.length) return null;

  const names = relevantIds
    .slice()
    .sort(
      (a, b) =>
        (input.qualificationMetaById.get(a)?.sortOrder ?? 0) -
        (input.qualificationMetaById.get(b)?.sortOrder ?? 0)
    )
    .map((id) => input.qualificationMetaById.get(id)?.name?.trim())
    .filter((name): name is string => Boolean(name));

  return names.length ? names.join(", ") : null;
}
