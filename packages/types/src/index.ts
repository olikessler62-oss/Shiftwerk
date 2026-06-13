export { DEFAULT_LOCATION_AREAS } from "./default-location-areas";
export { DEFAULT_ORG_ROLES } from "./default-roles";

/** Berechtigungsstufe (ehem. owner → admin, employee → basic) */
export type RolePermissionLevel = "admin" | "manager" | "basic";

/** @deprecated Alias — nutze RolePermissionLevel */
export type UserRole = RolePermissionLevel;

export interface Role {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  permission_level: RolePermissionLevel;
  is_system: boolean;
  sort_order: number;
  archived_at: string | null;
}

export type AvailabilityStatus = "available" | "unavailable" | "preferred";

export type AbsenceType = "vacation" | "sick" | "other";

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type SwapRequestStatus = RequestStatus;

/** Planungsmodus auf Organisationsebene (führend für UI & Validierung). */
export type PlanningMode = "simple" | "advanced";

/** Branche — rein informativ; steuert Onboarding-Seeding. */
export type Industry = "gastronomy" | "care" | "retail" | "other";

export interface Organization {
  id: string;
  name: string;
  timezone: string;
  /** ISO 3166-1 alpha-2 — Compliance-Profil aus compliances/ */
  country_code: string;
  /** Führender Planungsmodus; location_areas.planning_mode ist Override pro Bereich. */
  planning_mode: PlanningMode;
  /** Branche aus Onboarding; null bei älteren Organisationen ohne Zuordnung. */
  industry: Industry | null;
  created_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  role_id: string;
  /** Anzeigename der zugewiesenen Rolle (aus roles.name) */
  role_name: string;
  /** Abgeleitet aus roles.permission_level */
  role: RolePermissionLevel;
  full_name: string;
  email: string;
  mobile_phone: string | null;
  color: string | null;
  weekly_hours: number | null;
  is_active: boolean;
  schedulable: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProfileHourlyRate {
  id: string;
  organization_id: string;
  profile_id: string;
  amount: number;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
}

export interface ProfileHourlyRateSummary {
  profile_id: string;
  amount: number;
  currency: string;
}

export type CompensationSurchargeTrigger = "public_holiday";

export type CompensationSurchargeUnit = "eur_per_hour" | "percent_of_base";

export interface CompensationSurchargeType {
  id: string;
  organization_id: string;
  name: string;
  trigger: CompensationSurchargeTrigger;
  amount: number;
  unit: CompensationSurchargeUnit;
  sort_order: number;
  archived_at: string | null;
}

export interface ProfileCompensationSurcharge {
  id: string;
  organization_id: string;
  profile_id: string;
  surcharge_type_id: string;
  surcharge_type_name: string;
  trigger: CompensationSurchargeTrigger;
  type_default_amount: number;
  type_default_unit: CompensationSurchargeUnit;
  amount: number | null;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
}

export interface EffectiveProfileCompensationSurcharge {
  id: string;
  surcharge_type_id: string;
  name: string;
  trigger: CompensationSurchargeTrigger;
  amount: number;
  unit: CompensationSurchargeUnit;
}

export interface ProfileRecurringAvailability {
  id: string;
  organization_id: string;
  profile_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  sort_order: number;
  created_at: string;
}

export interface ProfileShiftPreference {
  id: string;
  organization_id: string;
  profile_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location_area_id: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Qualification {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
}

export interface Location {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
}

/** Servicezeiten pro Bereich: weekday 0=Mo … 6=So, 7=Feiertage */
export interface LocationAreaServiceHour {
  id: string;
  location_area_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export type AreaPlanningMode = "simple" | "advanced";

export interface LocationArea {
  id: string;
  location_id: string;
  name: string;
  sort_order: number;
  /** simple = kompakte Planung; advanced = mehrere Servicezeiten pro Tag */
  planning_mode: AreaPlanningMode;
  archived_at: string | null;
}

/** Personalbedarf: Bereich × Servicezeit-Fenster × Qualifikation */
export interface LocationAreaStaffing {
  id: string;
  location_area_id: string;
  service_hour_id: string;
  qualification_id: string;
  required_count: number;
}

/** Schichtvorlage pro Bereich (Kurzwahl beim Zuweisen) */
export interface AreaShiftTemplate {
  id: string;
  location_area_id: string;
  name: string;
  color: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  archived_at: string | null;
}

export interface AreaShiftTemplateBreak {
  id: string;
  area_shift_template_id: string;
  break_start: string;
  break_end: string;
  sort_order: number;
}

export type AreaShiftTemplateWithBreaks = AreaShiftTemplate & {
  area_shift_template_breaks?: AreaShiftTemplateBreak[];
};

/** Funktionsvorlage pro Bereich (Verknüpfung Bereich ↔ Qualifikation) */
export interface AreaQualificationTemplate {
  id: string;
  location_area_id: string;
  qualification_id: string;
  sort_order: number;
}

export type AreaQualificationTemplateEntry = AreaQualificationTemplate & {
  qualification: Qualification;
};

export interface Shift {
  id: string;
  organization_id: string;
  employee_id: string;
  area_shift_template_id: string | null;
  location_id: string | null;
  location_area_id: string | null;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  created_by: string | null;
  updated_at: string;
}

export interface Availability {
  id: string;
  organization_id: string;
  employee_id: string;
  available_date: string;
  status: AvailabilityStatus;
}

export interface AbsenceRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  type: AbsenceType;
  start_date: string;
  end_date: string;
  status: RequestStatus;
  reviewed_by: string | null;
  notes: string | null;
}

export interface SwapRequest {
  id: string;
  organization_id: string;
  requester_id: string;
  shift_id: string;
  target_employee_id: string | null;
  status: SwapRequestStatus;
  message: string | null;
  reviewed_by: string | null;
}

export interface DashboardStats {
  shiftsToday: number;
  staffedToday: number;
  openSwaps: number;
  warnings: number;
}
