"use client";

import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useShowCompensationInPlanningUi } from "@/lib/org-features-provider";
import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";
import type { DashboardLocationWeekRollup } from "@/lib/dashboard-area-week-stats";
import { formatTagAreaFooterMoney } from "@/lib/tag-area-footer-stats";
import { formatDurationHours } from "@/lib/shift-type-display";

type Props = {
  rollup: DashboardLocationWeekRollup;
  staffingEnabled: boolean;
  className?: string;
};

const KPI_TILE_CLASS =
  "flex min-h-[clamp(3.25rem,7dvh,4.25rem)] min-w-0 items-center px-4 py-[clamp(0.375rem,1.25dvh,0.875rem)]";

const KPI_TILE_CONTENT_CLASS =
  "flex w-full min-w-0 flex-col justify-center gap-0.5 leading-snug [font-size:clamp(0.6875rem,0.2rem+0.85dvh,0.75rem)]";

const KPI_TILE_VALUE_CLASS =
  "block font-semibold tabular-nums leading-none text-foreground [font-size:clamp(1rem,0.45rem+1.35dvh,1.25rem)]";

function KpiTile({
  label,
  value,
  subline,
  className,
}: {
  label: string;
  value: string;
  subline?: string;
  className?: string;
}) {
  return (
    <div className={cn(KPI_TILE_CLASS, className)}>
      <div className={KPI_TILE_CONTENT_CLASS}>
        <span className="font-medium text-muted">{label}</span>
        <div className="min-w-0 space-y-0.5">
          <span className={KPI_TILE_VALUE_CLASS}>{value}</span>
          {subline ? (
            <span className="block text-muted">{subline}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DashboardLocationKpiStrip({
  rollup,
  staffingEnabled,
  className,
}: Props) {
  const t = useTranslations();
  const showCompensationInPlanningUi = useShowCompensationInPlanningUi();
  const { locale } = useLocale();
  const intlLocale = locale === "en" ? "en" : "de";
  const money = (amount: number) =>
    `${formatTagAreaFooterMoney(amount, intlLocale)} €`;

  const coveragePercent =
    rollup.requiredTotal > 0
      ? Math.round((rollup.assignedTotal / rollup.requiredTotal) * 100)
      : null;

  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden border border-border bg-surface shadow-sm",
        DASHBOARD_PANEL_ROUNDED_CLASS,
        className
      )}
      aria-label={t("dashboard.kpiStaffingDemand")}
    >
      <div
        className={cn(
          "grid divide-y divide-border/70 sm:divide-x sm:divide-y-0",
          staffingEnabled ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"
        )}
      >
        {staffingEnabled ? (
          <KpiTile
            label={t("dashboard.kpiStaffingDemand")}
            value={
              rollup.requiredTotal > 0
                ? `${rollup.assignedTotal}/${rollup.requiredTotal}`
                : "—"
            }
            subline={
              coveragePercent != null
                ? t("dashboard.kpiStaffingCoveragePercent", {
                    percent: String(coveragePercent),
                  })
                : undefined
            }
          />
        ) : null}
        {staffingEnabled ? (
          <KpiTile
            label={t("dashboard.kpiOpenSlots")}
            value={String(rollup.openSlots)}
            subline={
              rollup.criticalAreaCount > 0
                ? rollup.criticalAreaCount === 1
                  ? t("dashboard.kpiCriticalAreasOne")
                  : t("dashboard.kpiCriticalAreasMany", {
                      count: rollup.criticalAreaCount,
                    })
                : undefined
            }
            className={
              rollup.criticalAreaCount > 0 ? "bg-red-50/50 sm:bg-red-50/40" : undefined
            }
          />
        ) : null}
        {showCompensationInPlanningUi ? (
          <>
            <KpiTile
              label={t("dashboard.kpiTotalCost")}
              value={
                rollup.hasCompensation
                  ? money(rollup.totalCost)
                  : t("dashboard.ampelCompensationIncomplete")
              }
              subline={
                rollup.hasCompensation
                  ? t("dashboard.ampelHours", {
                      hours: formatDurationHours(rollup.totalHours),
                    })
                  : undefined
              }
            />
            <KpiTile
              label={t("dashboard.kpiSurcharges")}
              value={
                rollup.hasCompensation && rollup.surchargeCost > 0
                  ? money(rollup.surchargeCost)
                  : rollup.hasCompensation
                    ? money(0)
                    : "—"
              }
              subline={
                rollup.hasCompensation
                  ? t("dashboard.kpiBaseCompensation", {
                      amount: money(rollup.baseCost),
                    })
                  : undefined
              }
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
