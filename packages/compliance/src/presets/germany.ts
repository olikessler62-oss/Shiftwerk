import type { CountryCompliance } from "../types";

/** Browser-sicherer Snapshot — synchron zu compliances/germany.md halten. */
export const GERMANY_COMPLIANCE: CountryCompliance = {
  meta: {
    id: "germany",
    countryCode: "DE",
    jurisdiction: "Deutschland",
    legalBasis: ["ArbZG"],
    locale: "de",
    version: "2025-06-01",
  },
  rules: [
    {
      id: "standard_workday_max_hours",
      type: "max_shift_duration",
      severity: "error",
      enforceAt: ["shift_template", "shift_assign", "availability", "staffing"],
      maxHours: 8,
      workdayDefinition: "mon_sat",
      weekdays: [1, 2, 3, 4, 5, 6],
    },
    {
      id: "extended_workday_with_average",
      type: "rolling_average_hours",
      severity: "warning",
      enforceAt: ["shift_assign", "shift_template"],
      temporaryMaxHours: 10,
      averageMaxHoursPerWorkday: 8,
      windowWeeks: 24,
      workdayDefinition: "mon_sat",
    },
    {
      id: "break_requirements",
      type: "break_duration_tiers",
      severity: "error",
      enforceAt: ["shift_template", "shift_assign"],
      tiers: [
        { fromHours: 9, requiredBreakMinutes: 45, minBreakSegmentMinutes: 15 },
        {
          fromHours: 6,
          upToHours: 9,
          requiredBreakMinutes: 30,
          minBreakSegmentMinutes: 15,
        },
        { upToHours: 6, requiredBreakMinutes: 0 },
      ],
    },
    {
      id: "min_rest_between_shifts",
      type: "min_rest_period",
      severity: "error",
      enforceAt: ["shift_assign", "availability"],
      minHours: 11,
    },
    {
      id: "sunday_holiday_work",
      type: "restricted_work_days",
      severity: "warning",
      enforceAt: ["shift_assign", "shift_template", "staffing"],
      restrictedWeekdays: [0],
      publicHolidaysRestricted: true,
      defaultAllowed: false,
      requiresSubstituteRestDay: true,
      exceptionIndustries: ["gastronomy", "healthcare", "police", "emergency_services"],
    },
    {
      id: "night_work",
      type: "night_work",
      severity: "warning",
      enforceAt: ["shift_template", "shift_assign", "availability"],
      nightStartHour: 23,
      nightEndHour: 6,
      maxShiftHoursUnlessCompensated: 8,
      compensationRequired: "substitute_days_or_surcharge",
      industryOverrides: [{ industry: "bakery", nightStartHour: 22 }],
    },
  ],
  documentation: "",
};

export const COMPLIANCE_PRESETS: CountryCompliance[] = [GERMANY_COMPLIANCE];
