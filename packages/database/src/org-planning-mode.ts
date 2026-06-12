import type { PlanningMode } from "@schichtwerk/types";

export type { PlanningMode };

export const DEFAULT_ORG_PLANNING_MODE: PlanningMode = "simple";

export const ORG_PLANNING_MODES: readonly PlanningMode[] = ["simple", "advanced"];

export function isPlanningMode(value: unknown): value is PlanningMode {
  return value === "simple" || value === "advanced";
}

export function normalizePlanningMode(value: unknown): PlanningMode {
  return isPlanningMode(value) ? value : DEFAULT_ORG_PLANNING_MODE;
}

export function validatePlanningMode(
  value: unknown
): { ok: true; value: PlanningMode } | { ok: false; error: string } {
  if (!isPlanningMode(value)) {
    return { ok: false, error: "Ungültiger Planungsmodus." };
  }
  return { ok: true, value };
}

export type PlanningModeUpgradeErrorCode =
  | "already_active"
  | "downgrade_not_allowed"
  | "invalid_change";

/** Nur Upgrade simple → advanced; Downgrade ist in dieser Iteration nicht erlaubt. */
export function validateOrganizationPlanningModeUpgrade(
  current: PlanningMode,
  target: PlanningMode
):
  | { ok: true }
  | { ok: false; code: PlanningModeUpgradeErrorCode; error: string } {
  if (current === target) {
    return {
      ok: false,
      code: "already_active",
      error: "Der Planungsmodus ist bereits aktiv.",
    };
  }
  if (current === "advanced" && target === "simple") {
    return {
      ok: false,
      code: "downgrade_not_allowed",
      error:
        "Ein Wechsel von Erweitert auf Einfach ist derzeit nicht möglich.",
    };
  }
  if (current === "simple" && target === "advanced") {
    return { ok: true };
  }
  return {
    ok: false,
    code: "invalid_change",
    error: "Ungültiger Planungsmodus-Wechsel.",
  };
}
