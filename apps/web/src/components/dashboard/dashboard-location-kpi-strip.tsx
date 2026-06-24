"use client";

import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import type { DashboardLocationWeekRollup } from "@/lib/dashboard-area-week-stats";
import { formatTagAreaFooterMoney } from "@/lib/tag-area-footer-stats";
import { formatDurationHours } from "@/lib/shift-type-display";

type Props = {
  rollup: DashboardLocationWeekRollup;
  staffingEnabled: boolean;
};

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
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-surface px-3 py-2.5",
        className
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums leading-tight text-foreground">
        {value}
      </span>
      {subline ? (
        <span className="text-[11px] text-muted">{subline}</span>
      ) : null}
    </div>
  );
}

export function DashboardLocationKpiStrip({ rollup, staffingEnabled }: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = locale === "en" ? "en" : "de";
  const money = (amount: number) =>
    `${formatTagAreaFooterMoney(amount, intlLocale)} €`;

  const coveragePercent =
    rollup.requiredTotal > 0
      ? Math.round((rollup.assignedTotal / rollup.requiredTotal) * 100)
      : null;

  return (
    <div
      className={cn(
        "grid gap-3",
        staffingEnabled ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"
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
          className={rollup.criticalAreaCount > 0 ? "border-red-200 bg-red-50/40" : undefined}
        />
      ) : null}
      <KpiTile
        label={t("dashboard.kpiTotalCost")}
        value={
          rollup.hasCompensation ? money(rollup.totalCost) : t("dashboard.ampelCompensationIncomplete")
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
    </div>
  );
}
