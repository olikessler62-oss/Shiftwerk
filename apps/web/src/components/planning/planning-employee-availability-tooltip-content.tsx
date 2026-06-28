"use client";

import type { ProfileRecurringAvailability } from "@schichtwerk/types";

import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { buildPlanningEmployeeAvailabilityTooltipRows } from "@/lib/planning-employee-availability-tooltip";
import type { EmployeeWeeklyHoursDisplay } from "@/lib/employee-weekly-hours-display";
import { EmployeeWeeklyHoursLines } from "@/components/planning/employee-weekly-hours-lines";

type Props = {
  slots: readonly ProfileRecurringAvailability[];
  employeeName: string;
  locale: "de" | "en";
  emptyLabel: string;
  jobsLabel?: string;
  weeklyHoursDisplay?: EmployeeWeeklyHoursDisplay | null;
  weeklyHoursTotalLabel?: string;
  className?: string;
};

export function PlanningEmployeeAvailabilityTooltipContent({
  slots,
  employeeName,
  locale,
  emptyLabel,
  jobsLabel,
  weeklyHoursDisplay,
  weeklyHoursTotalLabel,
  className,
}: Props) {
  const t = useTranslations();
  const rows = buildPlanningEmployeeAvailabilityTooltipRows(slots, locale);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-1.5 border-b border-border/60 pb-1.5 text-xs font-semibold text-foreground">
        <span className="block">{t("profiles.panelAvailabilityOfLead")}</span>
        <span className="block">{employeeName}</span>
      </div>
      {rows.length === 0 ? (
        <span>{emptyLabel}</span>
      ) : (
        <table className="border-collapse">
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.weekday}-${row.timeRange}-${index}`}>
                <td className="whitespace-nowrap pr-4 align-top">{row.weekday}</td>
                <td className="whitespace-nowrap align-top tabular-nums">
                  {row.timeRange}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {jobsLabel !== undefined ? (
        <p className="mt-3 text-xs text-foreground">
          {t("profiles.panelQualificationsOfPrefix")}{" "}
          {jobsLabel.trim() || t("profiles.emptyQualifications")}
        </p>
      ) : null}
      {weeklyHoursDisplay && weeklyHoursDisplay.lines.length > 0 ? (
        <>
          <p className="mb-1.5 mt-3 text-xs font-semibold text-foreground">
            {t("dashboard.staffingCandidatesTooltipWeeklyHours")}
          </p>
          <EmployeeWeeklyHoursLines
            display={weeklyHoursDisplay}
            locale={locale}
            totalLabel={weeklyHoursTotalLabel ?? t("dashboard.weeklyHoursTotalLabel")}
            className="text-xs text-foreground"
          />
        </>
      ) : null}
    </div>
  );
}
