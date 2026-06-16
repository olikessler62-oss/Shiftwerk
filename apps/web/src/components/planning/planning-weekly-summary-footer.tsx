"use client";

import { cn } from "@/lib/cn";
import {
  PLANNING_DAY_FOOTER_ROW_HEIGHT,
  PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS,
} from "@/lib/planning-calendar-layout";
import { planningHoursUnitLabel } from "@/lib/planning-utils";
import type { PlanningWeeklySummary } from "@/lib/planning-utils";
import { formatTagAreaFooterMoney } from "@/lib/tag-area-footer-stats";

type Props = {
  summary: PlanningWeeklySummary;
  locale: string;
  gridRow: number;
  t: (key: string, params?: Record<string, string>) => string;
};

function WeeklySummaryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="shrink-0 whitespace-nowrap text-xs leading-none">
      <span className="text-muted">{label}: </span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}

export function PlanningWeeklySummaryFooter({
  summary,
  locale,
  gridRow,
  t,
}: Props) {
  const hoursUnit = planningHoursUnitLabel(locale);
  const intlLocale = locale === "en" ? "en" : "de";
  const costFormatted = formatTagAreaFooterMoney(
    summary.estimatedCost,
    intlLocale
  );

  return (
    <>
      <div
        className={cn(
          "sticky left-0 bottom-0 z-40 flex min-h-0 items-center border-t border-slate-400 bg-background px-2 py-0.5",
          PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS
        )}
        style={{
          gridColumn: 1,
          gridRow,
          height: PLANNING_DAY_FOOTER_ROW_HEIGHT,
        }}
      >
        <div className="flex flex-col leading-[1.1]">
          <span className="text-[10px] font-semibold text-foreground">
            {t("planning.weeklySummaryTitleLine1")}
          </span>
          <span className="text-[10px] font-semibold text-foreground">
            {t("planning.weeklySummaryTitleLine2")}
          </span>
        </div>
      </div>

      <div
        className="sticky bottom-0 z-40 flex min-h-0 items-center justify-between gap-3 overflow-hidden border-t border-slate-400 bg-background px-3 py-0.5"
        style={{
          gridColumn: "2 / -1",
          gridRow,
          height: PLANNING_DAY_FOOTER_ROW_HEIGHT,
        }}
      >
        <WeeklySummaryStat
          label={t("planning.weeklySummaryPlannedHours")}
          value={`${summary.plannedHours} ${hoursUnit}`}
        />
        <WeeklySummaryStat
          label={t("planning.weeklySummaryTargetHours")}
          value={`${summary.targetHours} ${hoursUnit}`}
        />
        <WeeklySummaryStat
          label={t("planning.weeklySummaryOpenShifts")}
          value={String(summary.openShifts)}
        />
        <WeeklySummaryStat
          label={t("planning.weeklySummaryEstimatedCost")}
          value={`${costFormatted} €`}
        />
      </div>
    </>
  );
}
