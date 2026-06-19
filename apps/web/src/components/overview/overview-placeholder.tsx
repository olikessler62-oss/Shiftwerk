"use client";

import { useTranslations } from "@/i18n/locale-provider";

type OverviewPageKey = "absences" | "compensation" | "availabilities";

type Props = {
  page: OverviewPageKey;
};

export function OverviewPlaceholder({ page }: Props) {
  const t = useTranslations();

  const titleKey =
    page === "absences"
      ? "nav.overviewAbsences"
      : page === "compensation"
        ? "nav.overviewCompensation"
        : "nav.overviewAvailabilities";

  const descriptionKey =
    page === "absences"
      ? "overview.absencesDescription"
      : page === "compensation"
        ? "overview.compensationDescription"
        : "overview.availabilitiesDescription";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">{t(titleKey)}</h1>
      <p className="mt-2 text-sm text-muted">{t(descriptionKey)}</p>
    </div>
  );
}
