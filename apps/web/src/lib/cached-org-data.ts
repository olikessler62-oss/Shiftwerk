import { cache } from "react";
import { getDatabase } from "@/lib/db";

/** Pro Request einmal — Layout, Shell und Kalender-Layer teilen dieselbe Abfrage. */
export const getCachedOrgLocations = cache(async (orgId: string) => {
  const db = await getDatabase();
  return db.listLocations(orgId);
});

export const getCachedPlanningEmployees = cache(async (orgId: string) => {
  const db = await getDatabase();
  return db.listPlanningEmployees(orgId);
});

export const getCachedOrgQualifications = cache(async (orgId: string) => {
  const db = await getDatabase();
  return db.listQualifications(orgId);
});

export const getCachedProfileQualificationIdsMap = cache(async (orgId: string) => {
  const db = await getDatabase();
  return db.listProfileQualificationIdsByOrganization(orgId);
});
