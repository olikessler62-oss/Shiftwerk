export type AreaPlanningMode = "simple" | "advanced";

export const DEFAULT_AREA_PLANNING_MODE: AreaPlanningMode = "simple";

export const AREA_PLANNING_MODES: readonly AreaPlanningMode[] = [
  "simple",
  "advanced",
];

export function isAreaPlanningMode(value: unknown): value is AreaPlanningMode {
  return value === "simple" || value === "advanced";
}

export function normalizeAreaPlanningMode(
  value: unknown
): AreaPlanningMode {
  return isAreaPlanningMode(value) ? value : DEFAULT_AREA_PLANNING_MODE;
}

export function validateAreaPlanningMode(
  value: unknown
): { ok: true; value: AreaPlanningMode } | { ok: false; error: string } {
  if (!isAreaPlanningMode(value)) {
    return { ok: false, error: "Ungültiger Planungsmodus." };
  }
  return { ok: true, value };
}
