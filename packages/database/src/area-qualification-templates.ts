import type { Qualification } from "@schichtwerk/types";

/** Qualifikationen, die im Bereich wählbar sind (Personalbedarf etc.). */
export function qualificationsForArea(
  areaQualificationTemplates: readonly Qualification[],
  organizationQualifications: readonly Qualification[]
): Qualification[] {
  const activeOrg = organizationQualifications.filter(
    (qualification) => !qualification.archived_at
  );
  if (areaQualificationTemplates.length === 0) {
    return activeOrg.slice().sort(compareQualifications);
  }
  return areaQualificationTemplates.slice().sort(compareQualifications);
}

export function areaHasQualificationTemplates(
  areaId: string,
  templates: readonly { location_area_id: string }[]
): boolean {
  return templates.some((entry) => entry.location_area_id === areaId);
}

function compareQualifications(a: Qualification, b: Qualification): number {
  return (
    a.sort_order - b.sort_order || a.name.localeCompare(b.name, "de")
  );
}
