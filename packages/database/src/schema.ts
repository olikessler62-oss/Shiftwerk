/**
 * Tabellen- und Objektnamen — müssen mit packages/database/schema.sql übereinstimmen.
 */
export const Schema = {
  tables: {
    organizations: "organizations",
    profiles: "profiles",
    qualifications: "qualifications",
    profileQualifications: "profile_qualifications",
    profileHourlyRates: "profile_hourly_rates",
    compensationSurchargeTypes: "compensation_surcharge_types",
    profileCompensationSurcharges: "profile_compensation_surcharges",
    profileRecurringAvailability: "profile_recurring_availability",
    profileShiftPreferences: "profile_shift_preferences",
    roles: "roles",
    locations: "locations",
    locationAreas: "location_areas",
    locationAreaStaffing: "location_area_staffing",
    locationAreaServiceHours: "location_area_service_hours",
    areaShiftTemplates: "area_shift_templates",
    areaShiftTemplateBreaks: "area_shift_template_breaks",
    areaQualificationTemplates: "area_qualification_templates",
    shifts: "shifts",
    shiftsArchive: "shifts_archive",
    shiftConfirmationEvents: "shift_confirmation_events",
    shiftRequests: "shift_requests",
    shiftDeletionEvents: "shift_deletion_events",
    confirmationRequestBatches: "confirmation_request_batches",
    confirmationRequestItems: "confirmation_request_items",
    notificationOutbox: "notification_outbox",
    managerNotifications: "manager_notifications",
    absenceRequests: "absence_requests",
    swapRequests: "swap_requests",
  },
  views: {
    coworkers: "coworkers",
  },
} as const;

/** Pfad zur einzigen SQL-Datei im Monorepo (für Dokumentation/Tools). */
export const SCHEMA_SQL_PATH = "packages/database/schema.sql";
