const WHITE_RGB = [255, 255, 255] as const;

/** Dezente Tönung des Karteninhalts (Anteil Mitarbeiterfarbe). */
export const SHIFT_CARD_SURFACE_TINT_RATIO = 0.14;
/** Zusätzliche Abdunklung am unteren Kartenrand. */
export const SHIFT_CARD_SURFACE_END_EXTRA_DARKEN = 0.05;
/** Abdunklung am Streifenende (links/oben → rechts/unten). */
export const SHIFT_CARD_STRIP_DARKEN_RATIO = 0.12;

export function isCssGradientColor(color: string): boolean {
  return color.trimStart().startsWith("linear-gradient(");
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(color: string): [number, number, number] | null {
  const trimmed = color.trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (!match) return null;

  const hex = match[1]!;
  if (hex.length === 3) {
    const [r, g, b] = hex.split("");
    return [
      Number.parseInt(`${r}${r}`, 16),
      Number.parseInt(`${g}${g}`, 16),
      Number.parseInt(`${b}${b}`, 16),
    ];
  }

  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function mixRgb(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  amount: number
): [number, number, number] {
  const t = Math.max(0, Math.min(1, amount));
  return [
    clampChannel(from[0] + (to[0] - from[0]) * t),
    clampChannel(from[1] + (to[1] - from[1]) * t),
    clampChannel(from[2] + (to[2] - from[2]) * t),
  ];
}

function darkenRgb(
  rgb: readonly [number, number, number],
  amount: number
): [number, number, number] {
  const factor = 1 - Math.max(0, Math.min(1, amount));
  return [
    clampChannel(rgb[0] * factor),
    clampChannel(rgb[1] * factor),
    clampChannel(rgb[2] * factor),
  ];
}

function rgbToHex(rgb: readonly [number, number, number]): string {
  const [r, g, b] = rgb;
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function resolveBaseRgb(color: string): [number, number, number] {
  return parseHexColor(color) ?? [148, 163, 184];
}

function gradientDirectionCss(
  direction: "to bottom" | "to right"
): "to bottom" | "to right" {
  return direction;
}

/** Farbstreifen: volle Mitarbeiterfarbe → leicht dunkler. */
export function buildShiftCardStripGradientCss(
  employeeColor: string,
  direction: "to bottom" | "to right" = "to bottom"
): string {
  if (isCssGradientColor(employeeColor)) {
    return employeeColor;
  }

  const base = resolveBaseRgb(employeeColor);
  const end = darkenRgb(base, SHIFT_CARD_STRIP_DARKEN_RATIO);
  return `linear-gradient(${gradientDirectionCss(direction)}, ${rgbToHex(base)} 0%, ${rgbToHex(end)} 100%)`;
}

/** Karteninhalt: dezent getönt, oben heller → unten etwas dunkler. */
export function buildShiftCardSurfaceGradientCss(
  employeeColor: string,
  direction: "to bottom" | "to right" = "to bottom"
): string {
  if (isCssGradientColor(employeeColor)) {
    return employeeColor;
  }

  const base = resolveBaseRgb(employeeColor);
  const top = mixRgb(WHITE_RGB, base, SHIFT_CARD_SURFACE_TINT_RATIO);
  const bottom = mixRgb(
    WHITE_RGB,
    darkenRgb(base, SHIFT_CARD_SURFACE_END_EXTRA_DARKEN),
    SHIFT_CARD_SURFACE_TINT_RATIO + 0.05
  );
  return `linear-gradient(${gradientDirectionCss(direction)}, ${rgbToHex(top)} 0%, ${rgbToHex(bottom)} 100%)`;
}
