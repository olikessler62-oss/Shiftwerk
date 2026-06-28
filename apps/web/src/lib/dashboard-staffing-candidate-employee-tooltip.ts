import {
  absenceRequestToRange,
  isDateWithinAbsenceRange,
  sortProfileShiftPreferencesBySchedule,
} from "@schichtwerk/database";
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

export type DashboardStaffingCandidateEmployeeTooltipSections = {
  absence: string;
  availabilityLines: { weekday: string; timeRange: string }[];
  jobs: string;
  wishTimeLines: string[];
  wishLocationLines: string[];
  wishAreaLines: string[];
};

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

  const jobs = resolvePlanningEmployeeJobsTooltipLabel(
    "",
    { "": payload.qualificationIds },
    qualificationNameById,
    qualificationSortOrder
  );

  return {
    absence: payload.absenceType
      ? input.labels.absenceType(payload.absenceType)
      : input.labels.noAbsence,
    availabilityLines,
    jobs: jobs.trim() || input.labels.emptyQualifications,
    wishTimeLines,
    wishLocationLines,
    wishAreaLines,
  };
}
