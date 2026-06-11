"use client";

import type {
  AreaQualificationTemplateEntry,
  AreaShiftTemplateWithBreaks,
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
} from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { SettingsActionRow } from "./settings-list-ui";

type DetailPanel =
  | "qualificationTemplates"
  | "serviceHours"
  | "staffing"
  | "shiftTemplates";

type Props = {
  selectedLocation: Location | null;
  selectedArea: LocationArea | null;
  /** Geladen: [] = keine Servicezeiten; undefined = noch nicht geladen */
  serviceHours?: LocationAreaServiceHour[];
  /** Geladen: [] = kein Personalbedarf; undefined = noch nicht geladen */
  staffing?: LocationAreaStaffing[];
  /** Geladen: [] = keine Schichtvorlagen; undefined = noch nicht geladen */
  shiftTemplates?: AreaShiftTemplateWithBreaks[];
  /** Geladen: [] = keine Funktionsvorlagen; undefined = noch nicht geladen */
  qualificationTemplates?: AreaQualificationTemplateEntry[];
  disabled?: boolean;
  onOpen: (panel: DetailPanel) => void;
};

function configuredHint(text: string) {
  return (
    <span className="block truncate text-xs text-primary">
      {text}
    </span>
  );
}

function ServiceHoursIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function StaffingIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 11h-6M19 8v6" />
    </svg>
  );
}

function QualificationTemplateIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function ShiftTemplateIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}

export function LocationDetailActions({
  selectedLocation,
  selectedArea,
  serviceHours,
  staffing,
  shiftTemplates,
  qualificationTemplates,
  disabled = false,
  onOpen,
}: Props) {
  const t = useTranslations();
  const areaActionsDisabled = disabled || !selectedLocation || !selectedArea;
  const serviceHoursLoaded = serviceHours !== undefined;
  const staffingLoaded = staffing !== undefined;
  const shiftTemplatesLoaded = shiftTemplates !== undefined;
  const qualificationTemplatesLoaded = qualificationTemplates !== undefined;
  const hasServiceHours = serviceHoursLoaded && serviceHours.length > 0;
  const hasStaffing =
    staffingLoaded &&
    staffing.some((rule) => rule.required_count > 0);
  const hasShiftTemplates =
    shiftTemplatesLoaded && (shiftTemplates?.length ?? 0) > 0;
  const serviceHoursHint = !serviceHoursLoaded
    ? null
    : hasServiceHours
      ? configuredHint(t("locations.actionServiceHoursConfigured"))
      : t("locations.actionServiceHoursHint");
  const staffingHint = !staffingLoaded
    ? null
    : hasStaffing
      ? configuredHint(t("locations.actionStaffingHint"))
      : t("locations.actionStaffingHint");
  const shiftTemplatesHint = !shiftTemplatesLoaded
    ? null
    : hasShiftTemplates
      ? configuredHint(t("locations.actionShiftTemplatesConfigured"))
      : t("locations.actionShiftTemplatesHint");
  const hasQualificationTemplates =
    qualificationTemplatesLoaded && (qualificationTemplates?.length ?? 0) > 0;
  const qualificationTemplatesHint = !qualificationTemplatesLoaded
    ? null
    : hasQualificationTemplates
      ? configuredHint(t("locations.actionQualificationTemplatesConfigured"))
      : t("locations.actionQualificationTemplatesHint");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 pt-2">
      {!selectedArea ? (
        <p className="rounded-lg border border-dashed border-border bg-background px-3 py-6 text-center text-sm text-muted">
          {t("locations.selectAreaHint")}
        </p>
      ) : null}

      <div
        className={cn(
          "rounded-lg border border-border/80 bg-background px-1 py-1",
          !selectedArea && "mt-2"
        )}
      >
        <SettingsActionRow
          icon={<QualificationTemplateIcon />}
          label={t("locations.panelQualificationTemplates")}
          hint={qualificationTemplatesHint}
          disabled={areaActionsDisabled}
          onClick={() => onOpen("qualificationTemplates")}
        />
        <div className="mx-2 border-t border-border/60" />
        <SettingsActionRow
          icon={<ShiftTemplateIcon />}
          label={t("locations.panelShiftTemplates")}
          hint={shiftTemplatesHint}
          disabled={areaActionsDisabled}
          onClick={() => onOpen("shiftTemplates")}
        />
        <div className="mx-2 border-t border-border/60" />
        <SettingsActionRow
          icon={<ServiceHoursIcon />}
          label={t("locations.panelServiceHours")}
          hint={serviceHoursHint}
          disabled={areaActionsDisabled}
          onClick={() => onOpen("serviceHours")}
        />
        <div className="mx-2 border-t border-border/60" />
        <SettingsActionRow
          icon={<StaffingIcon />}
          label={t("locations.panelStaffing")}
          hint={staffingHint}
          disabled={areaActionsDisabled}
          onClick={() => onOpen("staffing")}
        />
      </div>
    </div>
  );
}
