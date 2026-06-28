"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import type { RefObject } from "react";
import type { Location, LocationArea } from "@schichtwerk/types";
import { HeaderPillSelect } from "@/components/ui/header-placement-select";
import { useTranslations } from "@/i18n/locale-provider";
import { headerToolbarPlacementSelectTriggerClass } from "@/lib/header-toolbar-styles";
import { cn } from "@/lib/cn";
import { writePlanningLocationCookie } from "@/lib/planning-location-preference";
import { shouldShowLocationInPlanningUi } from "@/lib/planning-location-ui";

type Props = {
  locations: Location[];
  selectedLocationId: string | null;
  areas: LocationArea[];
  selectedAreaId: string | null;
  disabled?: boolean;
  className?: string;
  onAreaChange: (areaId: string) => void;
  locationMeasureRef?: RefObject<HTMLDivElement | null>;
  areaMeasureRef?: RefObject<HTMLDivElement | null>;
  /** Vollzeile, oder einzelnes Control für Shade-Overlays. */
  presentation?: "full" | "locationOnly" | "areaOnly";
  /** Standortauswahl nur bei mehr als einem Standort. */
  showLocationSelect?: boolean;
};

export function DashboardHeaderPlacement({
  locations,
  selectedLocationId,
  areas,
  selectedAreaId,
  disabled = false,
  className,
  onAreaChange,
  locationMeasureRef,
  areaMeasureRef,
  presentation = "full",
  showLocationSelect,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [locationPending, startLocationTransition] = useTransition();

  const locationOptions = useMemo(
    () =>
      locations.map((location) => ({
        value: location.id,
        label: location.archived_at
          ? `${location.name} (${t("common.archived")})`
          : location.name,
      })),
    [locations, t]
  );

  const areaOptions = useMemo(
    () =>
      areas.map((area) => ({
        value: area.id,
        label: area.archived_at
          ? `${area.name} (${t("common.archived")})`
          : area.name,
      })),
    [areas, t]
  );

  function onLocationChange(locationId: string) {
    writePlanningLocationCookie(locationId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("location", locationId);
    startLocationTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  if (locations.length === 0) {
    return (
      <p className={cn("text-xs text-muted", className)}>
        {t("areaCalendar.noLocations")}
      </p>
    );
  }

  const controlsDisabled = disabled || locationPending;
  const showLocation =
    showLocationSelect ?? shouldShowLocationInPlanningUi(locations.length);

  const locationSelect = showLocation ? (
    <HeaderPillSelect
      value={selectedLocationId ?? locations[0].id}
      options={locationOptions}
      disabled={controlsDisabled}
      onChange={onLocationChange}
      aria-label={t("areaCalendar.selectLocation")}
      selectClassName={headerToolbarPlacementSelectTriggerClass}
      wrapperClassName="max-w-[10rem] sm:max-w-[12rem]"
    />
  ) : null;

  const areaSelect =
    areas.length === 0 ? null : (
      <HeaderPillSelect
        value={selectedAreaId ?? areas[0].id}
        options={areaOptions}
        disabled={controlsDisabled || areas.length === 0}
        onChange={onAreaChange}
        aria-label={t("dashboard.selectArea")}
        selectClassName={headerToolbarPlacementSelectTriggerClass}
        wrapperClassName="max-w-[9rem] sm:max-w-[11rem]"
      />
    );

  if (presentation === "locationOnly") {
    if (!locationSelect) return null;
    return (
      <div ref={locationMeasureRef} className={cn("shrink-0", className)}>
        {locationSelect}
      </div>
    );
  }

  if (presentation === "areaOnly") {
    if (!areaSelect) {
      return (
        <span className={cn("truncate text-xs text-muted", className)}>
          {t("dashboard.noAreas")}
        </span>
      );
    }
    return (
      <div ref={areaMeasureRef} className={cn("shrink-0", className)}>
        {areaSelect}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2",
        className
      )}
    >
      {locationSelect ? (
        <>
          <div ref={locationMeasureRef} className="shrink-0">
            {locationSelect}
          </div>

          <span className="select-none text-sm text-muted/40" aria-hidden>
            /
          </span>
        </>
      ) : null}

      {areaSelect ? (
        <div ref={areaMeasureRef} className="shrink-0">
          {areaSelect}
        </div>
      ) : (
        <span className="truncate text-xs text-muted">{t("dashboard.noAreas")}</span>
      )}
    </div>
  );
}
