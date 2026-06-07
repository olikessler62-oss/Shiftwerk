export type StaffingRuleInput = {
  weekday: number;
  qualification_id: string;
  required_count: number;
};

export function validateStaffingRulesInput(
  rules: StaffingRuleInput[],
  validQualificationIds: Set<string>
): { ok: true; data: StaffingRuleInput[] } | { ok: false; error: string } {
  if (!rules.length) {
    return { ok: true, data: [] };
  }

  const seen = new Set<string>();
  const normalized: StaffingRuleInput[] = [];

  for (const rule of rules) {
    if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 7) {
      return { ok: false, error: "Ungültiger Wochentag." };
    }
    const qualId = rule.qualification_id?.trim();
    if (!qualId || !validQualificationIds.has(qualId)) {
      return { ok: false, error: "Bitte gültige Position auswählen." };
    }
    const key = `${rule.weekday}:${qualId}`;
    if (seen.has(key)) {
      return {
        ok: false,
        error: "Jede Position darf pro Tag nur einmal vorkommen.",
      };
    }
    seen.add(key);

    if (
      !Number.isInteger(rule.required_count) ||
      rule.required_count < 1 ||
      rule.required_count > 99
    ) {
      return { ok: false, error: "Anzahl muss zwischen 1 und 99 liegen." };
    }

    normalized.push({
      weekday: rule.weekday,
      qualification_id: qualId,
      required_count: rule.required_count,
    });
  }

  return { ok: true, data: normalized };
}
