"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import type { Location } from "@schichtwerk/types";
import { HeaderPillSelect } from "@/components/ui/header-placement-select";
import { useTranslations } from "@/i18n/locale-provider";
import { Select } from "@/components/ui";
import { cn } from "@/lib/cn";

type Props = {
  locations: Location[];
  selectedLocationId: string | null;
  className?: string;
  basePath?: string;
  variant?: "default" | "header";
};

export function LocationSelect({
  locations,
  selectedLocationId,
  className,
  basePath,
  variant = "default",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const resolvedBasePath = basePath ?? pathname;
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  const locationOptions = useMemo(
    () =>
      locations.map((loc) => ({
        value: loc.id,
        label: loc.archived_at
          ? `${loc.name} (${t("common.archived")})`
          : loc.name,
      })),
    [locations, t]
  );

  function onChange(locationId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("location", locationId);
    startTransition(() => {
      router.push(`${resolvedBasePath}?${params.toString()}`);
    });
  }

  if (locations.length === 0) {
    return (
      <p className={cn(variant === "header" ? "text-xs" : "mt-1 text-sm", "text-muted")}>
        {t("dashboard.noLocations")}
      </p>
    );
  }

  if (variant === "header") {
    return (
      <HeaderPillSelect
        value={selectedLocationId ?? locations[0].id}
        options={locationOptions}
        disabled={pending || locations.length === 0}
        onChange={onChange}
        aria-label={t("dashboard.selectLocation")}
        triggerClassName={className}
        wrapperClassName="max-w-[10rem] sm:max-w-[12rem]"
      />
    );
  }

  return (
    <Select
      value={selectedLocationId ?? locations[0].id}
      disabled={pending || locations.length === 0}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t("dashboard.selectLocation")}
      className={cn("mt-1 min-w-0 max-w-full w-full", className)}
    >
      {locations.map((loc) => (
        <option key={loc.id} value={loc.id}>
          {loc.name}
          {loc.archived_at ? ` (${t("common.archived")})` : ""}
        </option>
      ))}
    </Select>
  );
}
