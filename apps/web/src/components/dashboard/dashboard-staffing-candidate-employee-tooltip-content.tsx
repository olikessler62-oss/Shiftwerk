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

type Props = {
  employeeName: string;
  payload: DashboardStaffingCandidateEmployeeTooltipPayload | null;
  loading: boolean;
  error: boolean;
  qualifications: readonly Qualification[];
  weeklyHoursLine?: string | null;
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
  weeklyHoursLine,
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
  weeklyHoursLine?: string | null;
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
              {sections.availabilityLines.map((row, index) => (
                <tr key={`${row.weekday}-${row.timeRange}-${index}`}>
                  <td className="whitespace-nowrap pr-4 align-top">
                    {row.weekday}
                  </td>
                  <td className="whitespace-nowrap align-top tabular-nums">
                    {row.timeRange}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TooltipSection>
      {weeklyHoursLine ? (
        <TooltipSection label={weeklyHoursLabel}>{weeklyHoursLine}</TooltipSection>
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
  weeklyHoursLine,
  className,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const tooltipLocale = locale === "en" ? "en" : "de";

  const sections = useMemo(() => {
    if (!payload) return null;
    const formatted = formatDashboardStaffingCandidateEmployeeTooltipSections(
      payload,
      {
        locale: tooltipLocale,
        qualifications,
        locations: payload.locations,
        areas: payload.areas,
        labels: {
          anyDay: t("profiles.shiftPreferenceAnyDay"),
          noTime: t("profiles.shiftPreferenceNoTime"),
          emptyPlacement: t("profiles.shiftPreferenceNone"),
          noAbsence: t("dashboard.staffingCandidatesTooltipNoAbsence"),
          emptyAvailability: t("profiles.emptyAvailability"),
          emptyQualifications: t("profiles.emptyQualifications"),
          absenceType: (type) => t(absenceTypeLabelKey(type)),
        },
      }
    );
    return {
      ...formatted,
      absenceLabel: t("dashboard.staffingCandidatesTooltipAbsence"),
      availabilityLabel: t("dashboard.staffingCandidatesTooltipAvailability"),
      jobsLabel: t("dashboard.staffingCandidatesTooltipJobs"),
      wishTimeLabel: t("dashboard.staffingCandidatesTooltipWishTime"),
      wishLocationLabel: t("dashboard.staffingCandidatesTooltipWishLocation"),
      wishAreaLabel: t("dashboard.staffingCandidatesTooltipWishArea"),
    };
  }, [payload, tooltipLocale, qualifications, t]);

  const weeklyHoursLabel = t("dashboard.staffingCandidatesTooltipWeeklyHours");

  return (
    <div className={cn("max-w-xs text-xs leading-snug", className)}>
      <p className="mb-2 border-b border-border/60 pb-1.5 font-semibold text-foreground">
        {employeeName}
      </p>
      {loading ? (
        <div className="space-y-2.5">
          {weeklyHoursLine ? (
            <TooltipSection label={weeklyHoursLabel}>{weeklyHoursLine}</TooltipSection>
          ) : null}
          <p className="text-muted-foreground">
            {t("dashboard.staffingCandidatesTooltipLoading")}
          </p>
        </div>
      ) : error ? (
        <div className="space-y-2.5">
          {weeklyHoursLine ? (
            <TooltipSection label={weeklyHoursLabel}>{weeklyHoursLine}</TooltipSection>
          ) : null}
          <p className="text-muted-foreground">
            {t("dashboard.staffingCandidatesTooltipError")}
          </p>
        </div>
      ) : sections ? (
        <TooltipBody
          sections={sections}
          emptyAvailabilityLabel={t("profiles.emptyAvailability")}
          weeklyHoursLabel={weeklyHoursLabel}
          weeklyHoursLine={weeklyHoursLine}
        />
      ) : null}
    </div>
  );
}
