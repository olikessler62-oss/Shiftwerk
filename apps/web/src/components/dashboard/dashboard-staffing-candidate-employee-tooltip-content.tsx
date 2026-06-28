"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Qualification } from "@schichtwerk/types";
import type { DashboardStaffingCandidateEmployeeTooltipPayload } from "@/lib/dashboard-staffing-candidate-employee-tooltip";
import {
  formatDashboardStaffingCandidateEmployeeTooltipSections,
  type DashboardStaffingCandidateEmployeeTooltipSections,
} from "@/lib/dashboard-staffing-candidate-employee-tooltip";
import { absenceTypeLabelKey } from "@/lib/shift-absence-conflict";
import { useTranslations, useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import type { EmployeeWeeklyHoursDisplay } from "@/lib/employee-weekly-hours-display";
import { EmployeeWeeklyHoursLines } from "@/components/planning/employee-weekly-hours-lines";

type Props = {
  employeeName: string;
  payload: DashboardStaffingCandidateEmployeeTooltipPayload | null;
  loading: boolean;
  error: boolean;
  qualifications: readonly Qualification[];
  weeklyHoursDisplay?: EmployeeWeeklyHoursDisplay | null;
  className?: string;
};

function TooltipSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <div className="mt-0.5 text-muted-foreground">{children}</div>
    </div>
  );
}

function WishLines({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) {
    return <span>—</span>;
  }
  return (
    <ul className="space-y-0.5">
      {lines.map((line, index) => (
        <li key={`${line}:${index}`}>{line}</li>
      ))}
    </ul>
  );
}

function TooltipBody({
  sections,
  emptyAvailabilityLabel,
  weeklyHoursLabel,
  weeklyHoursDisplay,
  weeklyHoursTotalLabel,
  locale,
}: {
  sections: DashboardStaffingCandidateEmployeeTooltipSections & {
    absenceLabel: string;
    availabilityLabel: string;
    jobsLabel: string;
    wishTimeLabel: string;
    wishLocationLabel: string;
    wishAreaLabel: string;
  };
  emptyAvailabilityLabel: string;
  weeklyHoursLabel: string;
  weeklyHoursDisplay?: EmployeeWeeklyHoursDisplay | null;
  weeklyHoursTotalLabel: string;
  locale: string;
}) {
  return (
    <div className="space-y-2.5">
      <TooltipSection label={sections.absenceLabel}>
        {sections.absence}
      </TooltipSection>
      <TooltipSection label={sections.availabilityLabel}>
        {sections.availabilityLines.length === 0 ? (
          <span>{emptyAvailabilityLabel}</span>
        ) : (
          <table className="border-collapse">
            <tbody>
              {sections.availabilityLines.map((line, index) => (
                <tr key={`${line}:${index}`}>
                  <td className="whitespace-nowrap pr-3 align-top">
                    {line.weekday}
                  </td>
                  <td className="whitespace-nowrap align-top tabular-nums">
                    {line.timeRange}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TooltipSection>
      {weeklyHoursDisplay && weeklyHoursDisplay.lines.length > 0 ? (
        <TooltipSection label={weeklyHoursLabel}>
          <EmployeeWeeklyHoursLines
            display={weeklyHoursDisplay}
            locale={locale}
            totalLabel={weeklyHoursTotalLabel}
          />
        </TooltipSection>
      ) : null}
      <TooltipSection label={sections.jobsLabel}>{sections.jobs}</TooltipSection>
      <TooltipSection label={sections.wishTimeLabel}>
        <WishLines lines={sections.wishTimeLines} />
      </TooltipSection>
      <TooltipSection label={sections.wishLocationLabel}>
        <WishLines lines={sections.wishLocationLines} />
      </TooltipSection>
      <TooltipSection label={sections.wishAreaLabel}>
        <WishLines lines={sections.wishAreaLines} />
      </TooltipSection>
    </div>
  );
}

export function DashboardStaffingCandidateEmployeeTooltipContent({
  employeeName,
  payload,
  loading,
  error,
  qualifications,
  weeklyHoursDisplay,
  className,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = locale === "en" ? "en" : "de";
  const weeklyHoursTotalLabel = t("dashboard.weeklyHoursTotalLabel");

  const sections = useMemo(() => {
    if (!payload) return null;
    return formatDashboardStaffingCandidateEmployeeTooltipSections({
      payload,
      qualifications,
      locale: intlLocale,
      absenceTypeLabel: (type) => t(absenceTypeLabelKey(type)),
    });
  }, [payload, qualifications, intlLocale, t]);

  const weeklyHoursLabel = t("dashboard.staffingCandidatesTooltipWeeklyHours");
  const emptyAvailabilityLabel = t("profiles.emptyAvailability");

  if (loading) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        {t("common.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-xs text-red-600", className)}>
        {t("common.loadError")}
      </div>
    );
  }

  if (!sections) {
    return (
      <div className={cn("space-y-2.5 text-xs", className)}>
        <p className="font-medium text-foreground">{employeeName}</p>
        {weeklyHoursDisplay && weeklyHoursDisplay.lines.length > 0 ? (
          <TooltipSection label={weeklyHoursLabel}>
            <EmployeeWeeklyHoursLines
              display={weeklyHoursDisplay}
              locale={intlLocale}
              totalLabel={weeklyHoursTotalLabel}
            />
          </TooltipSection>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("text-xs", className)}>
      <p className="mb-2 font-medium text-foreground">{employeeName}</p>
      <TooltipBody
        sections={{
          ...sections,
          absenceLabel: t("dashboard.staffingCandidatesTooltipAbsence"),
          availabilityLabel: t("dashboard.staffingCandidatesTooltipAvailability"),
          jobsLabel: t("dashboard.staffingCandidatesTooltipJobs"),
          wishTimeLabel: t("dashboard.staffingCandidatesTooltipWishTime"),
          wishLocationLabel: t("dashboard.staffingCandidatesTooltipWishLocation"),
          wishAreaLabel: t("dashboard.staffingCandidatesTooltipWishArea"),
        }}
        emptyAvailabilityLabel={emptyAvailabilityLabel}
        weeklyHoursLabel={weeklyHoursLabel}
        weeklyHoursDisplay={weeklyHoursDisplay}
        weeklyHoursTotalLabel={weeklyHoursTotalLabel}
        locale={intlLocale}
      />
    </div>
  );
}
