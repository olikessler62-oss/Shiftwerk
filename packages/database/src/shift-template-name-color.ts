/** Semantische Vorschlagsfarben (Bezeichnungs-Logik). */
export const SHIFT_TEMPLATE_NAME_COLORS = {
  early: "#93C5FD",
  mid: "#FFCC00",
  late: "#F97316",
  night: "#000000",
} as const;

/** 24 Farben — 6 Reihen × 4 Stufen (hell → dunkel, links → rechts). Index 0 = Vorschlag ohne Treffer. */
export const SHIFT_TEMPLATE_PICKER_COLORS: readonly string[] = [
  // Reihe 1: Grün
  "#BBF7D0",
  "#4ADE80",
  "#16A34A",
  "#14532D",
  // Reihe 2: Blau
  "#E0F2FE",
  "#93C5FD",
  "#3B82F6",
  "#1E3A8A",
  // Reihe 3: Gelb
  "#FEF9C3",
  "#FFCC00",
  "#EAB308",
  "#854D0E",
  // Reihe 4: Orange → Rot
  "#FFEDD5",
  "#F97316",
  "#EF4444",
  "#991B1B",
  // Reihe 5: Violett
  "#EDE9FE",
  "#C4B5FD",
  "#8B5CF6",
  "#4C1D95",
  // Reihe 6: Grau → Schwarz
  "#E5E7EB",
  "#9CA3AF",
  "#4B5563",
  "#000000",
];

export const SHIFT_TEMPLATE_DEFAULT_COLOR = SHIFT_TEMPLATE_PICKER_COLORS[0]!;

export function isShiftTemplatePickerColor(color: string): boolean {
  const normalized = color.toUpperCase();
  return SHIFT_TEMPLATE_PICKER_COLORS.some(
    (entry) => entry.toUpperCase() === normalized
  );
}

export function resolveShiftTemplateStoredColor(
  name: string,
  storedColor?: string | null
): string {
  if (
    storedColor &&
    !isShiftTemplateGradientColor(storedColor) &&
    isShiftTemplatePickerColor(storedColor)
  ) {
    return storedColor;
  }
  return resolveShiftTemplateNameColor(name);
}

export function resolveShiftTemplateSaveColor(
  name: string,
  color?: string
): string {
  if (color && isShiftTemplatePickerColor(color)) {
    return color;
  }
  return resolveShiftTemplateNameColor(name);
}

function normalizeTemplateName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Farbvorschlag aus Bezeichnung; sonst erste Combobox-Farbe. */
export function resolveShiftTemplateNameColor(name: string): string {
  const normalized = normalizeTemplateName(name);
  if (!normalized) return SHIFT_TEMPLATE_DEFAULT_COLOR;

  if (normalized.includes("nacht")) {
    return SHIFT_TEMPLATE_NAME_COLORS.night;
  }

  if (
    normalized.includes("nachmittag") ||
    normalized.includes("abend") ||
    normalized.includes("spat")
  ) {
    return SHIFT_TEMPLATE_NAME_COLORS.late;
  }

  if (
    normalized.includes("mittag") ||
    normalized.includes("mittel") ||
    normalized.includes("zwischen") ||
    normalized.includes("normal")
  ) {
    return SHIFT_TEMPLATE_NAME_COLORS.mid;
  }

  if (normalized.includes("fruh") || normalized.includes("morgen")) {
    return SHIFT_TEMPLATE_NAME_COLORS.early;
  }

  return SHIFT_TEMPLATE_DEFAULT_COLOR;
}

export function isShiftTemplateGradientColor(color: string): boolean {
  return color.trimStart().startsWith("linear-gradient(");
}
