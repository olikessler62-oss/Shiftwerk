export type ServiceHourStaffingRuleInput = {
  qualification_id: string;
  required_count: number;
};

export function validateServiceHourStaffingRulesInput(
  rules: ServiceHourStaffingRuleInput[],
  validQualificationIds: Set<string>
): { ok: true; data: ServiceHourStaffingRuleInput[] } | { ok: false; error: string } {
  const seen = new Set<string>();
  const normalized: ServiceHourStaffingRuleInput[] = [];

  for (const rule of rules) {
    const qualId = rule.qualification_id?.trim();
    if (!qualId || !validQualificationIds.has(qualId)) {
      return { ok: false, error: "Bitte gültigen Job auswählen." };
    }
    if (seen.has(qualId)) {
      return {
        ok: false,
        error: "Jeder Job darf pro Servicezeit nur einmal vorkommen.",
      };
    }
    seen.add(qualId);

    if (
      !Number.isInteger(rule.required_count) ||
      rule.required_count < 1 ||
      rule.required_count > 99
    ) {
      return { ok: false, error: "Anzahl muss zwischen 1 und 99 liegen." };
    }

    normalized.push({
      qualification_id: qualId,
      required_count: rule.required_count,
    });
  }

  return { ok: true, data: normalized };
}
