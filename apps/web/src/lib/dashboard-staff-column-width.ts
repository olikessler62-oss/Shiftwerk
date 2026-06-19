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

export type PlanningStaffColumnWidthInput = {
  employees: readonly Pick<Profile, "id" | "full_name" | "weekly_hours">[];
  shifts: readonly PlanningShiftRef[];
  locale: string;
  staffColumnHeaderLabel: string;
  employeeHoursLabel: string;
};

function estimateTextWidthPx(text: string, font: string): number {
  if (!text) return 0;
  return text.length * (font === NAME_FONT ? 7.8 : 6.8);
}

function measureTextWidthPx(text: string, font: string): number {
  if (!text) return 0;
  if (typeof document === "undefined") {
    return estimateTextWidthPx(text, font);
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return estimateTextWidthPx(text, font);
  context.font = font;
  return context.measureText(text).width;
}

function computePlanningStaffColumnWidthPx(
  input: PlanningStaffColumnWidthInput,
  measureText: (text: string, font: string) => number
): number {
  let maxContentWidthPx = measureText(input.staffColumnHeaderLabel, HEADER_FONT);

  for (const employee of input.employees) {
    maxContentWidthPx = Math.max(
      maxContentWidthPx,
      measureText(employee.full_name, NAME_FONT)
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
      measureText(
        hoursLine,
        weekH > targetH ? SUBTITLE_EMPHASIS_FONT : SUBTITLE_FONT
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

/** SSR/Hydration: deterministische Schätzung ohne Canvas. */
export function estimatePlanningStaffColumnWidthPx(
  input: PlanningStaffColumnWidthInput
): number {
  return computePlanningStaffColumnWidthPx(input, estimateTextWidthPx);
}

/** Client: präzise Canvas-Messung nach dem Mount. */
export function resolvePlanningStaffColumnWidthPx(
  input: PlanningStaffColumnWidthInput
): number {
  return computePlanningStaffColumnWidthPx(input, measureTextWidthPx);
}
