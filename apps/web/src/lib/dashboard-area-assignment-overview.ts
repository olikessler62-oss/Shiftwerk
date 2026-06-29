import {
  mapAssignmentQualificationIds,
  qualificationRulesForServiceHour,
  staffingAssignmentsForAreaDay,
} from "@/lib/bulk-staffing-header";
import {
  computeDashboardStaffingCandidateSlots,
  type DashboardStaffingCandidateSlot,
} from "@/lib/dashboard-staffing-candidates";
import type { DashboardStaffingWindowRow } from "@/lib/dashboard-area-week-stats";
import {
  listShiftsForStaffingWindow,
  shiftOverviewActionsForShift,
  type DashboardStaffingWindowIssuesContext,
} from "@/lib/dashboard-staffing-window-issues";
import { staffingRulesWithOverridesForAreaDate } from "@/lib/staffing-rules-with-overrides";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type { ShiftCardContextMenuAction } from "@/lib/shift-card-context-menu-actions";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import type { ComputeDashboardStaffingCandidateSlotsInput } from "@/lib/dashboard-staffing-candidates";

export type DashboardAssignmentOverviewShiftRow = {
  shift: PlanningShift;
  employeeName: string;
  qualificationName: string | null;
  timeLabel: string;
  confirmationStatus?: ShiftConfirmationStatus;
  actions: readonly ShiftCardContextMenuAction[];
};

export type DashboardAssignmentOverviewWindowSection = {
  row: DashboardStaffingWindowRow;
  shifts: DashboardAssignmentOverviewShiftRow[];
  openSlots: DashboardStaffingCandidateSlot[];
};

export type DashboardAssignmentOverviewDayGroup = {
  dateISO: string;
  weekdayLabel: string;
  windows: DashboardAssignmentOverviewWindowSection[];
};

export type BuildDashboardAreaAssignmentOverviewInput = {
  rows: readonly DashboardStaffingWindowRow[];
  context: DashboardStaffingWindowIssuesContext;
  slotInputBase: Omit<
    ComputeDashboardStaffingCandidateSlotsInput,
    "dateISO" | "serviceHourId" | "headcountSectionLabel"
  >;
  formatCalendarTimeLabel: (startTime: string, endTime: string) => string;
  headcountSectionLabel: string;
  showDayHeaders: boolean;
};

function resolveShiftQualificationName(
  shift: PlanningShift,
  row: DashboardStaffingWindowRow,
  context: DashboardStaffingWindowIssuesContext,
  slotInputBase: BuildDashboardAreaAssignmentOverviewInput["slotInputBase"]
): string | null {
  if (shift.jobName?.trim()) return shift.jobName.trim();

  const rulesForDay = staffingRulesWithOverridesForAreaDate(
    slotInputBase.staffingRules,
    slotInputBase.staffingOverrides,
    slotInputBase.areaId,
    row.dateISO
  );
  const qualRules = qualificationRulesForServiceHour(
    rulesForDay,
    slotInputBase.areaId,
    row.serviceHourId
  );
  if (qualRules.length === 0) return null;

  const areaShifts = slotInputBase.shifts.filter(
    (item) => item.location_area_id === slotInputBase.areaId
  );
  const assignments = staffingAssignmentsForAreaDay(
    areaShifts,
    row.dateISO,
    slotInputBase.areaId
  );
  const qualMap = mapAssignmentQualificationIds(
    assignments,
    qualRules,
    slotInputBase.profileQualificationIds
  );
  const shiftIndex = assignments.findIndex(
    (assignment) =>
      assignment.employeeId === shift.employee_id &&
      assignment.startTime === shift.startTime &&
      assignment.endTime === shift.endTime
  );
  const qualId = shiftIndex >= 0 ? qualMap.get(shiftIndex) : undefined;
  if (!qualId) return null;

  return (
    slotInputBase.qualifications.find((qualification) => qualification.id === qualId)
      ?.name ?? qualId
  );
}

function buildWindowSection(
  row: DashboardStaffingWindowRow,
  input: BuildDashboardAreaAssignmentOverviewInput
): DashboardAssignmentOverviewWindowSection | null {
  if (row.rowKind === "no_service_hours" && !row.hasUnplannedShifts) {
    return {
      row,
      shifts: [],
      openSlots: [],
    };
  }

  const shifts = listShiftsForStaffingWindow(row, input.context).map((shift) => ({
    shift,
    employeeName:
      input.context.employeeNameById.get(shift.employee_id) ?? "—",
    qualificationName: resolveShiftQualificationName(
      shift,
      row,
      input.context,
      input.slotInputBase
    ),
    timeLabel: input.formatCalendarTimeLabel(shift.startTime, shift.endTime),
    confirmationStatus: shift.confirmationStatus,
    actions: shiftOverviewActionsForShift(shift, input.context),
  }));

  const openSlots = computeOpenSlotsForRow(row, input);

  return { row, shifts, openSlots };
}

function computeOpenSlotsForRow(
  row: DashboardStaffingWindowRow,
  input: BuildDashboardAreaAssignmentOverviewInput
): DashboardStaffingCandidateSlot[] {
  if (row.rowKind !== "staffing_window") return [];

  return computeDashboardStaffingCandidateSlots({
    ...input.slotInputBase,
    dateISO: row.dateISO,
    serviceHourId: row.serviceHourId,
    headcountSectionLabel: input.headcountSectionLabel,
  });
}

export function buildDashboardAreaAssignmentOverview(
  input: BuildDashboardAreaAssignmentOverviewInput
): DashboardAssignmentOverviewDayGroup[] {
  const sections = input.rows
    .map((row) => buildWindowSection(row, input))
    .filter((section): section is DashboardAssignmentOverviewWindowSection =>
      section !== null
    )
    .filter(
      (section) =>
        section.shifts.length > 0 ||
        section.openSlots.length > 0 ||
        section.row.rowKind === "no_service_hours"
    );

  if (!input.showDayHeaders) {
    if (sections.length === 0) return [];
    return [
      {
        dateISO: sections[0]?.row.dateISO ?? "",
        weekdayLabel: sections[0]?.row.weekdayLabel ?? "",
        windows: sections,
      },
    ];
  }

  const byDate = new Map<string, DashboardAssignmentOverviewWindowSection[]>();
  for (const section of sections) {
    const list = byDate.get(section.row.dateISO) ?? [];
    list.push(section);
    byDate.set(section.row.dateISO, list);
  }

  return [...byDate.entries()].map(([dateISO, windows]) => ({
    dateISO,
    weekdayLabel: windows[0]?.row.weekdayLabel ?? dateISO,
    windows,
  }));
}
