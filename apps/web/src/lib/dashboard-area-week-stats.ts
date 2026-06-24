import { areaCalendarAssignmentPresetsForArea } from "@/lib/areacalendar-assignment-presets";
import {
  computeBulkStaffingHeaderEntries,
  staffingAssignmentsForAreaDay,
} from "@/lib/bulk-staffing-header";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type {
  AreaServiceHourRef,
  TagAreaHeaderStaffingEntry,
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
  isTagAreaHeaderStaffingEntryUnderstaffed,
  type StaffingFillGaugeVariant,
} from "@/lib/tag-area-header-staffing-display";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  Qualification,
} from "@schichtwerk/types";

export type DashboardAreaAmpelLevel =
  | "no_demand"
  | "met"
  | "partial"
  | "critical"
  | "overstaffed_only";

export type DashboardAreaWeekStats = {
  areaId: string;
  areaName: string;
  assignedTotal: number;
  requiredTotal: number;
  openSlots: number;
  understaffedWindowCount: number;
  ampelLevel: DashboardAreaAmpelLevel;
  gaugeVariant: StaffingFillGaugeVariant;
  criticalWindowLabel: string | null;
  totalHours: number;
  baseCost: number;
  surchargeCost: number;
  totalCost: number;
  hasCompensation: boolean;
  currency: string;
  hasAssignmentMismatch: boolean;
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
};

function resolveAmpelLevel(input: {
  requiredTotal: number;
  openSlots: number;
  understaffedWindowCount: number;
  hasUnderstaffed: boolean;
  hasAssignmentMismatch: boolean;
  hasOverstaffed: boolean;
}): DashboardAreaAmpelLevel {
  if (input.requiredTotal <= 0) return "no_demand";
  if (!input.hasUnderstaffed && !input.hasAssignmentMismatch) {
    return input.hasOverstaffed ? "overstaffed_only" : "met";
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
    case "overstaffed_only":
    case "partial":
      return "overstaffed";
    case "critical":
      return "understaffed";
    case "no_demand":
      return "met";
  }
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
  } = input;

  const areaShifts = planningShiftsToStaffingRefs(shifts, area.id);
  const tagAreaShifts = planningShiftsToTagAreaRefs(shifts, area.id);
  const assignmentPresets = areaCalendarAssignmentPresetsForArea(
    areaShiftTemplates.filter((template) => template.location_area_id === area.id)
  );

  let assignedTotal = 0;
  let requiredTotal = 0;
  let openSlots = 0;
  let understaffedWindowCount = 0;
  let hasUnderstaffed = false;
  let hasOverstaffed = false;
  let hasAssignmentMismatch = false;
  let criticalWindowLabel: string | null = null;
  let bestCriticalGap = 0;

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
        formatTimeLabel,
        weekdayLabel,
        formatCalendarTimeLabel,
      });

      for (const entry of entries) {
        assignedTotal += entry.assigned;
        requiredTotal += entry.required;

        const entryUnderstaffed = isTagAreaHeaderStaffingEntryUnderstaffed(entry);
        const entryOverstaffed = isTagAreaHeaderStaffingEntryOverstaffed(entry);
        const entryMismatch = isTagAreaHeaderStaffingEntryAssignmentMismatch(entry);

        if (entryUnderstaffed) {
          hasUnderstaffed = true;
          understaffedWindowCount += 1;
          const gap = Math.max(0, entry.required - entry.assigned);
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
        hasAssignmentMismatch,
        hasOverstaffed,
      })
    : "no_demand";

  return {
    areaId: area.id,
    areaName: area.name,
    assignedTotal,
    requiredTotal,
    openSlots,
    understaffedWindowCount,
    ampelLevel,
    gaugeVariant: ampelLevelToGaugeVariant(ampelLevel),
    criticalWindowLabel,
    totalHours,
    baseCost,
    surchargeCost,
    totalCost,
    hasCompensation,
    currency,
    hasAssignmentMismatch,
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
    const levelRank = (level: DashboardAreaAmpelLevel) => {
      switch (level) {
        case "critical":
          return 0;
        case "partial":
          return 1;
        case "overstaffed_only":
          return 2;
        case "met":
          return 3;
        case "no_demand":
          return 4;
      }
    };
    const rankDiff = levelRank(left.ampelLevel) - levelRank(right.ampelLevel);
    if (rankDiff !== 0) return rankDiff;
    const gapDiff = right.openSlots - left.openSlots;
    if (gapDiff !== 0) return gapDiff;
    return left.areaName.localeCompare(right.areaName, "de");
  });
}
