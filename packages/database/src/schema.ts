/**
 * Tabellen- und Objektnamen — müssen mit packages/database/schema.sql übereinstimmen.
 */
export const Schema = {
  tables: {
    organizations: "organizations",
    profiles: "profiles",
    shiftTypes: "shift_types",
    qualifications: "qualifications",
    locations: "locations",
    locationAreas: "location_areas",
    locationAreaStaffing: "location_area_staffing",
    shiftTypeBreaks: "shift_type_breaks",
    shifts: "shifts",
    availability: "availability",
    absenceRequests: "absence_requests",
    swapRequests: "swap_requests",
  },
  views: {
    coworkers: "coworkers",
  },
} as const;

/** Pfad zur einzigen SQL-Datei im Monorepo (für Dokumentation/Tools). */
export const SCHEMA_SQL_PATH = "packages/database/schema.sql";
