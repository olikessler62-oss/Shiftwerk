import {
  resolveShiftTemplateNameForAssignment,
  type AreaCalendarAssignmentPreset,
} from "@/lib/areacalendar-assignment-presets";
import type { PlanningShiftDisplayPart } from "@/lib/planning-overnight-shift-display";
import { formatTime, formatTimeRange } from "@/lib/planning-utils";
import type { PlanningShift } from "@/lib/planning-shift-card";
import {
  formatShiftCardTooltipPlainText,
  type ShiftCardTooltipData,
  resolveJobLabelsForShiftAssignment,
} from "@/lib/shift-card-display-content";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { LocationAreaStaffing, Qualification, ShiftConfirmationStatus } from "@schichtwerk/types";

export type PlanningShiftJobContext = {
  dateISO: string;
  defaultAreaId: string | null;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  profileQualificationIds: Record<string, string[]>;
  qualificationNameById: ReadonlyMap<string, string>;
  qualificationSortOrder: ReadonlyMap<string, number>;
};

export function createPlanningShiftJobContextMaps(
  qualifications: readonly Qualification[]
): {
  qualificationNameById: ReadonlyMap<string, string>;
  qualificationSortOrder: ReadonlyMap<string, number>;
} {
  return {
    qualificationNameById: new Map(
      qualifications.map((qualification) => [qualification.id, qualification.name])
    ),
    qualificationSortOrder: new Map(
      qualifications.map((qualification) => [
        qualification.id,
        qualification.sort_order,
      ])
    ),
  };
}

export function resolvePlanningShiftJobsLabel(
  shift: PlanningShift,
  context: PlanningShiftJobContext
): string {
  const areaId = shift.location_area_id ?? context.defaultAreaId ?? "";
  if (!areaId) return "";

  return resolveJobLabelsForShiftAssignment(
    shift.employee_id,
    areaId,
    context.dateISO,
    shift.startTime,
    shift.endTime,
    context.staffingRules,
    context.serviceHours,
    context.assignmentPresets,
    context.profileQualificationIds,
    context.qualificationNameById,
    context.qualificationSortOrder
  );
}

function buildPlanningTooltipData(
  options?: {
    employeeName?: string;
    confirmationStatusLine?: string;
    confirmationStatus?: ShiftConfirmationStatus;
    jobsLabel?: string;
    isPastShift?: boolean;
  },
  templateName?: string | null,
  timeLabel?: string
): ShiftCardTooltipData {
  return {
    employeeName: options?.employeeName,
    shiftTemplateName: templateName ?? null,
    timeLabel,
    jobsLabel: options?.jobsLabel?.trim() || undefined,
    confirmationStatusLine: options?.confirmationStatusLine,
    confirmationStatus: options?.confirmationStatus,
    isPastShift: options?.isPastShift,
  };
}

export type PlanningExpandedShiftCardContent = {
  /** Exakt passende Schichtvorlage (Von/Bis), sonst null. */
  templateName: string | null;
  timeLabel: string;
  tooltip: ShiftCardTooltipData;
  tooltipBody: string;
};

export function resolvePlanningShiftTemplateName(
  shift: PlanningShift,
  presets: readonly AreaCalendarAssignmentPreset[]
): string | null {
  return resolveShiftTemplateNameForAssignment(
    shift.startTime,
    shift.endTime,
    shift.area_shift_template_id,
    presets
  );
}

export function buildPlanningShiftSegmentTimeLabel(
  part: PlanningShiftDisplayPart,
  startTime: string,
  endTime: string
): string {
  if (part === "overnight-start") {
    return `${formatTime(startTime)} -`;
  }
  if (part === "overnight-end") {
    return formatTime(endTime);
  }
  return formatTimeRange(startTime, endTime);
}

export function buildPlanningShiftSegmentCardContent(
  shift: PlanningShift,
  presets: readonly AreaCalendarAssignmentPreset[],
  part: PlanningShiftDisplayPart,
  options?: {
    employeeName?: string;
    confirmationStatusLine?: string;
    confirmationStatus?: ShiftConfirmationStatus;
    jobsLabel?: string;
    isPastShift?: boolean;
    formatTemplateTooltipLine?: (templateName: string) => string;
    formatDeploymentTimeTooltipLine?: () => string;
    formatJobTooltipLine?: (jobs: string) => string;
    formatStatusTooltipLine?: (status: string) => string;
  }
): PlanningExpandedShiftCardContent {
  const timeLabel = buildPlanningShiftSegmentTimeLabel(
    part,
    shift.startTime,
    shift.endTime
  );
  const templateName = resolvePlanningShiftTemplateName(shift, presets);
  const fullTimeLabel = formatTimeRange(shift.startTime, shift.endTime);

  const tooltip = buildPlanningTooltipData(
    options,
    templateName,
    fullTimeLabel
  );

  return {
    templateName,
    timeLabel,
    tooltip,
    tooltipBody: formatShiftCardTooltipPlainText(tooltip, {
      formatShiftLine: options?.formatTemplateTooltipLine,
      formatDeploymentTimeLine: options?.formatDeploymentTimeTooltipLine,
      formatJobLine: options?.formatJobTooltipLine,
      formatStatusLine: options?.formatStatusTooltipLine,
    }),
  };
}

export function buildPlanningExpandedShiftCardContent(
  shift: PlanningShift,
  presets: readonly AreaCalendarAssignmentPreset[],
  options?: {
    employeeName?: string;
    confirmationStatusLine?: string;
    confirmationStatus?: ShiftConfirmationStatus;
    jobsLabel?: string;
    isPastShift?: boolean;
    formatTemplateTooltipLine?: (templateName: string) => string;
    formatDeploymentTimeTooltipLine?: () => string;
    formatJobTooltipLine?: (jobs: string) => string;
    formatStatusTooltipLine?: (status: string) => string;
  }
): PlanningExpandedShiftCardContent {
  const timeLabel = formatTimeRange(shift.startTime, shift.endTime);
  const templateName = resolvePlanningShiftTemplateName(shift, presets);

  const tooltip = buildPlanningTooltipData(options, templateName, timeLabel);

  return {
    templateName,
    timeLabel,
    tooltip,
    tooltipBody: formatShiftCardTooltipPlainText(tooltip, {
      formatShiftLine: options?.formatTemplateTooltipLine,
      formatDeploymentTimeLine: options?.formatDeploymentTimeTooltipLine,
      formatJobLine: options?.formatJobTooltipLine,
      formatStatusLine: options?.formatStatusTooltipLine,
    }),
  };
}
