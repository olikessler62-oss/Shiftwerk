import type { Organization, PlanningMode } from "@schichtwerk/types";

export type OrgFeatureShiftTemplates = "simple" | "full";

/** Abgeleitete UI-/Validierungs-Flags aus dem Organisations-Planungsmodus. */
export type OrgFeatures = {
  planningMode: PlanningMode;
  areas: boolean;
  qualifications: boolean;
  staffing: boolean;
  serviceHours: boolean;
  shiftTemplates: OrgFeatureShiftTemplates;
};

export function getOrgFeatures(
  organization: Pick<Organization, "planning_mode">
): OrgFeatures {
  const isSimple = organization.planning_mode === "simple";
  return {
    planningMode: organization.planning_mode,
    areas: !isSimple,
    qualifications: !isSimple,
    staffing: !isSimple,
    serviceHours: !isSimple,
    shiftTemplates: isSimple ? "simple" : "full",
  };
}
