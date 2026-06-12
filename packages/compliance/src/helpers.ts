import type {
  ComplianceEnforcementPoint,
  ComplianceRule,
  ComplianceRuleType,
  CountryCompliance,
} from "./types";

export function getRule<T extends ComplianceRuleType>(
  compliance: CountryCompliance,
  type: T,
  id?: string
): Extract<ComplianceRule, { type: T }> | undefined {
  return compliance.rules.find(
    (rule): rule is Extract<ComplianceRule, { type: T }> =>
      rule.type === type && (id == null || rule.id === id)
  );
}

export function rulesForEnforcementPoint(
  compliance: CountryCompliance,
  point: ComplianceEnforcementPoint
): ComplianceRule[] {
  return compliance.rules.filter((rule) => rule.enforceAt.includes(point));
}
