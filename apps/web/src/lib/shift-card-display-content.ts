import { formatTimeRange } from "@/lib/planning-utils";
import { shortenShiftTypeDisplayName } from "@/lib/profile-availability-label";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import { staffingQualificationIdsForAssignment } from "@/lib/bulk-shift-qualification";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import { SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX } from "@/lib/shift-card-time-gradient";
import type { LocationAreaStaffing } from "@schichtwerk/types";

export type ShiftCardDisplayInput = {
  employeeName: string;
  startTime: string;
  endTime: string;
  shiftName: string;
};

export type ShiftCardDensity = "two-line" | "compact" | "marker";

export type ShiftCardDisplayContent = {
  firstName: string;
  lastName: string;
  /** Kürzere Bezeichnung: Uhrzeit oder Schichtname. */
  line1Secondary: string;
  /** Im Tooltip immer beide; in der Karte je nach Platz. */
  timeLabel: string;
  shiftLabel: string;
  jobsLabel: string;
  tooltipBody: string;
};

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
  assignmentPresets: readonly DashboardAssignmentPreset[],
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
  const relevantIds =
    demandIds.size > 0
      ? employeeQualIds.filter((id) => demandIds.has(id))
      : employeeQualIds;

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

export function buildShiftCardDisplayContent(
  shift: ShiftCardDisplayInput,
  jobsLabel: string
): ShiftCardDisplayContent {
  const { firstName, lastName } = splitEmployeeDisplayName(shift.employeeName);
  const timeLabel = formatTimeRange(shift.startTime, shift.endTime);
  const shiftLabel = shift.shiftName.trim()
    ? shortenShiftTypeDisplayName(shift.shiftName)
    : "";
  const line1Secondary = pickShorterSecondaryLabel(shiftLabel, timeLabel);

  const tooltipLines = [
    shift.employeeName.trim(),
    shiftLabel || null,
    timeLabel,
    jobsLabel || null,
  ].filter((line): line is string => Boolean(line?.trim()));

  return {
    firstName,
    lastName,
    line1Secondary,
    timeLabel,
    shiftLabel,
    jobsLabel,
    tooltipBody: tooltipLines.join("\n"),
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

export function resolveShiftCardDensity(
  cellWidthPx: number,
  twoLineMinWidthPx: number,
  compactMinWidthPx: number
): ShiftCardDensity {
  if (cellWidthPx < 52) return "marker";

  const contentTrack = Math.max(0, cellWidthPx - SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX);
  if (contentTrack >= twoLineMinWidthPx) return "two-line";
  if (contentTrack >= compactMinWidthPx) return "compact";
  return "marker";
}

export const SHIFT_CARD_TWO_LINE_MIN_FALLBACK_PX = 120;
export const SHIFT_CARD_COMPACT_MIN_FALLBACK_PX = 72;

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
