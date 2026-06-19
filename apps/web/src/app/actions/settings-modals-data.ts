"use server";

import { weekDates } from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import type {
  AreaShiftTemplateWithBreaks,
  CompensationSurchargeType,
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
  Profile,
  Qualification,
  Role,
} from "@schichtwerk/types";

export type SettingsModalsData = {
  locations: Location[];
  selectedLocationId: string | null;
  areas: LocationArea[];
  serviceHours: LocationAreaServiceHour[];
  fullStaffingRules: LocationAreaStaffing[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  compensationSurchargeTypes: CompensationSurchargeType[];
  roles: Role[];
  profiles: Profile[];
};

export type FetchSettingsModalsDataResult =
  | { ok: true; data: SettingsModalsData }
  | { ok: false; error: string };

export async function fetchSettingsModalsData(options?: {
  locationParam?: string | null;
  weekStart?: string | null;
}): Promise<FetchSettingsModalsDataResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();

    const weekStart = options?.weekStart ?? null;
    const dates = weekStart ? weekDates(weekStart) : null;
    const from = dates?.[0];
    const to = dates?.[6];

    let [qualifications, compensationSurchargeTypes, roles, profiles, locations] =
      await Promise.all([
        db.listQualifications(organizationId),
        db.listCompensationSurchargeTypes(organizationId),
        db.listRoles(organizationId),
        db.listOrganizationProfiles(organizationId),
        from && to
          ? db.listLocationsForAreaCalendar(organizationId, from, to)
          : db.listLocations(organizationId),
      ]);

    if (!roles.length) {
      await db.seedDefaultRoles(organizationId);
      roles = await db.listRoles(organizationId);
    }

    const selectedLocationId = resolveSelectedLocationId(
      locations,
      options?.locationParam ?? undefined
    );

    const [areas, staffingRules, serviceHours, areaShiftTemplates] =
      selectedLocationId
        ? await Promise.all([
            from && to
              ? db.listLocationAreasForAreaCalendar(selectedLocationId, from, to)
              : db.listLocationAreas(selectedLocationId),
            db.listLocationAreaStaffing(selectedLocationId),
            db.listLocationAreaServiceHours(selectedLocationId).catch(() => []),
            db
              .listAreaShiftTemplatesWithBreaksForLocation(selectedLocationId)
              .catch(() => []),
          ])
        : [[], [], [], []];

    return {
      ok: true,
      data: {
        locations,
        selectedLocationId,
        areas,
        serviceHours,
        fullStaffingRules: staffingRules,
        areaShiftTemplates,
        qualifications,
        compensationSurchargeTypes,
        roles,
        profiles,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unbekannter Fehler",
    };
  }
}
