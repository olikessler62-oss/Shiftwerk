import type {
  EmployeeAdjacentShiftAssignments,
  EmployeeLastShiftAssignment,
} from "@schichtwerk/database";
import {
  absenceRequestToRange,
  isDateWithinAbsenceRange,
  sortProfileShiftPreferencesBySchedule,
  weekdayIndexFromDate,
} from "@schichtwerk/database";
import { weekdayAbbrevFromIndex } from "@schichtwerk/i18n";
import type {
  AbsenceRequest,
  AbsenceType,
  Location,
  LocationArea,
  Profile,
  Qualification,
} from "@schichtwerk/types";
import type { ProfileShiftPreferenceEntry } from "@/app/actions/areacalendar-shift-assign";
import {
  buildShiftPreferencePlacementLookups,
  formatShiftPreferenceAreaLabel,
  formatShiftPreferenceLocationLabel,
} from "@/lib/profile-shift-preference-display";
import {
  formatAvailabilityTimeRange,
  weekdayLabel,
} from "@/lib/profile-availability-label";
import {
  buildPlanningEmployeeAvailabilityTooltipRows,
  resolvePlanningEmployeeJobsTooltipLabel,
} from "@/lib/planning-employee-availability-tooltip";
import { parseISODate } from "@/lib/dates";

export type DashboardStaffingCandidateEmployeeTooltipPayload = {
  schedulable: boolean;
  isActive: boolean;
  absenceType: AbsenceType | null;
  availability: {
    weekday: number;
    start_time: string;
    end_time: string;
  }[];
  qualificationIds: string[];
  shiftPreferences: ProfileShiftPreferenceEntry[];
  locations: Pick<Location, "id" | "name">[];
  areas: Pick<LocationArea, "id" | "name" | "location_id">[];
  adjacentAssignments: EmployeeAdjacentShiftAssignments;
};

export type DashboardStaffingCandidateEmployeeTooltipLabels = {
  anyDay: string;
  noTime: string;
  emptyPlacement: string;
  noAbsence: string;
  emptyAvailability: string;
  emptyQualifications: string;
  absenceType: (type: AbsenceType) => string;
};

export type PlanningEmployeeAssignmentTooltipSection = {
  lines: string[];
  dayOffset: number;
};

export type DashboardStaffingCandidateEmployeeTooltipSections = {
  absence: string;
  availabilityLines: { weekday: string; timeRange: string }[];
  jobs: string;
  wishLines: string[];
  lastPastAssignment: PlanningEmployeeAssignmentTooltipSection | null;
  nextFutureAssignment: PlanningEmployeeAssignmentTooltipSection | null;
};

function isNonemptyWishPlacementLine(
  line: string,
  emptyPlacement: string
): boolean {
  return line.trim().length > 0 && line !== emptyPlacement && line !== "—";
}

function formatLastAssignmentDateLabel(
  shiftDateISO: string,
  locale: "de" | "en"
): string {
  const intlLocale = locale === "en" ? "en-GB" : "de-DE";
  const weekday = weekdayAbbrevFromIndex(
    weekdayIndexFromDate(shiftDateISO),
    locale
  );
  const dateLabel = new Intl.DateTimeFormat(intlLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseISODate(shiftDateISO));
  return `${weekday} ${dateLabel}`;
}

function formatLastAssignmentShiftTimeLabel(
  startsAt: string,
  endsAt: string,
  locale: "de" | "en"
): string {
  const intlLocale = locale === "en" ? "en-GB" : "de-DE";
  const formatPart = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  return `${formatPart(startsAt)}–${formatPart(endsAt)}`;
}

function calendarDaysBetween(fromISO: string, toISO: string): number {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  const msPerDay = 86400000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function formatAssignmentDetailLines(
  assignment: EmployeeLastShiftAssignment,
  locale: "de" | "en"
): string[] {
  const lines: string[] = [];
  if (assignment.locationName) {
    lines.push(assignment.locationName);
  }
  if (assignment.areaName) {
    lines.push(assignment.areaName);
  }

  lines.push(formatLastAssignmentDateLabel(assignment.shiftDate, locale));

  if (assignment.templateName) {
    lines.push(assignment.templateName);
  }

  lines.push(
    formatLastAssignmentShiftTimeLabel(
      assignment.startsAt,
      assignment.endsAt,
      locale
    )
  );

  return lines;
}

function formatPastAssignmentSection(
  assignment: EmployeeLastShiftAssignment | null,
  todayISO: string,
  locale: "de" | "en"
): PlanningEmployeeAssignmentTooltipSection | null {
  if (!assignment) return null;

  return {
    lines: formatAssignmentDetailLines(assignment, locale),
    dayOffset: calendarDaysBetween(assignment.shiftDate, todayISO),
  };
}

function formatFutureAssignmentSection(
  assignment: EmployeeLastShiftAssignment | null,
  todayISO: string,
  locale: "de" | "en"
): PlanningEmployeeAssignmentTooltipSection | null {
  if (!assignment) return null;

  return {
    lines: formatAssignmentDetailLines(assignment, locale),
    dayOffset: calendarDaysBetween(todayISO, assignment.shiftDate),
  };
}

function formatAdjacentAssignmentSections(
  adjacentAssignments: EmployeeAdjacentShiftAssignments,
  todayISO: string,
  locale: "de" | "en"
): {
  lastPastAssignment: PlanningEmployeeAssignmentTooltipSection | null;
  nextFutureAssignment: PlanningEmployeeAssignmentTooltipSection | null;
} {
  return {
    lastPastAssignment: formatPastAssignmentSection(
      adjacentAssignments.lastPast,
      todayISO,
      locale
    ),
    nextFutureAssignment: formatFutureAssignmentSection(
      adjacentAssignments.nextFuture,
      todayISO,
      locale
    ),
  };
}

export function resolveEmployeeAbsenceTypeOnDate(
  employeeId: string,
  dateISO: string,
  absences: readonly AbsenceRequest[]
): AbsenceType | null {
  for (const absence of absences) {
    if (absence.status !== "approved") continue;
    if (absence.employee_id !== employeeId) continue;
    const range = absenceRequestToRange(absence);
    if (isDateWithinAbsenceRange(range, dateISO)) {
      return absence.type;
    }
  }
  return null;
}

export function isProfileSchedulableForAssignment(
  profile: Pick<Profile, "is_active" | "schedulable">
): boolean {
  return profile.is_active && profile.schedulable;
}

export function formatDashboardStaffingCandidateEmployeeTooltipSections(
  payload: DashboardStaffingCandidateEmployeeTooltipPayload,
  input: {
    locale: "de" | "en";
    qualifications: readonly Qualification[];
    locations: readonly Pick<Location, "id" | "name">[];
    areas: readonly Pick<LocationArea, "id" | "name" | "location_id">[];
    labels: DashboardStaffingCandidateEmployeeTooltipLabels;
    todayISO: string;
  }
): DashboardStaffingCandidateEmployeeTooltipSections {
  const qualificationNameById = new Map(
    input.qualifications.map((qualification) => [
      qualification.id,
      qualification.name,
    ])
  );
  const qualificationSortOrder = new Map(
    input.qualifications.map((qualification) => [
      qualification.id,
      qualification.sort_order,
    ])
  );
  const placementLookups = buildShiftPreferencePlacementLookups({
    locations: input.locations as Location[],
    areas: input.areas as LocationArea[],
    qualifications: input.qualifications,
  });

  const availabilityLines = buildPlanningEmployeeAvailabilityTooltipRows(
    payload.availability.map((slot, index) => ({
      id: `availability-${index}`,
      profile_id: "",
      organization_id: "",
      weekday: slot.weekday,
      start_time: slot.start_time,
      end_time: slot.end_time,
      sort_order: index,
      created_at: "",
      updated_at: "",
    })),
    input.locale
  );

  const sortedPreferences = sortProfileShiftPreferencesBySchedule(
    payload.shiftPreferences.map((preference) => ({
      ...preference,
      id: "",
      profile_id: "",
      organization_id: "",
      created_at: "",
      updated_at: "",
    }))
  );

  const wishTimeLines = sortedPreferences.map((preference) => {
    const dayLabel =
      preference.weekday != null
        ? weekdayLabel(preference.weekday, input.locale, "long")
        : input.labels.anyDay;
    if (preference.start_time != null && preference.end_time != null) {
      return `${dayLabel} · ${formatAvailabilityTimeRange(
        preference.start_time,
        preference.end_time,
        input.locale
      )}`;
    }
    return `${dayLabel} · ${input.labels.noTime}`;
  });

  const wishLocationLines = sortedPreferences.map((preference) =>
    formatShiftPreferenceLocationLabel(
      preference,
      placementLookups,
      input.labels.emptyPlacement
    )
  );

  const wishAreaLines = sortedPreferences.map((preference) =>
    formatShiftPreferenceAreaLabel(
      preference,
      placementLookups,
      input.labels.emptyPlacement
    )
  );

  const wishLines: string[] = [];
  sortedPreferences.forEach((preference, index) => {
    const locationLine = wishLocationLines[index];
    const areaLine = wishAreaLines[index];
    const timeLine = wishTimeLines[index];

    if (isNonemptyWishPlacementLine(locationLine, input.labels.emptyPlacement)) {
      wishLines.push(locationLine);
    }
    if (isNonemptyWishPlacementLine(areaLine, input.labels.emptyPlacement)) {
      wishLines.push(areaLine);
    }
    if (
      preference.weekday != null ||
      (preference.start_time != null && preference.end_time != null)
    ) {
      wishLines.push(timeLine);
    }
  });

  const jobs = resolvePlanningEmployeeJobsTooltipLabel(
    "",
    { "": payload.qualificationIds },
    qualificationNameById,
    qualificationSortOrder
  );

  const { lastPastAssignment, nextFutureAssignment } =
    formatAdjacentAssignmentSections(
      payload.adjacentAssignments,
      input.todayISO,
      input.locale
    );

  return {
    absence: payload.absenceType
      ? input.labels.absenceType(payload.absenceType)
      : input.labels.noAbsence,
    availabilityLines,
    jobs: jobs.trim() || input.labels.emptyQualifications,
    wishLines,
    lastPastAssignment,
    nextFutureAssignment,
  };
}
