"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Qualification } from "@schichtwerk/types";
import type {
  DashboardStaffingCandidateEmployeeTooltipPayload,
} from "@/lib/dashboard-staffing-candidate-employee-tooltip";
import {
  formatDashboardStaffingCandidateEmployeeTooltipSections,
  formatAssignmentProjectedWeeklyHoursLine,
  appendAssignmentTimeDurationSuffix,
  type DashboardStaffingCandidateEmployeeTooltipSections,
  type PlanningEmployeeAssignmentTooltipSection,
} from "@/lib/dashboard-staffing-candidate-employee-tooltip";
import { absenceTypeLabelKey } from "@/lib/shift-absence-conflict";
import { useTranslations, useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import type { EmployeeWeeklyHoursDisplay } from "@/lib/employee-weekly-hours-display";

type Props = {
  employeeName: string;
  todayISO: string;
  payload: DashboardStaffingCandidateEmployeeTooltipPayload | null;
  loading: boolean;
  error: boolean;
  qualifications: readonly Qualification[];
  weeklyHoursDisplay?: EmployeeWeeklyHoursDisplay | null;
  weeklyHoursWeekDates?: readonly string[];
  className?: string;
};

function formatTooltipHeaderWeeklyHours(
  display: EmployeeWeeklyHoursDisplay | null | undefined
): string | null {
  if (!display) return null;
  return `${display.totalHours}/${display.targetHours}`;
}

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

function assignmentSectionLinesWithDurationOnTime(
  section: PlanningEmployeeAssignmentTooltipSection,
  locale: "de" | "en"
): string[] {
  if (section.lines.length === 0) return section.lines;

  const lines = [...section.lines];
  const timeLineIndex = lines.length - 1;
  lines[timeLineIndex] = appendAssignmentTimeDurationSuffix(
    lines[timeLineIndex],
    section.durationHours,
    locale
  );
  return lines;
}

function AssignmentSection({
  label,
  offsetLabel,
  section,
  emptyLabel,
  weeklyHoursLine,
  intlLocale,
}: {
  label: string;
  offsetLabel: string | null;
  section: PlanningEmployeeAssignmentTooltipSection | null;
  emptyLabel?: string;
  weeklyHoursLine?: string | null;
  intlLocale: "de" | "en";
}) {
  const lines = section
    ? assignmentSectionLinesWithDurationOnTime(section, intlLocale)
    : undefined;

  return (
    <div>
      <p className="font-medium text-foreground">{label}</p>
      {section && offsetLabel ? (
        <p className="mt-0.5 text-muted-foreground">{offsetLabel}</p>
      ) : null}
      <div className="mt-0.5 text-muted-foreground">
        {section && lines ? (
          <>
            <LineList lines={lines} />
            {weeklyHoursLine ? (
              <p className="mt-0.5 tabular-nums">{weeklyHoursLine}</p>
            ) : null}
          </>
        ) : emptyLabel ? (
          <span>{emptyLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

function LineList({ lines }: { lines: readonly string[] }) {
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

function TooltipHeader({
  employeeName,
  weeklyHoursDisplay,
}: {
  employeeName: string;
  weeklyHoursDisplay?: EmployeeWeeklyHoursDisplay | null;
}) {
  const weeklyHoursLabel = formatTooltipHeaderWeeklyHours(weeklyHoursDisplay);

  return (
    <div className="mb-2">
      <p className="text-sm font-semibold text-foreground">{employeeName}</p>
      {weeklyHoursLabel ? (
        <p className="mt-0.5 text-xs font-normal tabular-nums text-foreground/80">
          {weeklyHoursLabel}
        </p>
      ) : null}
    </div>
  );
}

function formatPastAssignmentOffsetLabel(
  dayOffset: number,
  t: ReturnType<typeof useTranslations>
): string {
  if (dayOffset <= 0) {
    return t("dashboard.staffingCandidatesTooltipLastAssignmentToday");
  }
  if (dayOffset === 1) {
    return t("dashboard.staffingCandidatesTooltipLastAssignmentDaysAgoOne");
  }
  return t("dashboard.staffingCandidatesTooltipLastAssignmentDaysAgo", {
    days: String(dayOffset),
  });
}

function formatFutureAssignmentOffsetLabel(
  dayOffset: number,
  t: ReturnType<typeof useTranslations>
): string {
  if (dayOffset <= 0) {
    return t("dashboard.staffingCandidatesTooltipNextAssignmentToday");
  }
  if (dayOffset === 1) {
    return t("dashboard.staffingCandidatesTooltipNextAssignmentInOne");
  }
  return t("dashboard.staffingCandidatesTooltipNextAssignmentInDays", {
    days: String(dayOffset),
  });
}

function TooltipBody({
  sections,
  emptyAvailabilityLabel,
  lastAssignmentLabel,
  lastAssignmentOffsetLabel,
  nextAssignmentLabel,
  nextAssignmentOffsetLabel,
  nextAssignmentWeeklyHoursLine,
  wishesLabel,
  intlLocale,
}: {
  sections: DashboardStaffingCandidateEmployeeTooltipSections & {
    absenceLabel: string;
    availabilityLabel: string;
    jobsLabel: string;
  };
  emptyAvailabilityLabel: string;
  lastAssignmentLabel: string;
  lastAssignmentOffsetLabel: string | null;
  nextAssignmentLabel: string;
  nextAssignmentOffsetLabel: string | null;
  nextAssignmentWeeklyHoursLine: string | null;
  wishesLabel: string;
  intlLocale: "de" | "en";
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
                <tr key={`${line.weekday}:${line.timeRange}:${index}`}>
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
      <TooltipSection label={sections.jobsLabel}>{sections.jobs}</TooltipSection>
      {sections.nextFutureAssignment ? (
        <AssignmentSection
          label={nextAssignmentLabel}
          offsetLabel={nextAssignmentOffsetLabel}
          section={sections.nextFutureAssignment}
          weeklyHoursLine={nextAssignmentWeeklyHoursLine}
          intlLocale={intlLocale}
        />
      ) : sections.lastPastAssignment ? (
        <AssignmentSection
          label={lastAssignmentLabel}
          offsetLabel={lastAssignmentOffsetLabel}
          section={sections.lastPastAssignment}
          intlLocale={intlLocale}
        />
      ) : null}
      <TooltipSection label={wishesLabel}>
        <LineList lines={sections.wishLines} />
      </TooltipSection>
    </div>
  );
}

export function PlanningEmployeeTooltipContent({
  employeeName,
  todayISO,
  payload,
  loading,
  error,
  qualifications,
  weeklyHoursDisplay,
  weeklyHoursWeekDates,
  className,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = locale === "en" ? "en" : "de";

  const sections = useMemo(() => {
    if (!payload) return null;
    return formatDashboardStaffingCandidateEmployeeTooltipSections(payload, {
      locale: intlLocale,
      qualifications,
      locations: payload.locations,
      areas: payload.areas,
      todayISO,
      weeklyHoursWeekDates,
      labels: {
        anyDay: t("profiles.shiftPreferenceAnyDay"),
        noTime: t("profiles.shiftPreferenceNoTime"),
        emptyPlacement: t("profiles.shiftPreferenceNone"),
        noAbsence: t("dashboard.staffingCandidatesTooltipNoAbsence"),
        emptyAvailability: t("profiles.emptyAvailability"),
        emptyQualifications: t("profiles.emptyQualifications"),
        absenceType: (type) => t(absenceTypeLabelKey(type)),
      },
    });
  }, [payload, qualifications, intlLocale, todayISO, weeklyHoursWeekDates, t]);

  const nextAssignmentWeeklyHoursLine =
    sections?.nextFutureAssignment?.showProjectedWeeklyHours
      ? formatAssignmentProjectedWeeklyHoursLine(
          sections.nextFutureAssignment.durationHours,
          weeklyHoursDisplay?.totalHours,
          weeklyHoursDisplay?.targetHours,
          {
            lineLabel: (projected, target) =>
              t("dashboard.staffingCandidatesTooltipAssignmentWeeklyHoursInclusive", {
                projected: String(projected),
                target: String(target),
              }),
          }
        )
      : null;

  const emptyAvailabilityLabel = t("profiles.emptyAvailability");
  const lastAssignmentOffsetLabel =
    sections?.lastPastAssignment != null
      ? formatPastAssignmentOffsetLabel(sections.lastPastAssignment.dayOffset, t)
      : null;
  const nextAssignmentOffsetLabel =
    sections?.nextFutureAssignment != null
      ? formatFutureAssignmentOffsetLabel(
          sections.nextFutureAssignment.dayOffset,
          t
        )
      : null;

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
      <div className={cn("text-xs", className)}>
        <TooltipHeader
          employeeName={employeeName}
          weeklyHoursDisplay={weeklyHoursDisplay}
        />
      </div>
    );
  }

  return (
    <div className={cn("text-xs", className)}>
      <TooltipHeader
        employeeName={employeeName}
        weeklyHoursDisplay={weeklyHoursDisplay}
      />
      <TooltipBody
        sections={{
          ...sections,
          absenceLabel: t("dashboard.staffingCandidatesTooltipAbsence"),
          availabilityLabel: t("dashboard.staffingCandidatesTooltipAvailability"),
          jobsLabel: t("dashboard.staffingCandidatesTooltipJobs"),
        }}
        emptyAvailabilityLabel={emptyAvailabilityLabel}
        lastAssignmentLabel={t("dashboard.staffingCandidatesTooltipLastAssignment")}
        lastAssignmentOffsetLabel={lastAssignmentOffsetLabel}
        nextAssignmentLabel={t("dashboard.staffingCandidatesTooltipNextAssignment")}
        nextAssignmentOffsetLabel={nextAssignmentOffsetLabel}
        nextAssignmentWeeklyHoursLine={nextAssignmentWeeklyHoursLine}
        wishesLabel={t("dashboard.staffingCandidatesTooltipWishes")}
        intlLocale={intlLocale}
      />
    </div>
  );
}

/** @deprecated Alias — bitte `PlanningEmployeeTooltipContent` verwenden. */
export const DashboardStaffingCandidateEmployeeTooltipContent =
  PlanningEmployeeTooltipContent;
