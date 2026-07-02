"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { PlanningPageLoadingProgressBarTrack } from "@/components/planning/planning-page-loading-progress-bar-track";

type Props = {
  ariaLabel?: string;
};

export function PlanningPageLoadingProgressBar({ ariaLabel }: Props) {
  const t = useTranslations();

  return (
    <PlanningPageLoadingProgressBarTrack
      ariaLabel={ariaLabel ?? t("common.loading")}
    />
  );
}
