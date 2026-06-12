import type { BreakDurationTier, BreakDurationTiersRule, CountryCompliance } from "./types";
import { getRule } from "./helpers";
export type BreakDurationRuleKind = "none" | "required" | "max";

export interface ResolvedBreakRule {
  kind: BreakDurationRuleKind;
  minutes: number;
  minSegmentMinutes?: number;
}

function tierForHours(tiers: BreakDurationTier[], hours: number): BreakDurationTier | null {
  for (const tier of tiers) {
    if (tier.fromHours != null && tier.upToHours != null) {
      if (hours > tier.fromHours && hours < tier.upToHours) return tier;
      continue;
    }
    if (tier.fromHours != null && tier.upToHours == null) {
      if (hours >= tier.fromHours) return tier;
      continue;
    }
    if (tier.upToHours != null && tier.fromHours == null) {
      if (hours <= tier.upToHours) return tier;
    }
  }
  return null;
}

export function getBreakRuleFromCompliance(
  compliance: CountryCompliance,
  shiftHours: number,
  ruleId = "break_requirements"
): ResolvedBreakRule {
  const rule = getRule(compliance, "break_duration_tiers", ruleId);
  if (!rule) {
    return { kind: "none", minutes: 0 };
  }
  return resolveBreakTier(rule, shiftHours);
}

export function resolveBreakTier(
  rule: BreakDurationTiersRule,
  shiftHours: number
): ResolvedBreakRule {
  const tier = tierForHours(rule.tiers, shiftHours);
  if (!tier) {
    return { kind: "none", minutes: 0 };
  }

  const minutes = tier.requiredBreakMinutes;
  if (minutes <= 0) {
    return {
      kind: tier.maxBreakMinutes != null ? "max" : "none",
      minutes: tier.maxBreakMinutes ?? 0,
      minSegmentMinutes: tier.minBreakSegmentMinutes,
    };
  }

  return {
    kind: "required",
    minutes,
    minSegmentMinutes: tier.minBreakSegmentMinutes,
  };
}

export function maxShiftHoursOnWorkday(
  compliance: CountryCompliance,
  ruleId = "standard_workday_max_hours"
): number | null {
  const rule = getRule(compliance, "max_shift_duration", ruleId);
  return rule?.maxHours ?? null;
}

export function minRestHoursBetweenShifts(
  compliance: CountryCompliance,
  ruleId = "min_rest_between_shifts"
): number | null {
  const rule = getRule(compliance, "min_rest_period", ruleId);
  return rule?.minHours ?? null;
}
