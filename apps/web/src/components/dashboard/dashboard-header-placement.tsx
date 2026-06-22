"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import type { Location, LocationArea } from "@schichtwerk/types";
import { HeaderPillSelect } from "@/components/ui/header-placement-select";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { writePlanningLocationCookie } from "@/lib/planning-location-preference";

type Props = {
  locations: Location[];
  selectedLocationId: string | null;
  areas: LocationArea[];
  selectedAreaId: string | null;
  disabled?: boolean;
  className?: string;
  onAreaChange: (areaId: string) => void;
};

export function DashboardHeaderPlacement({
  locations,
  selectedLocationId,
  areas,
  selectedAreaId,
  disabled = false,
  className,
  onAreaChange,
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

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2",
        className
      )}
    >
      <HeaderPillSelect
        value={selectedLocationId ?? locations[0].id}
        options={locationOptions}
        disabled={controlsDisabled}
        onChange={onLocationChange}
        aria-label={t("areaCalendar.selectLocation")}
        wrapperClassName="max-w-[10rem] sm:max-w-[12rem]"
      />

      <span className="select-none text-sm text-muted/40" aria-hidden>
        /
      </span>

      {areas.length === 0 ? (
        <span className="truncate text-xs text-muted">{t("dashboard.noAreas")}</span>
      ) : (
        <HeaderPillSelect
          value={selectedAreaId ?? areas[0].id}
          options={areaOptions}
          disabled={controlsDisabled || areas.length === 0}
          onChange={onAreaChange}
          aria-label={t("dashboard.selectArea")}
          wrapperClassName="max-w-[9rem] sm:max-w-[11rem]"
        />
      )}
    </div>
  );
}
