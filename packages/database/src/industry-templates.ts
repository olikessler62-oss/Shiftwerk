import type { Industry, PlanningMode } from "@schichtwerk/types";

export type IndustryLocationTemplate = {
  name: string;
  areas: readonly string[];
};

export type IndustryTemplate = {
  planningMode: PlanningMode;
  /** Standortname = Organisationsname (simple), statt fester Vorlage. */
  useOrgNameAsLocation: boolean;
  /** Standard-Standortname für advanced-Branchen. */
  defaultLocationName: string;
  locations: readonly IndustryLocationTemplate[];
  qualifications: readonly string[];
};

export const INDUSTRY_TEMPLATES: Record<Industry, IndustryTemplate> = {
  gastronomy: {
    planningMode: "advanced",
    useOrgNameAsLocation: false,
    defaultLocationName: "Hauptstandort",
    locations: [
      {
        name: "Hauptstandort",
        areas: ["Restaurant", "Küche", "Bar"],
      },
    ],
    qualifications: ["Koch/Köchin", "Kellner/in", "Spülkraft", "Barkeeper/in"],
  },
  care: {
    planningMode: "advanced",
    useOrgNameAsLocation: false,
    defaultLocationName: "Hauptstandort",
    locations: [
      {
        name: "Hauptstandort",
        areas: ["Wohnbereich 1"],
      },
    ],
    qualifications: [
      "Pflegefachkraft (examiniert)",
      "Pflegehilfskraft",
      "Betreuungskraft",
    ],
  },
  retail: {
    planningMode: "advanced",
    useOrgNameAsLocation: false,
    defaultLocationName: "Hauptstandort",
    locations: [
      {
        name: "Hauptstandort",
        areas: ["Verkauf", "Lager"],
      },
    ],
    qualifications: ["Verkäufer/in", "Lagerist/in"],
  },
  other: {
    planningMode: "simple",
    useOrgNameAsLocation: true,
    defaultLocationName: "",
    locations: [],
    qualifications: [],
  },
};

export function getIndustryTemplate(industry: Industry): IndustryTemplate {
  return INDUSTRY_TEMPLATES[industry];
}

export function resolveIndustryTemplateLocations(
  template: IndustryTemplate,
  orgName: string
): IndustryLocationTemplate[] {
  if (template.useOrgNameAsLocation) {
    return [{ name: orgName.trim() || "Mein Betrieb", areas: [] }];
  }
  if (template.locations.length > 0) {
    return [...template.locations];
  }
  return [{ name: template.defaultLocationName, areas: [] }];
}
