import type { CSSProperties } from "react";

/** Experiment: Wochentags-Farben für Dashboard-Tag-Karten (Mo=0 … So=6). */

const PAST_GRAY = "#e8ebf0";

type DayCardWeekdayPalette = {
  headerBg: string;
  headerBorder: string;
  headerText: string;
  headerTextLight: boolean;
  headerMutedText: string;
  bodyBg: string;
};

const WEEKDAY_PALETTES: readonly DayCardWeekdayPalette[] = [
  {
    headerBg: "#1e3a5f",
    headerBorder: "#152a45",
    headerText: "#ffffff",
    headerTextLight: true,
    headerMutedText: "color-mix(in srgb, #ffffff 78%, #1e3a5f)",
    bodyBg: "#e8edf5",
  },
  {
    headerBg: "#2563eb",
    headerBorder: "#1d4ed8",
    headerText: "#ffffff",
    headerTextLight: true,
    headerMutedText: "color-mix(in srgb, #ffffff 78%, #2563eb)",
    bodyBg: "#e8f0fe",
  },
  {
    headerBg: "#0d9488",
    headerBorder: "#0f766e",
    headerText: "#ffffff",
    headerTextLight: true,
    headerMutedText: "color-mix(in srgb, #ffffff 78%, #0d9488)",
    bodyBg: "#e6f7f5",
  },
  {
    headerBg: "#16a34a",
    headerBorder: "#15803d",
    headerText: "#ffffff",
    headerTextLight: true,
    headerMutedText: "color-mix(in srgb, #ffffff 78%, #16a34a)",
    bodyBg: "#e8f5ec",
  },
  {
    headerBg: "#ca8a04",
    headerBorder: "#a16207",
    headerText: "#422006",
    headerTextLight: false,
    headerMutedText: "color-mix(in srgb, #422006 62%, #ca8a04)",
    bodyBg: "#fef9e8",
  },
  {
    headerBg: "#ea580c",
    headerBorder: "#c2410c",
    headerText: "#ffffff",
    headerTextLight: true,
    headerMutedText: "color-mix(in srgb, #ffffff 78%, #ea580c)",
    bodyBg: "#fef0e8",
  },
  {
    headerBg: "#dc2626",
    headerBorder: "#b91c1c",
    headerText: "#ffffff",
    headerTextLight: true,
    headerMutedText: "color-mix(in srgb, #ffffff 78%, #dc2626)",
    bodyBg: "#fdeaea",
  },
] as const;

function mixColor(base: string, mix: string, mixPercent: number): string {
  return `color-mix(in srgb, ${base} ${100 - mixPercent}%, ${mix})`;
}

function bodyHoverBg(palette: DayCardWeekdayPalette): string {
  return mixColor(palette.bodyBg, palette.headerBg, 18);
}

function headerTextColor(palette: DayCardWeekdayPalette, isPast: boolean): string {
  if (!isPast) return palette.headerText;
  if (palette.headerTextLight) {
    return mixColor(palette.headerText, "#64748b", 28);
  }
  return mixColor(palette.headerText, "#94a3b8", 32);
}

function headerMutedTextColor(palette: DayCardWeekdayPalette, isPast: boolean): string {
  if (!isPast) return palette.headerMutedText;
  return mixColor(palette.headerMutedText, "#94a3b8", 35);
}

export function normalizeWeekdayIndex(index: number): number {
  return ((index % 7) + 7) % 7;
}

export function getDayCardWeekdayPalette(weekdayIndex: number): DayCardWeekdayPalette {
  return WEEKDAY_PALETTES[normalizeWeekdayIndex(weekdayIndex)]!;
}

export type DayCardWeekdaySurfaces = {
  cardBorderStyle: CSSProperties;
  headerStyle: CSSProperties;
  bodyCssVars: CSSProperties;
  headerTextStyle: CSSProperties;
  headerMutedTextStyle: CSSProperties;
};

export function resolveDayCardWeekdaySurfaces(
  weekdayIndex: number,
  options: { isPast: boolean }
): DayCardWeekdaySurfaces {
  const palette = getDayCardWeekdayPalette(weekdayIndex);
  const headerBg = options.isPast
    ? mixColor(palette.headerBg, PAST_GRAY, 48)
    : palette.headerBg;
  const headerBorder = options.isPast
    ? mixColor(palette.headerBorder, PAST_GRAY, 40)
    : palette.headerBorder;
  const bodyBg = options.isPast ? mixColor(palette.bodyBg, PAST_GRAY, 42) : palette.bodyBg;
  const bodyHoverBgValue = options.isPast
    ? mixColor(bodyHoverBg(palette), PAST_GRAY, 35)
    : bodyHoverBg(palette);

  return {
    cardBorderStyle: { borderColor: headerBorder },
    headerStyle: {
      backgroundColor: headerBg,
      borderColor: headerBorder,
    },
    bodyCssVars: {
      "--day-card-body": bodyBg,
      "--day-card-body-hover": bodyHoverBgValue,
    } as CSSProperties,
    headerTextStyle: { color: headerTextColor(palette, options.isPast) },
    headerMutedTextStyle: { color: headerMutedTextColor(palette, options.isPast) },
  };
}

export const DAY_CARD_WEEKDAY_BODY_SURFACE_CLASS =
  "bg-[var(--day-card-body)] transition-colors group-hover:bg-[var(--day-card-body-hover)]";
