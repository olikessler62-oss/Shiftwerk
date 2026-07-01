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

export type AbsenceType = "vacation" | "sick" | "other";

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type SwapRequestStatus = RequestStatus;

/** Phase 1 — Schichtbestätigung durch Mitarbeiter (Spec 008). */
export type ShiftConfirmationStatus =
  | "proposed"
  | "requested"
  | "confirmed"
  | "rejected"
  | "pending"
  | "canceled"
  | "unresolved";

/** Planungs-Lifecycle auf der Schicht (Sprint 1 — parallel zu confirmation_status). */
export type ShiftLifecycleStatus = "planned" | "confirmed" | "cancelled";

export type ShiftRequestType = "confirmation" | "cancellation";

export type ShiftRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export type ShiftRequestActorRole = "employee" | "manager";

export interface ShiftRequest {
  id: string;
  organization_id: string;
  shift_id: string;
  type: ShiftRequestType;
  status: ShiftRequestStatus;
  actor_id: string | null;
  sent_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
  reminder_sent_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ShiftCardDisplayState = {
  shiftId: string;
  lifecycle: ShiftLifecycleStatus;
  /** Abgeleiteter Legacy-Status für bestehende UI während der Migration. */
  legacyConfirmationStatus: ShiftConfirmationStatus;
  openConfirmation?: {
    requestId: string;
    status: "pending" | "expired";
    sentAt: string;
  };
  lastConfirmation?: {
    requestId: string;
    status: "approved" | "rejected";
    respondedAt: string | null;
  };
  openCancellation?: {
    requestId: string;
    status: "pending" | "approved";
    cancelledBy?: ShiftRequestActorRole;
  };
};

export type ConfirmationRequestScope =
  | "single_shift"
  | "employee_day"
  | "employee_week"
  | "bulk_week";

export type NotificationOutboxChannel = "push" | "email";

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
  /** Nachträgliche Stundensatz-Einträge (Gültig ab in der Vergangenheit). */
  allow_retroactive_compensation_entries: boolean;
  /** Entgelt/Zuschläge in Kalendern und Dashboard anzeigen. */
  show_compensation_in_planning_ui: boolean;
  /** Schichtbestätigung durch Mitarbeiter (Default aus). */
  shift_confirmation_enabled: boolean;
  /** MA-Krankmeldung wird sofort genehmigt (Default an). */
  auto_approve_sick_absence: boolean;
  /** Editierbarer Hinweistext für Mitarbeiter-Antworten. */
  shift_confirmation_disclaimer: string | null;
  /** Minuten nach requested_at, danach Anzeige/Übergang requested → pending. */
  shift_confirmation_pending_after_minutes: number;
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
  /** Mobile-App registriert — Pflicht für Zuweisung bei aktiver Schichtbestätigung. */
  app_registered_at: string | null;
  /** E-Mail-Fallback bei verlorenem Gerät (Phase 1 simuliert). */
  email_fallback_mode: boolean;
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

export type CompensationSurchargeTrigger = "public_holiday" | "sunday";

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
  unit: CompensationSurchargeUnit | null;
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
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  location_id: string | null;
  location_area_id: string | null;
  qualification_id: string | null;
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

/** Temporärer Personalbedarf für ein konkretes Kalenderdatum */
export interface LocationAreaStaffingOverride {
  id: string;
  location_area_id: string;
  shift_date: string;
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
  confirmation_status: ShiftConfirmationStatus;
  confirmation_status_updated_at: string;
  lifecycle_status?: ShiftLifecycleStatus;
  requested_at: string | null;
  pending_since: string | null;
  pending_reminder_sent_at: string | null;
  employee_dismissed_at?: string | null;
}

export interface ShiftConfirmationEvent {
  id: string;
  organization_id: string;
  shift_id: string;
  actor_id: string | null;
  from_status: ShiftConfirmationStatus | null;
  to_status: ShiftConfirmationStatus;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ConfirmationRequestBatch {
  id: string;
  organization_id: string;
  employee_id: string;
  sent_by: string;
  scope: ConfirmationRequestScope;
  week_start: string;
  week_end: string;
  is_delta: boolean;
  sent_at: string;
}

export interface ConfirmationRequestItem {
  id: string;
  batch_id: string;
  shift_id: string;
  snapshot: Record<string, unknown>;
  created_at: string;
}

export interface NotificationOutboxEntry {
  id: string;
  organization_id: string;
  recipient_profile_id: string;
  channel: NotificationOutboxChannel;
  template_key: string;
  payload: Record<string, unknown>;
  simulated: boolean;
  created_at: string;
}

export interface ManagerNotification {
  id: string;
  organization_id: string;
  recipient_profile_id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export type ConfirmationWeekItemStatus = "requested" | "pending";
export type ConfirmationDecision = "confirm" | "reject";

export interface ConfirmationWeekItem {
  shiftId: string;
  status: ConfirmationWeekItemStatus;
  shiftDate: string;
  startsAt: string;
  endsAt: string;
  locationName: string;
  areaName: string;
  templateName: string | null;
  jobName: string | null;
  disclaimer: string | null;
}

export interface ConfirmationWeekResponse {
  items: ConfirmationWeekItem[];
  organizationDisclaimer: string | null;
  /** Vom Admin stornierte Schichten — erscheinen in der Glocke/Anfragen-Liste. */
  canceledByManagerItems: EmployeeShiftCanceledNotificationItem[];
}

/** Storno-Hinweis für Mitarbeiter (Glocke / Anfragen-Tab). */
export interface EmployeeShiftCanceledNotificationItem {
  shiftId: string;
  shiftDate: string;
  startsAt: string;
  endsAt: string;
  canceledAt: string;
  locationName: string;
  areaName: string;
  templateName: string | null;
  title: string;
  message: string;
}

/** Anzeige-Metadaten für Mitarbeiter-Wochenplan (alle Schichten, nicht nur offene Bestätigungen). */
export interface EmployeeWeekShiftDisplayItem {
  shiftId: string;
  locationName: string;
  areaName: string;
  templateName: string | null;
  templateColor: string | null;
  jobName: string | null;
  /** Wer die Schicht abgesagt/storniert hat (nur bei bestätigter Absage). */
  cancelledBy?: ShiftRequestActorRole;
  /** MA-Absage wartet auf Bestätigung durch Admin/Manager. */
  cancellationPending?: boolean;
}

export interface ConfirmationRespondItem {
  shiftId: string;
  decision: ConfirmationDecision;
}

export interface ConfirmationRespondBody {
  items: ConfirmationRespondItem[];
}

export interface AbsenceRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  type: AbsenceType;
  start_date: string;
  end_date: string | null;
  is_open_ended: boolean;
  expected_end_date: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reported_by: string | null;
  notes: string | null;
  updated_at: string;
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

export interface SwapRequestWithShiftContext extends SwapRequest {
  shift_date: string;
  starts_at: string;
  ends_at: string;
  location_id: string | null;
  location_area_id: string | null;
  assignee_name: string;
  requester_name: string;
  target_name: string | null;
  shift_template_name: string | null;
}

export interface DashboardStats {
  shiftsToday: number;
  staffedToday: number;
  openSwaps: number;
  warnings: number;
}
