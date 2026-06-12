export type ComplianceSeverity = "error" | "warning" | "info";

export type ComplianceEnforcementPoint =
  | "shift_template"
  | "shift_assign"
  | "availability"
  | "staffing";

export type ComplianceWorkdayDefinition = "mon_sat" | "mon_fri" | "all";

export interface ComplianceMeta {
  id: string;
  countryCode: string;
  jurisdiction: string;
  legalBasis: string[];
  locale: string;
  version: string;
}

export interface ComplianceRuleBase {
  id: string;
  severity: ComplianceSeverity;
  enforceAt: ComplianceEnforcementPoint[];
}

export interface MaxShiftDurationRule extends ComplianceRuleBase {
  type: "max_shift_duration";
  maxHours: number;
  workdayDefinition?: ComplianceWorkdayDefinition;
  /** 0 = Sunday … 6 = Saturday */
  weekdays?: number[];
}

export interface RollingAverageHoursRule extends ComplianceRuleBase {
  type: "rolling_average_hours";
  temporaryMaxHours: number;
  averageMaxHoursPerWorkday: number;
  windowWeeks: number;
  workdayDefinition?: ComplianceWorkdayDefinition;
}

export interface BreakDurationTier {
  upToHours?: number;
  fromHours?: number;
  requiredBreakMinutes: number;
  maxBreakMinutes?: number;
  minBreakSegmentMinutes?: number;
}

export interface BreakDurationTiersRule extends ComplianceRuleBase {
  type: "break_duration_tiers";
  tiers: BreakDurationTier[];
}

export interface MinRestPeriodRule extends ComplianceRuleBase {
  type: "min_rest_period";
  minHours: number;
}

export interface RestrictedWorkDaysRule extends ComplianceRuleBase {
  type: "restricted_work_days";
  restrictedWeekdays: number[];
  publicHolidaysRestricted: boolean;
  defaultAllowed: boolean;
  requiresSubstituteRestDay: boolean;
  exceptionIndustries?: string[];
}

export interface NightWorkIndustryOverride {
  industry: string;
  nightStartHour: number;
}

export interface NightWorkRule extends ComplianceRuleBase {
  type: "night_work";
  nightStartHour: number;
  nightEndHour: number;
  maxShiftHoursUnlessCompensated: number;
  compensationRequired: "substitute_days" | "surcharge" | "substitute_days_or_surcharge";
  industryOverrides?: NightWorkIndustryOverride[];
}

export type ComplianceRule =
  | MaxShiftDurationRule
  | RollingAverageHoursRule
  | BreakDurationTiersRule
  | MinRestPeriodRule
  | RestrictedWorkDaysRule
  | NightWorkRule;

export type ComplianceRuleType = ComplianceRule["type"];

export interface CountryCompliance {
  meta: ComplianceMeta;
  rules: ComplianceRule[];
  /** Markdown body after frontmatter (human-readable documentation). */
  documentation: string;
}

export interface ParsedComplianceFile {
  meta: ComplianceMeta;
  rules: ComplianceRule[];
  documentation: string;
}
