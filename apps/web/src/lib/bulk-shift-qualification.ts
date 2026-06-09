import { serviceWeekdayForDate } from "@/lib/location-staffing-client";
import type { LocationAreaStaffing } from "@schichtwerk/types";

export type QualificationAmpel = "neutral" | "ok" | "missing";

export function evaluateBulkRowQualification(input: {
  shiftTypeId: string | null;
  employeeId: string;
  areaId: string;
  dateISO: string;
  staffingRules: readonly LocationAreaStaffing[];
  employeeQualificationIds: ReadonlySet<string>;
  qualificationNameById: ReadonlyMap<string, string>;
}): { status: QualificationAmpel; missingNames: string[] } {
  const {
    shiftTypeId,
    employeeId,
    areaId,
    dateISO,
    staffingRules,
    employeeQualificationIds,
    qualificationNameById,
  } = input;

  if (!shiftTypeId || !employeeId) {
    return { status: "neutral", missingNames: [] };
  }

  const weekday = serviceWeekdayForDate(dateISO);
  const requiredQualIds = staffingRules
    .filter(
      (rule) =>
        rule.location_area_id === areaId &&
        rule.shift_type_id === shiftTypeId &&
        rule.weekday === weekday &&
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
