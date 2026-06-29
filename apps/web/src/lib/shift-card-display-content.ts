import { formatTimeRange } from "@/lib/planning-utils";
import { shortenShiftTypeDisplayName } from "@/lib/profile-availability-label";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import { staffingQualificationIdsForAssignment } from "@/lib/bulk-shift-qualification";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import { resolveShiftTemplateNameForAssignment } from "@/lib/areacalendar-assignment-presets";
import { SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX } from "@/lib/shift-card-time-gradient";
import type { LocationAreaStaffing } from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";

export type ShiftCardDisplayInput = {
  employeeName: string;
  startTime: string;
  endTime: string;
  shiftName: string;
  areaShiftTemplateId?: string | null;
  locationAreaId?: string | null;
};

export type ShiftCardTooltipFormatOptions = {
  assignmentPresets?: readonly AreaCalendarAssignmentPreset[];
  /** Fester Einsatzort (eine Bereichszeile). */
  areaName?: string;
  /** Lookup für Schichten mit locationAreaId (z. B. einfache Planung). */
  areaNameById?: ReadonlyMap<string, string>;
  /** Fallback, wenn die Schicht keinen locationAreaId hat. */
  fallbackAreaId?: string;
  formatShiftTooltipLine?: (name: string) => string;
  formatDeploymentTimeTooltipLine?: () => string;
  formatJobTooltipLine?: (jobs: string) => string;
};

export function formatShiftCardTooltipShiftLine(name: string): string {
  return `Schicht: ${name}`;
}

export function formatShiftCardTooltipDeploymentTimeLabel(): string {
  return "Einsatzzeit:";
}

export function shiftCardTooltipShowsDeploymentTimeLabel(
  data: Pick<
    ShiftCardTooltipData,
    "shiftTemplateName" | "timeLabel"
  >
): boolean {
  return !data.shiftTemplateName?.trim() && Boolean(data.timeLabel?.trim());
}

export function formatShiftCardTooltipJobLine(names: string): string {
  return `Tätigkeit: ${names}`;
}

export type ShiftCardTooltipData = {
  employeeName?: string;
  /** Einsatzort (Mitarbeiter-Kalender). */
  areaName?: string;
  shiftTemplateName?: string | null;
  /** Schichtname ohne passende Vorlage (Bereich-Kalender). */
  shiftNameWithoutTemplate?: string | null;
  timeLabel?: string;
  jobsLabel?: string;
  confirmationStatusLine?: string;
  confirmationStatus?: ShiftConfirmationStatus;
  isPastShift?: boolean;
};

export function formatShiftCardTooltipPlainText(
  data: ShiftCardTooltipData,
  options?: {
    formatShiftLine?: (name: string) => string;
    formatDeploymentTimeLine?: () => string;
    formatJobLine?: (names: string) => string;
    formatStatusLine?: (status: string) => string;
  }
): string {
  const lines: string[] = [];
  if (data.employeeName?.trim()) {
    lines.push(data.employeeName.trim());
  }
  if (data.areaName?.trim()) {
    lines.push(data.areaName.trim());
  }
  if (data.shiftTemplateName?.trim()) {
    lines.push(
      options?.formatShiftLine?.(data.shiftTemplateName.trim()) ??
        formatShiftCardTooltipShiftLine(data.shiftTemplateName.trim())
    );
  } else if (shiftCardTooltipShowsDeploymentTimeLabel(data)) {
    lines.push(
      options?.formatDeploymentTimeLine?.() ??
        formatShiftCardTooltipDeploymentTimeLabel()
    );
  } else if (data.shiftNameWithoutTemplate?.trim()) {
    lines.push(data.shiftNameWithoutTemplate.trim());
  }
  if (data.timeLabel?.trim()) {
    lines.push(data.timeLabel.trim());
  }
  if (data.jobsLabel?.trim()) {
    lines.push(
      options?.formatJobLine?.(data.jobsLabel.trim()) ??
        formatShiftCardTooltipJobLine(data.jobsLabel.trim())
    );
  }
  if (data.confirmationStatusLine?.trim()) {
    lines.push(
      options?.formatStatusLine?.(data.confirmationStatusLine.trim()) ??
        `Status: ${data.confirmationStatusLine.trim()}`
    );
  }
  return lines.join("\n");
}

export type ShiftCardDensity = "two-line" | "compact" | "marker";

export type ShiftCardDisplayContent = {
  firstName: string;
  lastName: string;
  /** Kürzere Bezeichnung: Uhrzeit oder Schichtname. */
  line1Secondary: string;
  /** Im Tooltip immer beide; in der Karte je nach Platz. */
  timeLabel: string;
  shiftLabel: string;
  /** Passende Schichtvorlage für exakte Von/Bis-Zeiten, sonst null. */
  templateName: string | null;
  jobsLabel: string;
  tooltip: ShiftCardTooltipData;
  tooltipBody: string;
};

/** Uhrzeit ist die primäre Bezeichnung, wenn keine Schichtvorlage passt. */
export function shiftCardTimeLabelIsPrimary(
  display: Pick<ShiftCardDisplayContent, "shiftLabel" | "templateName">
): boolean {
  return !display.shiftLabel.trim() && !display.templateName?.trim();
}

const CARD_HORIZONTAL_PADDING_PX = 12;
const CARD_GAP_PX = 6;
const TWO_LINE_ROW_GAP_PX = 1;

const PRIMARY_FONT = "500 11px Inter, ui-sans-serif, system-ui, sans-serif";
const SECONDARY_FONT = "400 10px Inter, ui-sans-serif, system-ui, sans-serif";

export function splitEmployeeDisplayName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "—", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export function resolveJobLabelsForEmployee(
  employeeId: string,
  profileQualificationIds: Record<string, string[]>,
  qualificationNameById: ReadonlyMap<string, string>
): string {
  const ids = profileQualificationIds[employeeId] ?? [];
  return ids
    .map((id) => qualificationNameById.get(id))
    .filter((name): name is string => Boolean(name?.trim()))
    .join(", ");
}

/** Jobs = Schnittmenge aus Personalbedarf im Schichtfenster und Mitarbeiter-Funktionen. */
export function resolveJobLabelsForShiftAssignment(
  employeeId: string,
  areaId: string,
  dateISO: string,
  startTime: string,
  endTime: string,
  staffingRules: readonly LocationAreaStaffing[],
  serviceHours: readonly AreaServiceHourRef[],
  assignmentPresets: readonly AreaCalendarAssignmentPreset[],
  profileQualificationIds: Record<string, string[]>,
  qualificationNameById: ReadonlyMap<string, string>,
  qualificationSortOrder: ReadonlyMap<string, number>
): string {
  const demandIds = staffingQualificationIdsForAssignment(
    staffingRules,
    areaId,
    serviceHours,
    assignmentPresets,
    dateISO,
    startTime,
    endTime
  );
  const employeeQualIds = profileQualificationIds[employeeId] ?? [];
  if (demandIds.size === 0) return "";

  const relevantIds = employeeQualIds.filter((id) => demandIds.has(id));
  if (relevantIds.length === 0) return "";

  return relevantIds
    .slice()
    .sort(
      (a, b) =>
        (qualificationSortOrder.get(a) ?? 0) -
        (qualificationSortOrder.get(b) ?? 0)
    )
    .map((id) => qualificationNameById.get(id))
    .filter((name): name is string => Boolean(name?.trim()))
    .join(", ");
}

function pickShorterSecondaryLabel(
  shiftLabel: string,
  timeLabel: string
): string {
  if (!shiftLabel.trim()) return timeLabel;
  if (timeLabel.length <= shiftLabel.length) return timeLabel;
  return shiftLabel;
}

export function resolveShiftCardTooltipAreaName(
  shift: Pick<ShiftCardDisplayInput, "locationAreaId">,
  options?: ShiftCardTooltipFormatOptions
): string | undefined {
  const explicitAreaName = options?.areaName?.trim();
  if (explicitAreaName) return explicitAreaName;

  const areaId = shift.locationAreaId ?? options?.fallbackAreaId;
  if (!areaId || !options?.areaNameById) return undefined;

  return options.areaNameById.get(areaId)?.trim() || undefined;
}

export function buildShiftCardDisplayContent(
  shift: ShiftCardDisplayInput,
  jobsLabel?: string | null,
  tooltipOptions?: ShiftCardTooltipFormatOptions
): ShiftCardDisplayContent {
  const { firstName, lastName } = splitEmployeeDisplayName(shift.employeeName);
  const timeLabel = formatTimeRange(shift.startTime, shift.endTime);
  const shiftLabel = shift.shiftName.trim()
    ? shortenShiftTypeDisplayName(shift.shiftName)
    : "";
  const normalizedJobsLabel = (jobsLabel ?? "").trim();

  const templateName =
    tooltipOptions?.assignmentPresets &&
    tooltipOptions.assignmentPresets.length > 0
      ? resolveShiftTemplateNameForAssignment(
          shift.startTime,
          shift.endTime,
          shift.areaShiftTemplateId,
          tooltipOptions.assignmentPresets
        )
      : null;

  const line1Secondary = pickShorterSecondaryLabel(shiftLabel, timeLabel);

  const tooltip: ShiftCardTooltipData = {
    employeeName: shift.employeeName,
    areaName: resolveShiftCardTooltipAreaName(shift, tooltipOptions),
    shiftTemplateName: templateName,
    shiftNameWithoutTemplate: templateName ? null : shiftLabel || null,
    timeLabel,
    jobsLabel: normalizedJobsLabel || undefined,
  };

  const tooltipBody = formatShiftCardTooltipPlainText(tooltip, {
    formatShiftLine: tooltipOptions?.formatShiftTooltipLine,
    formatDeploymentTimeLine: tooltipOptions?.formatDeploymentTimeTooltipLine,
    formatJobLine: tooltipOptions?.formatJobTooltipLine,
  });

  return {
    firstName,
    lastName,
    line1Secondary,
    timeLabel,
    shiftLabel,
    templateName,
    jobsLabel: normalizedJobsLabel,
    tooltip,
    tooltipBody,
  };
}

function measureTextWidth(text: string, font: string): number {
  if (!text) return 0;
  if (typeof document === "undefined") return text.length * 6.2;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * 6.2;
  context.font = font;
  return context.measureText(text).width;
}

function rowContentWidth(left: string, right: string, font: string): number {
  if (!right) return measureTextWidth(left, font);
  return (
    measureTextWidth(left, font) + CARD_GAP_PX + measureTextWidth(right, font)
  );
}

/** Geschätzte Mindestbreite für lesbare Darstellung (ohne Mitarbeiterstreifen). */
export function measureShiftCardContentMinWidth(
  content: ShiftCardDisplayContent,
  density: Exclude<ShiftCardDensity, "marker">
): number {
  if (density === "compact") {
    const line = content.lastName
      ? `${content.firstName} ${content.lastName}`
      : content.firstName;
    return (
      CARD_HORIZONTAL_PADDING_PX +
      rowContentWidth(line, content.line1Secondary, PRIMARY_FONT)
    );
  }

  const line1 = rowContentWidth(
    content.firstName,
    content.lastName,
    PRIMARY_FONT
  );
  const line2Lead = content.shiftLabel || content.timeLabel;
  const line2 = rowContentWidth(line2Lead, content.jobsLabel, SECONDARY_FONT);

  return (
    CARD_HORIZONTAL_PADDING_PX +
    Math.max(line1, line2) +
    TWO_LINE_ROW_GAP_PX
  );
}

export const SHIFT_CARD_TWO_LINE_MIN_FALLBACK_PX = 120;
export const SHIFT_CARD_COMPACT_MIN_FALLBACK_PX = 48;

/** Nur Farbbalken — darunter kein lesbarer Text. */
export const SHIFT_CARD_MARKER_MAX_CELL_WIDTH_PX = 22;

/** Mindestbreite Texttrack für gekürzten Text (1–2 Zeichen + Ellipse). */
export const SHIFT_CARD_MIN_TEXT_CONTENT_TRACK_PX = 6;

export function resolveShiftCardDensity(
  cellWidthPx: number,
  twoLineMinWidthPx: number,
  compactMinWidthPx: number
): ShiftCardDensity {
  if (cellWidthPx < SHIFT_CARD_MARKER_MAX_CELL_WIDTH_PX) return "marker";

  const contentTrack = Math.max(0, cellWidthPx - SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX);
  if (contentTrack >= twoLineMinWidthPx) return "two-line";
  if (contentTrack >= Math.max(SHIFT_CARD_MIN_TEXT_CONTENT_TRACK_PX, compactMinWidthPx)) {
    return "compact";
  }
  if (contentTrack >= SHIFT_CARD_MIN_TEXT_CONTENT_TRACK_PX) return "compact";
  return "marker";
}

export function estimateShiftCardMinWidths(
  content: ShiftCardDisplayContent
): { twoLinePx: number; compactPx: number } {
  return {
    twoLinePx: Math.max(
      SHIFT_CARD_TWO_LINE_MIN_FALLBACK_PX,
      measureShiftCardContentMinWidth(content, "two-line")
    ),
    compactPx: Math.max(
      SHIFT_CARD_COMPACT_MIN_FALLBACK_PX,
      measureShiftCardContentMinWidth(content, "compact")
    ),
  };
}

export const SHIFT_CARD_ROW_GAP_CLASS = "gap-0.5";
