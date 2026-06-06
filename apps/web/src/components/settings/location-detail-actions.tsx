"use client";

import type { Location, LocationArea } from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { SettingsActionRow } from "./settings-list-ui";

type DetailPanel = "serviceHours" | "staffing";

type Props = {
  selectedLocation: Location | null;
  selectedArea: LocationArea | null;
  disabled?: boolean;
  onOpen: (panel: DetailPanel) => void;
};

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

function AreaSummary({
  location,
  area,
}: {
  location: Location;
  area: LocationArea;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-background px-3 py-3">
      <p className="min-w-0 truncate text-sm font-semibold text-foreground">
        {area.name}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted">{location.name}</p>
    </div>
  );
}

export function LocationDetailActions({
  selectedLocation,
  selectedArea,
  disabled = false,
  onOpen,
}: Props) {
  const t = useTranslations();
  const areaActionsDisabled = disabled || !selectedLocation || !selectedArea;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 pt-2">
      {selectedLocation && selectedArea ? (
        <AreaSummary location={selectedLocation} area={selectedArea} />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-background px-3 py-6 text-center text-sm text-muted">
          {t("locations.selectAreaHint")}
        </p>
      )}

      <div className="mt-2 rounded-lg border border-border/80 bg-background px-1 py-1">
        <SettingsActionRow
          icon={<ServiceHoursIcon />}
          label={t("locations.panelServiceHours")}
          hint={t("locations.actionServiceHoursHint")}
          disabled={areaActionsDisabled}
          onClick={() => onOpen("serviceHours")}
        />
        <div className="mx-2 border-t border-border/60" />
        <SettingsActionRow
          icon={<StaffingIcon />}
          label={t("locations.panelStaffing")}
          hint={t("locations.actionStaffingHint")}
          disabled={areaActionsDisabled}
          onClick={() => onOpen("staffing")}
        />
      </div>
    </div>
  );
}
