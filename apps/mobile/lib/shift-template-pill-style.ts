import type { EmployeeWeekShiftDisplayItem } from "@schichtwerk/types";
import { colors, shiftColors } from "@schichtwerk/ui-tokens";

const FALLBACK_PALETTE = [
  colors.primary,
  shiftColors.early,
  shiftColors.late,
  shiftColors.night,
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash + value.charCodeAt(i)) % FALLBACK_PALETTE.length;
  }
  return hash;
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveTemplateAccentColor(
  display?: Pick<EmployeeWeekShiftDisplayItem, "templateName" | "templateColor">
): string {
  if (display?.templateColor) return display.templateColor;
  const key = display?.templateName ?? "";
  if (!key) return colors.primary;
  return FALLBACK_PALETTE[hashString(key)] ?? colors.primary;
}

export function templatePillStyle(
  display?: Pick<EmployeeWeekShiftDisplayItem, "templateName" | "templateColor">
) {
  const accent = resolveTemplateAccentColor(display);
  return {
    backgroundColor: withAlpha(accent, 0.14),
    borderColor: withAlpha(accent, 0.35),
    textColor: accent,
  };
}
