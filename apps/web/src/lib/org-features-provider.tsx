"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { Organization } from "@schichtwerk/types";
import { resolveOrganizationShiftConfirmationPendingAfterMinutes } from "@schichtwerk/database";
import { getOrgFeatures, type OrgFeatures } from "@/lib/org-features";

type OrgFeaturesContextValue = {
  organization: Organization;
  features: OrgFeatures;
};

const OrgFeaturesContext = createContext<OrgFeaturesContextValue | null>(null);

type Props = {
  organization: Organization;
  children: ReactNode;
};

export function OrgFeaturesProvider({ organization, children }: Props) {
  const value = useMemo(
    () => ({
      organization,
      features: getOrgFeatures(organization),
    }),
    [organization]
  );

  return (
    <OrgFeaturesContext.Provider value={value}>
      {children}
    </OrgFeaturesContext.Provider>
  );
}

export function useOrgFeatures(): OrgFeatures {
  const ctx = useContext(OrgFeaturesContext);
  if (!ctx) {
    throw new Error("useOrgFeatures must be used within OrgFeaturesProvider");
  }
  return ctx.features;
}

export function useOrganization(): Organization {
  const ctx = useContext(OrgFeaturesContext);
  if (!ctx) {
    throw new Error("useOrganization must be used within OrgFeaturesProvider");
  }
  return ctx.organization;
}

/** Org-Einstellung: Entgelt/Zuschläge in Planungs-UI (Kalender, Dashboard). */
export function useShowCompensationInPlanningUi(): boolean {
  const organization = useOrganization();
  return organization.show_compensation_in_planning_ui;
}

/** Org-Einstellung: Frist requested → pending in Minuten. */
export function useShiftConfirmationPendingAfterMinutes(): number {
  const organization = useOrganization();
  return resolveOrganizationShiftConfirmationPendingAfterMinutes(organization);
}
