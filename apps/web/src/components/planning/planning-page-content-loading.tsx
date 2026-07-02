"use client";

import { useBodyWaitCursor } from "@/lib/use-body-wait-cursor";
import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";
import { useTranslations } from "@/i18n/locale-provider";
import { PlanningPageLoadingProgressBarTrack } from "@/components/planning/planning-page-loading-progress-bar-track";

type Props = {
  className?: string;
  showSkeleton?: boolean;
  waitCursor?: boolean;
};

/** Ladezustand im Planungs-Content (Fortschrittsbalken + optional Skeleton). */
export function PlanningPageContentLoading({
  className,
  showSkeleton = true,
  waitCursor = true,
}: Props) {
  const t = useTranslations();
  useBodyWaitCursor(waitCursor);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col",
        waitCursor && "cursor-wait [&_*]:cursor-wait",
        className
      )}
      aria-busy="true"
      aria-live="polite"
      aria-label={t("common.loading")}
    >
      <PlanningPageLoadingProgressBarTrack ariaLabel={t("common.loading")} />
      {showSkeleton ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3 md:pt-4">
          <div
            className={cn(
              "h-10 w-full max-w-md animate-pulse bg-muted/60",
              DASHBOARD_PANEL_ROUNDED_CLASS
            )}
          />
          <div
            className={cn(
              "min-h-[320px] flex-1 animate-pulse bg-muted/50 md:min-h-[480px]",
              DASHBOARD_PANEL_ROUNDED_CLASS
            )}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1" aria-hidden />
      )}
    </div>
  );
}
