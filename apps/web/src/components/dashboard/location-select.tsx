"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Location } from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { Select } from "@/components/ui";
import { cn } from "@/lib/cn";

type Props = {
  locations: Location[];
  selectedLocationId: string | null;
  className?: string;
  basePath?: string;
};

export function LocationSelect({
  locations,
  selectedLocationId,
  className,
  basePath = "/dashboard",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  function onChange(locationId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("location", locationId);
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`);
    });
  }

  if (locations.length === 0) {
    return (
      <p className="mt-1 text-sm text-muted">{t("dashboard.noLocations")}</p>
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
