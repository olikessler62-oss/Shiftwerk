import type {
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
} from "@schichtwerk/types";

/**
 * Ersetzt Personalbedarf-Regeln für einen Bereich an einem Tag,
 * wenn temporäre Overrides für Servicezeit-Fenster existieren.
 */
export function staffingRulesWithOverridesForAreaDate(
  baseRules: readonly LocationAreaStaffing[],
  overrides: readonly LocationAreaStaffingOverride[],
  areaId: string,
  dateISO: string
): LocationAreaStaffing[] {
  const overridesForDay = overrides.filter(
    (override) =>
      override.location_area_id === areaId && override.shift_date === dateISO
  );
  if (overridesForDay.length === 0) {
    return baseRules.filter((rule) => rule.location_area_id === areaId);
  }

  const overriddenHourIds = new Set(
    overridesForDay.map((override) => override.service_hour_id)
  );
  const withoutOverriddenHours = baseRules.filter(
    (rule) =>
      rule.location_area_id === areaId &&
      !overriddenHourIds.has(rule.service_hour_id)
  );
  const overrideRules: LocationAreaStaffing[] = overridesForDay
    .filter((override) => override.required_count > 0)
    .map((override) => ({
      id: override.id,
      location_area_id: override.location_area_id,
      service_hour_id: override.service_hour_id,
      qualification_id: override.qualification_id,
      required_count: override.required_count,
    }));

  return [...withoutOverriddenHours, ...overrideRules];
}

/**
 * Wie {@link staffingRulesWithOverridesForAreaDate}, aber mit allen Bereichen
 * außer dem Zielbereich unverändert.
 */
export function mergeStaffingRulesWithOverridesForAreaDate(
  baseRules: readonly LocationAreaStaffing[],
  overrides: readonly LocationAreaStaffingOverride[],
  areaId: string,
  dateISO: string
): LocationAreaStaffing[] {
  const otherAreaRules = baseRules.filter(
    (rule) => rule.location_area_id !== areaId
  );
  return [
    ...otherAreaRules,
    ...staffingRulesWithOverridesForAreaDate(
      baseRules,
      overrides,
      areaId,
      dateISO
    ),
  ];
}
