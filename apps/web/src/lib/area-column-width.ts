import {
  AREA_CHECKBOX_SIZE_PX,
} from "@/components/ui/checkbox";
import { AREA_CHECKBOX_TEXT_GAP_PX } from "@/components/dashboard/calendar-corner-checkbox";

export const AREA_COLUMN_MIN_WIDTH_PX = 50;
export const AREA_COLUMN_MAX_WIDTH_PX = 200;
/** pl-[2px] + pr-2 */
const AREA_COLUMN_PADDING_X_PX = 10;

/**
 * Deterministische Textbreite (semibold text-sm / 0.875rem Inter) — identisch auf
 * Server und Client, damit kein Hydration-Mismatch entsteht.
 */
export function measureAreaNameText(text: string): number {
  if (!text) return 0;
  let width = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code > 0x024f) {
      width += 8.75;
    } else if (char === char.toUpperCase() && char !== char.toLowerCase()) {
      width += 8.3;
    } else {
      width += 7.65;
    }
  }
  return width;
}

export function resolveAreaColumnWidthPx(
  areaNames: readonly string[],
  measure: (text: string) => number = measureAreaNameText
): number {
  if (areaNames.length === 0) return AREA_COLUMN_MIN_WIDTH_PX;

  const longestNameWidth = Math.max(
    0,
    ...areaNames.map((name) => measure(name.trim()))
  );

  const contentWidth =
    AREA_COLUMN_PADDING_X_PX +
    AREA_CHECKBOX_SIZE_PX +
    AREA_CHECKBOX_TEXT_GAP_PX +
    longestNameWidth;

  return Math.min(
    AREA_COLUMN_MAX_WIDTH_PX,
    Math.max(AREA_COLUMN_MIN_WIDTH_PX, Math.ceil(contentWidth))
  );
}

export function areaColumnGridTrack(widthPx: number): string {
  return `minmax(${widthPx}px, ${widthPx}px)`;
}
