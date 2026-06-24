"use client";

import Link from "next/link";
import { StaffingFillGauge } from "@/components/areacalendar/staffing-fill-gauge";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import type { DashboardAreaWeekStats } from "@/lib/dashboard-area-week-stats";
import { formatTagAreaFooterMoney } from "@/lib/tag-area-footer-stats";
import { formatDurationHours } from "@/lib/shift-type-display";

const DASHBOARD_AMPel_GAUGE_SIZE_PX = 48;

type Props = {
  stats: DashboardAreaWeekStats;
  staffingEnabled: boolean;
  areaCalendarHref: string;
  employeeCalendarHref: string;
};

function NoDemandGauge() {
  const radius = (DASHBOARD_AMPel_GAUGE_SIZE_PX - 2.5) / 2;
  const center = DASHBOARD_AMPel_GAUGE_SIZE_PX / 2;

  return (
    <div
      className="relative shrink-0"
      style={{
        width: DASHBOARD_AMPel_GAUGE_SIZE_PX,
        height: DASHBOARD_AMPel_GAUGE_SIZE_PX,
      }}
      aria-hidden
    >
      <svg
        width={DASHBOARD_AMPel_GAUGE_SIZE_PX}
        height={DASHBOARD_AMPel_GAUGE_SIZE_PX}
        className="block -rotate-90"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth={2.5}
        />
      </svg>
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-muted"
      >
        —
      </span>
    </div>
  );
}

export function DashboardAreaAmpelCard({
  stats,
  staffingEnabled,
  areaCalendarHref,
  employeeCalendarHref,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = locale === "en" ? "en" : "de";

  const statusLabel = (() => {
    if (!staffingEnabled || stats.ampelLevel === "no_demand") {
      return t("dashboard.ampelStatusNoDemand");
    }
    switch (stats.ampelLevel) {
      case "met":
        return t("dashboard.ampelStatusCovered");
      case "overstaffed_only":
        return t("dashboard.ampelStatusOverstaffed");
      case "partial":
        return t("dashboard.ampelStatusOpenSlots", { count: stats.openSlots });
      case "critical":
        return t("dashboard.ampelStatusCritical", { count: stats.openSlots });
    }
  })();

  const money = (amount: number) =>
    `${formatTagAreaFooterMoney(amount, intlLocale)} €`;

  return (
    <article
      className="flex min-w-0 flex-col rounded-xl border border-border bg-surface shadow-sm"
    >
      <Link
        href={areaCalendarHref}
        className="flex min-w-0 flex-1 flex-col items-center gap-3 px-4 pb-3 pt-4 transition hover:bg-primary/5"
      >
        <h2 className="w-full truncate text-center text-sm font-semibold text-foreground">
          {stats.areaName}
        </h2>

        {staffingEnabled && stats.ampelLevel !== "no_demand" ? (
          <StaffingFillGauge
            assigned={stats.assignedTotal}
            required={stats.requiredTotal}
            variant={stats.gaugeVariant}
            sizePx={DASHBOARD_AMPel_GAUGE_SIZE_PX}
          />
        ) : staffingEnabled ? (
          <NoDemandGauge />
        ) : null}

        {staffingEnabled ? (
          <div className="flex w-full flex-col items-center gap-0.5 text-center">
            {stats.requiredTotal > 0 ? (
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {stats.assignedTotal}/{stats.requiredTotal}
              </p>
            ) : null}
            <p
              className={cn(
                "text-xs font-medium",
                stats.ampelLevel === "critical" && "text-red-600",
                stats.ampelLevel === "partial" && "text-amber-700",
                stats.ampelLevel === "met" && "text-emerald-700",
                stats.ampelLevel === "overstaffed_only" && "text-amber-700",
                stats.ampelLevel === "no_demand" && "text-muted"
              )}
            >
              {statusLabel}
            </p>
            {stats.criticalWindowLabel ? (
              <p className="max-w-full truncate text-[11px] text-muted">
                {stats.criticalWindowLabel}
              </p>
            ) : null}
            {stats.hasAssignmentMismatch ? (
              <p className="text-[11px] font-medium text-amber-700">
                {t("dashboard.ampelQualificationMismatch")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted">
          <span>
            {t("dashboard.ampelHours", {
              hours: formatDurationHours(stats.totalHours),
            })}
          </span>
          {stats.hasCompensation ? (
            <>
              <span>{money(stats.baseCost)}</span>
              {stats.surchargeCost > 0 ? (
                <span>
                  +{money(stats.surchargeCost)} {t("dashboard.ampelSurchargesShort")}
                </span>
              ) : null}
            </>
          ) : (
            <span>{t("dashboard.ampelCompensationIncomplete")}</span>
          )}
        </div>
      </Link>

      <footer className="flex items-center justify-center gap-2 border-t border-border px-3 py-2">
        <Link
          href={areaCalendarHref}
          className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          {t("nav.areaCalendar")}
        </Link>
        <span className="text-muted" aria-hidden>·</span>
        <Link
          href={employeeCalendarHref}
          className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          {t("nav.employeeCalendar")}
        </Link>
      </footer>
    </article>
  );
}
