import type { PlanningMode } from "@schichtwerk/types";

export type OrgFeatureShiftTemplates = "simple" | "full";

/** Abgeleitete Validierungs-/Feature-Flags aus dem Organisations-Planungsmodus. */
export type OrgFeatures = {
  planningMode: PlanningMode;
  areas: boolean;
  qualifications: boolean;
  staffing: boolean;
  serviceHours: boolean;
  shiftTemplates: OrgFeatureShiftTemplates;
};

export function getOrgFeaturesFromPlanningMode(
  planningMode: PlanningMode
): OrgFeatures {
  const isSimple = planningMode === "simple";
  return {
    planningMode,
    areas: !isSimple,
    qualifications: !isSimple,
    staffing: !isSimple,
    serviceHours: !isSimple,
    shiftTemplates: isSimple ? "simple" : "full",
  };
}
