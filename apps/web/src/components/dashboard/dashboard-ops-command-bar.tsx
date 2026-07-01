"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  DASHBOARD_PANEL_ROUNDED_CLASS,
} from "@/lib/dashboard-panel-styles";
import { CALENDAR_DAY_HEADER_ACTIVE_CLASS } from "@/lib/calendar-day-header-styles";
import type { DashboardExtPanelSnapshot } from "@/lib/dashboard-ext-panel-data";

function computeWeekHealthScore(
  rollup: DashboardExtPanelSnapshot["rollup"],
  issueCount: number
): number {
  if (rollup.requiredTotal === 0 && issueCount === 0) return 100;
  const coverage =
    rollup.requiredTotal > 0
      ? (rollup.assignedTotal / rollup.requiredTotal) * 100
      : 100;
  const penalty = rollup.criticalAreaCount * 12 + rollup.openSlots * 3 + issueCount * 2;
  return Math.max(0, Math.min(100, Math.round(coverage - penalty)));
}

function healthTone(score: number): "good" | "watch" | "critical" {
  if (score >= 85) return "good";
  if (score >= 60) return "watch";
  return "critical";
}

const HEALTH_RING_COLOR = {
  good: "#059669",
  watch: "#CA8A04",
  critical: "#dc2626",
} as const;

function HealthRing({
  score,
  label,
  toneLabel,
  tone,
}: {
  score: number;
  label: string;
  toneLabel: string;
  tone: "good" | "watch" | "critical";
}) {
  const circumference = 2 * Math.PI * 34;
  const offset = circumference - (score / 100) * circumference;
  const color = HEALTH_RING_COLOR[tone];

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80" aria-hidden>
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="rgba(15,23,42,0.08)"
            strokeWidth="7"
          />
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="text-center">
          <span className="text-lg font-bold tabular-nums leading-none text-foreground">
            {score}
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#273b55]/70">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 text-sm font-semibold",
            tone === "good" && "text-emerald-800",
            tone === "watch" && "text-[#92400e]",
            tone === "critical" && "text-red-800"
          )}
        >
          {toneLabel}
        </p>
      </div>
    </div>
  );
}

type Props = {
  snapshot: DashboardExtPanelSnapshot;
  issueCount: number;
  className?: string;
};

export function DashboardOpsCommandBar({ snapshot, issueCount, className }: Props) {
  const t = useTranslations();
  const { rollup } = snapshot;
  const score = computeWeekHealthScore(rollup, issueCount);
  const tone = healthTone(score);
  const toneLabel =
    tone === "good"
      ? t("dashboard.opsHealthGood")
      : tone === "watch"
        ? t("dashboard.opsHealthWatch")
        : t("dashboard.opsHealthCritical");

  const coveragePercent =
    rollup.requiredTotal > 0
      ? Math.round((rollup.assignedTotal / rollup.requiredTotal) * 100)
      : null;

  return (
    <section
      className={cn(
        "overflow-hidden border border-black/15 shadow-sm",
        DASHBOARD_PANEL_ROUNDED_CLASS,
        CALENDAR_DAY_HEADER_ACTIVE_CLASS,
        className
      )}
    >
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <HealthRing
            score={score}
            label={t("dashboard.opsHealthLabel")}
            toneLabel={toneLabel}
            tone={tone}
          />
          <div className="hidden h-10 w-px bg-black/10 sm:block" aria-hidden />
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {snapshot.staffingEnabled ? (
              <>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#273b55]/60">
                    {t("dashboard.opsWeekCoverage")}
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-[#273b55]">
                    {coveragePercent != null ? `${coveragePercent}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#273b55]/60">
                    {t("dashboard.kpiStaffingDemand")}
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-[#273b55]">
                    {rollup.requiredTotal > 0
                      ? `${rollup.assignedTotal}/${rollup.requiredTotal}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#273b55]/60">
                    {t("dashboard.opsOpenSlotsWeek")}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-lg font-bold tabular-nums",
                      rollup.openSlots > 0 ? "text-red-800" : "text-[#273b55]"
                    )}
                  >
                    {rollup.openSlots}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#273b55]/60">
                    {t("dashboard.opsCriticalAreas")}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-lg font-bold tabular-nums",
                      rollup.criticalAreaCount > 0 ? "text-red-800" : "text-[#273b55]"
                    )}
                  >
                    {rollup.criticalAreaCount}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
