import { areaCalendarAssignmentPresetsForArea } from "@/lib/areacalendar-assignment-presets";
import {
  computeBulkStaffingHeaderEntries,
  staffingAssignmentsForAreaDay,
} from "@/lib/bulk-staffing-header";
import { personalbedarfDemandTimesForEntry } from "@/lib/bulk-shift-staffing";
import type { PlanningShift } from "@/lib/planning-shift-card";
import {
  isAreaOpenOnDate,
  type AreaServiceHourRef,
  type TagAreaHeaderStaffingEntry,
} from "@/lib/location-staffing-client";
import { staffingRulesWithOverridesForAreaDate } from "@/lib/staffing-rules-with-overrides";
import {
  computeTagAreaDayFooterStatsForDate,
  type AreaCalendarShiftCompensationByKey,
  type TagAreaShiftRef,
} from "@/lib/tag-area-footer-stats";
import {
  isTagAreaHeaderStaffingEntryAssignmentMismatch,
  isTagAreaHeaderStaffingEntryOverstaffed,
  isTagAreaHeaderStaffingEntryPlannedCoverage,
  isTagAreaHeaderStaffingEntryUnderstaffed,
  type StaffingFillGaugeVariant,
} from "@/lib/tag-area-header-staffing-display";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  Qualification,
  ShiftConfirmationStatus,
} from "@schichtwerk/types";
import {
  buildStaffingWindowConfirmationCountsByKey,
  collectAreaConfirmationConflictStatuses,
  staffingWindowConfirmationCountsKey,
  type DashboardStaffingWindowConfirmationCounts,
} from "@/lib/dashboard-day-confirmation-counts";

export type DashboardAreaAmpelLevel =
  | "no_demand"
  | "met"
  | "partial"
  | "critical"
  | "overstaffed_only";

export type DashboardStaffingWindowRowStatus =
  | "understaffed"
  | "planned"
  | "met"
  | "overstaffed";

export type DashboardStaffingWindowRowKind =
  | "staffing_window"
  | "no_service_hours";

export type DashboardStaffingWindowRow = {
  rowKind: DashboardStaffingWindowRowKind;
  dateISO: string;
  serviceHourId: string;
  weekdayLabel: string;
  timeFrom: string;
  timeTo: string;
  shiftName: string;
  assigned: number;
  required: number;
  status: DashboardStaffingWindowRowStatus;
  /** Personal-Konflikt (falsche Quali, Überbesetzung, …) — Kandidaten-Button in der Zeile. */
  hasConflict?: boolean;
  /** Hinweise zur Einteilung in diesem Schichtfenster (für Inline-Anzeige in der Liste). */
  staffingConflicts?: readonly DashboardStaffingIssue[];
  /** Bestätigungs-Konflikte je Status in diesem Schichtfenster. */
  confirmationCounts?: DashboardStaffingWindowConfirmationCounts;
  /** Schichten trotz fehlender Servicezeit (nur `no_service_hours`). */
  hasUnplannedShifts?: boolean;
};

export type DashboardStaffingIssueKind =
  | "understaffed_window"
  | "understaffed_qualification"
  | "overstaffed"
  | "qualification_mismatch"
  | "no_matching_qualification";

export type DashboardStaffingIssue = {
  id: string;
  kind: DashboardStaffingIssueKind;
  dateISO: string;
  weekdayLabel: string;
  timeLabel: string;
  shiftName: string;
  employeeName?: string;
  assignedQualificationName?: string;
  missingQualificationName?: string;
  assigned?: number;
  required?: number;
  qualificationName?: string;
};

export type DashboardAreaWeekStats = {
  areaId: string;
  areaName: string;
  sortOrder: number;
  shiftCount: number;
  assignedTotal: number;
  requiredTotal: number;
  openSlots: number;
  understaffedWindowCount: number;
  ampelLevel: DashboardAreaAmpelLevel;
  gaugeVariant: StaffingFillGaugeVariant;
  criticalWindowLabel: string | null;
  staffingWindowRows: DashboardStaffingWindowRow[];
  staffingIssues: DashboardStaffingIssue[];
  confirmationConflictStatuses: ShiftConfirmationStatus[];
  totalHours: number;
  baseCost: number;
  surchargeCost: number;
  totalCost: number;
  hasCompensation: boolean;
  currency: string;
  hasAssignmentMismatch: boolean;
  /** Mindestens eine Schichtvorlage im Bereich — steuert die Spalte „Schicht“ in der Liste. */
  hasAreaShiftTemplates: boolean;
};

export type DashboardLocationWeekRollup = {
  assignedTotal: number;
  requiredTotal: number;
  openSlots: number;
  criticalAreaCount: number;
  totalHours: number;
  baseCost: number;
  surchargeCost: number;
  totalCost: number;
  hasCompensation: boolean;
  currency: string;
};

export type ComputeDashboardAreaWeekStatsInput = {
  area: LocationArea;
  dates: readonly string[];
  shifts: readonly PlanningShift[];
  staffingRules: readonly LocationAreaStaffing[];
  staffingOverrides: readonly LocationAreaStaffingOverride[];
  serviceHours: readonly AreaServiceHourRef[];
  areaShiftTemplates: readonly AreaShiftTemplateWithBreaks[];
  qualifications: readonly Qualification[];
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
  compensationByKey: AreaCalendarShiftCompensationByKey;
  staffingEnabled: boolean;
  formatTimeLabel: (
    weekdayLabel: string,
    startTime: string,
    endTime: string
  ) => string;
  weekdayLabel: (weekdayIndex: number) => string;
  formatCalendarTimeLabel: (startTime: string, endTime: string) => string;
  formatCriticalWindowLabel?: (
    dateISO: string,
    entry: TagAreaHeaderStaffingEntry
  ) => string;
  formatWeekdayLabel?: (dateISO: string) => string;
  employeeNameById?: ReadonlyMap<string, string>;
};

type DashboardStaffingIssueTranslator = (
  key:
    | "dashboard.staffingIssueUnderstaffedWindow"
    | "dashboard.staffingIssueUnderstaffedQual"
    | "dashboard.staffingIssueOverstaffed"
    | "dashboard.staffingIssueMismatch"
    | "dashboard.staffingIssueNoQual",
  params: Record<string, string>
) => string;

function buildDashboardStaffingIssuesForEntry(input: {
  dateISO: string;
  weekdayLabel: string;
  entry: TagAreaHeaderStaffingEntry;
  shiftName: string;
}): DashboardStaffingIssue[] {
  const { dateISO, weekdayLabel, entry, shiftName } = input;

  return (entry.conflictDetails ?? []).map((detail, index) => ({
    id: `${dateISO}:${entry.serviceHourId}:conflict:${index}:${detail.kind}:${detail.employeeName}`,
    kind: detail.kind,
    dateISO,
    weekdayLabel,
    timeLabel: detail.timeLabel,
    shiftName,
    employeeName: detail.employeeName,
    assignedQualificationName: detail.assignedQualificationName,
    missingQualificationName: detail.missingQualificationName,
  }));
}

function sortDashboardStaffingIssues(
  issues: DashboardStaffingIssue[]
): DashboardStaffingIssue[] {
  return [...issues].sort(
    (left, right) =>
      left.dateISO.localeCompare(right.dateISO) ||
      left.timeLabel.localeCompare(right.timeLabel) ||
      left.shiftName.localeCompare(right.shiftName, "de") ||
      left.kind.localeCompare(right.kind)
  );
}

export function dashboardStaffingIssueKindDotClass(
  kind: DashboardStaffingIssueKind
): string {
  switch (kind) {
    case "understaffed_window":
    case "understaffed_qualification":
      return "bg-red-500";
    case "overstaffed":
      return "bg-[#CA8A04]";
    case "qualification_mismatch":
    case "no_matching_qualification":
      return "bg-amber-500";
  }
}

type DashboardStaffingIssueInlineTranslator = (
  key:
    | "dashboard.staffingIssueInlineOverstaffed"
    | "dashboard.staffingIssueInlineMismatch"
    | "dashboard.staffingIssueInlineNoQual",
  params: Record<string, string>
) => string;

export function formatDashboardStaffingIssueInlineDescription(
  issue: DashboardStaffingIssue,
  t: DashboardStaffingIssueInlineTranslator
): string {
  switch (issue.kind) {
    case "overstaffed":
      return t("dashboard.staffingIssueInlineOverstaffed", {
        name: issue.employeeName ?? "—",
        position: issue.assignedQualificationName ?? "—",
      });
    case "qualification_mismatch":
      return t("dashboard.staffingIssueInlineMismatch", {
        name: issue.employeeName ?? "—",
        position: issue.assignedQualificationName ?? "—",
        missing: issue.missingQualificationName ?? "—",
      });
    case "no_matching_qualification":
      return t("dashboard.staffingIssueInlineNoQual", {
        name: issue.employeeName ?? "—",
        missing: issue.missingQualificationName ?? "—",
      });
    default:
      return issue.kind;
  }
}

export function formatDashboardStaffingIssueDescription(
  issue: DashboardStaffingIssue,
  t: DashboardStaffingIssueTranslator
): string {
  switch (issue.kind) {
    case "understaffed_window":
      return t("dashboard.staffingIssueUnderstaffedWindow", {
        weekday: issue.weekdayLabel,
        time: issue.timeLabel,
        shift: issue.shiftName,
        assigned: String(issue.assigned ?? 0),
        required: String(issue.required ?? 0),
      });
    case "understaffed_qualification":
      return t("dashboard.staffingIssueUnderstaffedQual", {
        weekday: issue.weekdayLabel,
        time: issue.timeLabel,
        shift: issue.shiftName,
        qualification: issue.qualificationName ?? "—",
        assigned: String(issue.assigned ?? 0),
        required: String(issue.required ?? 0),
      });
    case "overstaffed":
      return t("dashboard.staffingIssueOverstaffed", {
        weekday: issue.weekdayLabel,
        time: issue.timeLabel,
        shift: issue.shiftName,
        name: issue.employeeName ?? "—",
        position: issue.assignedQualificationName ?? "—",
      });
    case "qualification_mismatch":
      return t("dashboard.staffingIssueMismatch", {
        weekday: issue.weekdayLabel,
        time: issue.timeLabel,
        shift: issue.shiftName,
        name: issue.employeeName ?? "—",
        position: issue.assignedQualificationName ?? "—",
        missing: issue.missingQualificationName ?? "—",
      });
    case "no_matching_qualification":
      return t("dashboard.staffingIssueNoQual", {
        weekday: issue.weekdayLabel,
        time: issue.timeLabel,
        shift: issue.shiftName,
        name: issue.employeeName ?? "—",
        missing: issue.missingQualificationName ?? "—",
      });
  }
}

function resolveAmpelLevel(input: {
  requiredTotal: number;
  openSlots: number;
  understaffedWindowCount: number;
  hasUnderstaffed: boolean;
  hasPlannedCoverage: boolean;
  hasAssignmentMismatch: boolean;
  hasOverstaffed: boolean;
}): DashboardAreaAmpelLevel {
  if (input.requiredTotal <= 0) return "no_demand";
  if (
    !input.hasUnderstaffed &&
    !input.hasAssignmentMismatch &&
    !input.hasPlannedCoverage
  ) {
    return input.hasOverstaffed ? "overstaffed_only" : "met";
  }
  if (input.hasPlannedCoverage && !input.hasUnderstaffed) {
    return "partial";
  }
  const gapRate = input.openSlots / input.requiredTotal;
  const critical =
    input.openSlots >= 3 || gapRate >= 0.2 || input.understaffedWindowCount >= 2;
  if (critical) return "critical";
  return "partial";
}

function ampelLevelToGaugeVariant(level: DashboardAreaAmpelLevel): StaffingFillGaugeVariant {
  switch (level) {
    case "met":
      return "met";
    case "partial":
      return "planned";
    case "overstaffed_only":
      return "overstaffed";
    case "critical":
      return "understaffed";
    case "no_demand":
      return "met";
  }
}

function entryStaffingGap(entry: TagAreaHeaderStaffingEntry): number {
  const projectedAssigned = entry.projectedAssigned ?? entry.assigned;
  return Math.max(0, entry.required - projectedAssigned);
}

function entryShiftLabel(entry: TagAreaHeaderStaffingEntry): string {
  return entry.shiftTemplateLabel?.trim() ?? "";
}

function resolveStaffingWindowRowStatus(input: {
  understaffed: boolean;
  overstaffed: boolean;
  mismatch: boolean;
  plannedCoverage: boolean;
}): DashboardStaffingWindowRowStatus {
  if (input.mismatch || input.overstaffed) return "overstaffed";
  if (input.understaffed) return "understaffed";
  if (input.plannedCoverage) return "planned";
  return "met";
}

function sortStaffingWindowRows(
  rows: DashboardStaffingWindowRow[]
): DashboardStaffingWindowRow[] {
  return [...rows].sort(
    (left, right) =>
      left.dateISO.localeCompare(right.dateISO) ||
      left.timeFrom.localeCompare(right.timeFrom) ||
      left.shiftName.localeCompare(right.shiftName, "de")
  );
}

function planningShiftsToStaffingRefs(
  shifts: readonly PlanningShift[],
  areaId: string
): PlanningShift[] {
  return shifts.filter((shift) => shift.location_area_id === areaId);
}

function planningShiftsToTagAreaRefs(
  shifts: readonly PlanningShift[],
  areaId: string
): TagAreaShiftRef[] {
  return shifts
    .filter((shift) => shift.location_area_id === areaId)
    .map((shift) => ({
      employeeId: shift.employee_id,
      shift_date: shift.shift_date,
      startTime: shift.startTime,
      endTime: shift.endTime,
    }));
}

export function computeDashboardAreaWeekStats(
  input: ComputeDashboardAreaWeekStatsInput
): DashboardAreaWeekStats {
  const {
    area,
    dates,
    shifts,
    staffingRules,
    staffingOverrides,
    serviceHours,
    areaShiftTemplates,
    qualifications,
    profileQualificationIds,
    compensationByKey,
    staffingEnabled,
    formatTimeLabel,
    weekdayLabel,
    formatCalendarTimeLabel,
    formatCriticalWindowLabel,
    formatWeekdayLabel,
    employeeNameById,
  } = input;

  const areaShifts = planningShiftsToStaffingRefs(shifts, area.id);
  const shiftCount = areaShifts.length;
  const tagAreaShifts = planningShiftsToTagAreaRefs(shifts, area.id);
  const assignmentPresets = areaCalendarAssignmentPresetsForArea(
    areaShiftTemplates.filter((template) => template.location_area_id === area.id)
  );
  const hasAreaShiftTemplates = assignmentPresets.length > 0;

  let assignedTotal = 0;
  let requiredTotal = 0;
  let openSlots = 0;
  let understaffedWindowCount = 0;
  let hasUnderstaffed = false;
  let hasOverstaffed = false;
  let hasPlannedCoverage = false;
  let hasAssignmentMismatch = false;
  let criticalWindowLabel: string | null = null;
  let bestCriticalGap = 0;
  const staffingWindowRows: DashboardStaffingWindowRow[] = [];
  const staffingIssues: DashboardStaffingIssue[] = [];
  const confirmationCountsByKey = buildStaffingWindowConfirmationCountsByKey({
    shifts,
    areaId: area.id,
    dates,
    serviceHours: serviceHours ?? [],
  });

  if (staffingEnabled) {
    for (const dateISO of dates) {
      const rulesForDay = staffingRulesWithOverridesForAreaDate(
        staffingRules,
        staffingOverrides,
        area.id,
        dateISO
      );
      const entries = computeBulkStaffingHeaderEntries({
        staffingRules: rulesForDay,
        areaId: area.id,
        dateISO,
        serviceHours,
        assignments: staffingAssignmentsForAreaDay(areaShifts, dateISO, area.id),
        assignmentPresets,
        qualifications,
        profileQualificationIds,
        employeeNameById,
        formatTimeLabel,
        weekdayLabel,
        formatCalendarTimeLabel,
      });

      const weekdayLabelForRow = formatWeekdayLabel?.(dateISO) ?? dateISO;

      if (!isAreaOpenOnDate(serviceHours, area.id, dateISO)) {
        const shiftsOnDay = areaShifts.filter(
          (shift) => shift.shift_date === dateISO
        );
        const hasUnplannedShifts = shiftsOnDay.length > 0;
        staffingWindowRows.push({
          rowKind: "no_service_hours",
          dateISO,
          serviceHourId: `no-service:${dateISO}`,
          weekdayLabel: weekdayLabelForRow,
          timeFrom: "",
          timeTo: "",
          shiftName: "",
          assigned: hasUnplannedShifts ? shiftsOnDay.length : 0,
          required: hasUnplannedShifts ? shiftsOnDay.length : 0,
          status: "met",
          hasUnplannedShifts,
        });
        continue;
      }

      for (const entry of entries) {
        assignedTotal += entry.assigned;
        requiredTotal += entry.required;

        const entryUnderstaffed = isTagAreaHeaderStaffingEntryUnderstaffed(entry);
        const entryOverstaffed = isTagAreaHeaderStaffingEntryOverstaffed(entry);
        const entryMismatch = isTagAreaHeaderStaffingEntryAssignmentMismatch(entry);

        const entryPlannedCoverage =
          isTagAreaHeaderStaffingEntryPlannedCoverage(entry);

        if (entryUnderstaffed) {
          hasUnderstaffed = true;
          understaffedWindowCount += 1;
          const gap = entryStaffingGap(entry);
          openSlots += gap;
          if (gap > bestCriticalGap) {
            bestCriticalGap = gap;
            criticalWindowLabel =
              formatCriticalWindowLabel?.(dateISO, entry) ??
              entry.calendarTimeLabel ??
              entry.label;
          }
        }
        if (entryOverstaffed) hasOverstaffed = true;
        if (entryMismatch) hasAssignmentMismatch = true;
        if (entryPlannedCoverage) hasPlannedCoverage = true;

        if (entry.required > 0) {
          const hour = serviceHours.find((item) => item.id === entry.serviceHourId);
          const demandTimes =
            personalbedarfDemandTimesForEntry(
              entry.serviceHourId,
              serviceHours,
              assignmentPresets,
              rulesForDay,
              area.id
            ) ??
            (hour?.start_time && hour?.end_time
              ? {
                  startTime: hour.start_time.slice(0, 5),
                  endTime: hour.end_time.slice(0, 5),
                  serviceHourId: entry.serviceHourId,
                }
              : null);

          const timeFrom = demandTimes?.startTime ?? "—";
          const timeTo = demandTimes?.endTime ?? "—";
          const rowConflicts = buildDashboardStaffingIssuesForEntry({
            dateISO,
            weekdayLabel: weekdayLabelForRow,
            entry,
            shiftName: entryShiftLabel(entry),
          });
          const confirmationCounts = confirmationCountsByKey.get(
            staffingWindowConfirmationCountsKey(dateISO, entry.serviceHourId)
          );

          staffingWindowRows.push({
            rowKind: "staffing_window",
            dateISO,
            serviceHourId: entry.serviceHourId,
            weekdayLabel: weekdayLabelForRow,
            timeFrom,
            timeTo,
            shiftName: entryShiftLabel(entry),
            assigned: entry.assigned,
            required: entry.required,
            status: resolveStaffingWindowRowStatus({
              understaffed: entryUnderstaffed,
              overstaffed: entryOverstaffed,
              mismatch: entryMismatch,
              plannedCoverage: entryPlannedCoverage,
            }),
            hasConflict: rowConflicts.length > 0,
            staffingConflicts:
              rowConflicts.length > 0 ? rowConflicts : undefined,
            confirmationCounts,
          });

          if (rowConflicts.length > 0) {
            staffingIssues.push(...rowConflicts);
          }
        }
      }
    }
  }

  let totalHours = 0;
  let baseCost = 0;
  let surchargeCost = 0;
  let hasCompensation = false;
  let currency = "EUR";

  for (const dateISO of dates) {
    const dayStats = computeTagAreaDayFooterStatsForDate(
      dateISO,
      tagAreaShifts,
      compensationByKey
    );
    totalHours += dayStats.totalHours;
    baseCost += dayStats.baseCost;
    surchargeCost += dayStats.surchargeCost;
    if (dayStats.hasCompensation) {
      hasCompensation = true;
      currency = dayStats.currency;
    }
  }

  totalHours = Math.round(totalHours * 10) / 10;
  baseCost = Math.round(baseCost * 100) / 100;
  surchargeCost = Math.round(surchargeCost * 100) / 100;
  const totalCost = Math.round((baseCost + surchargeCost) * 100) / 100;

  const ampelLevel = staffingEnabled
    ? resolveAmpelLevel({
        requiredTotal,
        openSlots,
        understaffedWindowCount,
        hasUnderstaffed,
        hasPlannedCoverage,
        hasAssignmentMismatch,
        hasOverstaffed,
      })
    : "no_demand";

  const confirmationConflictStatuses = collectAreaConfirmationConflictStatuses(
    shifts,
    area.id,
    dates,
    serviceHours ?? []
  );

  return {
    areaId: area.id,
    areaName: area.name,
    sortOrder: area.sort_order,
    shiftCount,
    assignedTotal,
    requiredTotal,
    openSlots,
    understaffedWindowCount,
    ampelLevel,
    gaugeVariant: ampelLevelToGaugeVariant(ampelLevel),
    criticalWindowLabel,
    staffingWindowRows: sortStaffingWindowRows(staffingWindowRows),
    staffingIssues: sortDashboardStaffingIssues(staffingIssues),
    confirmationConflictStatuses,
    totalHours,
    baseCost,
    surchargeCost,
    totalCost,
    hasCompensation,
    currency,
    hasAssignmentMismatch,
    hasAreaShiftTemplates,
  };
}

export function computeDashboardLocationWeekRollup(
  areaStats: readonly DashboardAreaWeekStats[]
): DashboardLocationWeekRollup {
  let assignedTotal = 0;
  let requiredTotal = 0;
  let openSlots = 0;
  let criticalAreaCount = 0;
  let totalHours = 0;
  let baseCost = 0;
  let surchargeCost = 0;
  let hasCompensation = false;
  let currency = "EUR";

  for (const stats of areaStats) {
    assignedTotal += stats.assignedTotal;
    requiredTotal += stats.requiredTotal;
    openSlots += stats.openSlots;
    if (stats.ampelLevel === "critical") criticalAreaCount += 1;
    totalHours += stats.totalHours;
    baseCost += stats.baseCost;
    surchargeCost += stats.surchargeCost;
    if (stats.hasCompensation) {
      hasCompensation = true;
      currency = stats.currency;
    }
  }

  return {
    assignedTotal,
    requiredTotal,
    openSlots,
    criticalAreaCount,
    totalHours: Math.round(totalHours * 10) / 10,
    baseCost: Math.round(baseCost * 100) / 100,
    surchargeCost: Math.round(surchargeCost * 100) / 100,
    totalCost: Math.round((baseCost + surchargeCost) * 100) / 100,
    hasCompensation,
    currency,
  };
}

export function sortDashboardAreaWeekStats(
  stats: readonly DashboardAreaWeekStats[]
): DashboardAreaWeekStats[] {
  return [...stats].sort((left, right) => {
    const orderDiff = left.sortOrder - right.sortOrder;
    if (orderDiff !== 0) return orderDiff;
    return left.areaName.localeCompare(right.areaName, "de");
  });
}
