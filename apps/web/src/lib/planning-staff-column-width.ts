import {
  employeeWeekHours,
  formatPlanningHoursRatio,
  type PlanningShiftRef,
} from "@/lib/planning-utils";
import type { Profile } from "@schichtwerk/types";

export const PLANNING_STAFF_COLUMN_WIDTH_TOLERANCE_PX = 10;
/** Farbstreifen, Abstände und Zell-Padding links/rechts. */
export const PLANNING_STAFF_COLUMN_CHROME_PX = 35;
export const PLANNING_STAFF_COLUMN_MIN_WIDTH_PX = 120;

const NAME_FONT =
  "500 14px Inter, ui-sans-serif, system-ui, sans-serif";
const SUBTITLE_FONT =
  "400 12px Inter, ui-sans-serif, system-ui, sans-serif";
const SUBTITLE_EMPHASIS_FONT =
  "500 12px Inter, ui-sans-serif, system-ui, sans-serif";
const HEADER_FONT =
  "600 12px Inter, ui-sans-serif, system-ui, sans-serif";

function measureWithFont(text: string, font: string): number {
  if (!text) return 0;
  if (typeof document === "undefined") {
    return text.length * (font === NAME_FONT ? 7.8 : 6.8);
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * 6.8;
  context.font = font;
  return context.measureText(text).width;
}

function measurePlanningStaffColumnNameText(text: string): number {
  return measureWithFont(text, NAME_FONT);
}

function measurePlanningStaffColumnSecondaryText(
  text: string,
  emphasis = false
): number {
  return measureWithFont(text, emphasis ? SUBTITLE_EMPHASIS_FONT : SUBTITLE_FONT);
}

function measurePlanningStaffColumnHeaderText(text: string): number {
  return measureWithFont(text, HEADER_FONT);
}

/** Breite der Personal-Spalte aus dem längsten vorhandenen Anzeigetext (+ Toleranz). */
export function resolvePlanningStaffColumnWidthPx(input: {
  employees: readonly Pick<Profile, "id" | "full_name" | "weekly_hours">[];
  shifts: readonly PlanningShiftRef[];
  locale: string;
  staffColumnHeaderLabel: string;
  employeeHoursLabel: string;
}): number {
  let maxContentWidthPx = measurePlanningStaffColumnHeaderText(
    input.staffColumnHeaderLabel
  );

  for (const employee of input.employees) {
    maxContentWidthPx = Math.max(
      maxContentWidthPx,
      measurePlanningStaffColumnNameText(employee.full_name)
    );

    const weekH = employeeWeekHours(employee.id, input.shifts);
    const targetH = employee.weekly_hours ?? 40;
    const hoursLine = `${input.employeeHoursLabel} ${formatPlanningHoursRatio(
      weekH,
      targetH,
      input.locale
    )}`;
    maxContentWidthPx = Math.max(
      maxContentWidthPx,
      measurePlanningStaffColumnSecondaryText(
        hoursLine,
        weekH > targetH
      )
    );
  }

  return Math.max(
    PLANNING_STAFF_COLUMN_MIN_WIDTH_PX,
    Math.ceil(
      maxContentWidthPx +
        PLANNING_STAFF_COLUMN_CHROME_PX +
        PLANNING_STAFF_COLUMN_WIDTH_TOLERANCE_PX
    )
  );
}
