export type ProfileColorOption = {
  hex: string;
  nameDe: string;
  nameEn: string;
};

/** 40 unterscheidbare Farben für Mitarbeiter-Profile */
export const PROFILE_COLOR_PALETTE: readonly ProfileColorOption[] = [
  { hex: "#EF4444", nameDe: "Rot", nameEn: "Red" },
  { hex: "#F97316", nameDe: "Orange", nameEn: "Orange" },
  { hex: "#F59E0B", nameDe: "Bernstein", nameEn: "Amber" },
  { hex: "#EAB308", nameDe: "Gelb", nameEn: "Yellow" },
  { hex: "#84CC16", nameDe: "Lime", nameEn: "Lime" },
  { hex: "#22C55E", nameDe: "Grün", nameEn: "Green" },
  { hex: "#10B981", nameDe: "Smaragd", nameEn: "Emerald" },
  { hex: "#14B8A6", nameDe: "Türkis", nameEn: "Teal" },
  { hex: "#06B6D4", nameDe: "Cyan", nameEn: "Cyan" },
  { hex: "#0EA5E9", nameDe: "Himmelblau", nameEn: "Sky blue" },
  { hex: "#3B82F6", nameDe: "Blau", nameEn: "Blue" },
  { hex: "#6366F1", nameDe: "Indigo", nameEn: "Indigo" },
  { hex: "#8B5CF6", nameDe: "Violett", nameEn: "Violet" },
  { hex: "#A855F7", nameDe: "Lila", nameEn: "Purple" },
  { hex: "#D946EF", nameDe: "Fuchsia", nameEn: "Fuchsia" },
  { hex: "#EC4899", nameDe: "Pink", nameEn: "Pink" },
  { hex: "#F43F5E", nameDe: "Rose", nameEn: "Rose" },
  { hex: "#BE123C", nameDe: "Karmesin", nameEn: "Crimson" },
  { hex: "#C2410C", nameDe: "Rost", nameEn: "Rust" },
  { hex: "#B45309", nameDe: "Kupfer", nameEn: "Copper" },
  { hex: "#A16207", nameDe: "Gold", nameEn: "Gold" },
  { hex: "#4D7C0F", nameDe: "Oliv", nameEn: "Olive" },
  { hex: "#15803D", nameDe: "Waldgrün", nameEn: "Forest green" },
  { hex: "#047857", nameDe: "Tannengrün", nameEn: "Pine green" },
  { hex: "#0F766E", nameDe: "Petrol", nameEn: "Petrol" },
  { hex: "#0E7490", nameDe: "Stahlblau", nameEn: "Steel blue" },
  { hex: "#1D4ED8", nameDe: "Kobalt", nameEn: "Cobalt" },
  { hex: "#4338CA", nameDe: "Königsblau", nameEn: "Royal blue" },
  { hex: "#6D28D9", nameDe: "Aubergine", nameEn: "Eggplant" },
  { hex: "#7E22CE", nameDe: "Pflaume", nameEn: "Plum" },
  { hex: "#A21CAF", nameDe: "Magenta", nameEn: "Magenta" },
  { hex: "#DB2777", nameDe: "Himbeer", nameEn: "Raspberry" },
  { hex: "#9F1239", nameDe: "Burgunder", nameEn: "Burgundy" },
  { hex: "#78716C", nameDe: "Stein", nameEn: "Stone" },
  { hex: "#57534E", nameDe: "Braun", nameEn: "Brown" },
  { hex: "#64748B", nameDe: "Schiefer", nameEn: "Slate" },
  { hex: "#475569", nameDe: "Graphit", nameEn: "Graphite" },
  { hex: "#334155", nameDe: "Anthrazit", nameEn: "Anthracite" },
  { hex: "#0D9488", nameDe: "Jade", nameEn: "Jade" },
  { hex: "#CA8A04", nameDe: "Senf", nameEn: "Mustard" },
] as const;

const PALETTE_SIZE = PROFILE_COLOR_PALETTE.length;
const MIX_GROUP_COUNT = 8;
const MIX_GROUP_SIZE = Math.ceil(PALETTE_SIZE / MIX_GROUP_COUNT);

/** Indizes für gemischte Anzeige: pro Runde je eine Farbe aus jedem Farbbereich. */
const PROFILE_COLOR_PALETTE_MIXED_INDICES: readonly number[] = (() => {
  const order: number[] = [];
  for (let round = 0; round < MIX_GROUP_SIZE; round++) {
    for (let group = 0; group < MIX_GROUP_COUNT; group++) {
      const index = group * MIX_GROUP_SIZE + round;
      if (index < PALETTE_SIZE) order.push(index);
    }
  }
  return order;
})();

/** Verfügbare Profilfarben in gemischter Reihenfolge (unterschiedliche Farbtöne nacheinander). */
export function orderProfileColorsForDisplay(
  options: readonly ProfileColorOption[]
): ProfileColorOption[] {
  const byHex = new Map(
    options.map((option) => [option.hex.toUpperCase(), option] as const)
  );
  const ordered: ProfileColorOption[] = [];
  for (const index of PROFILE_COLOR_PALETTE_MIXED_INDICES) {
    const hex = PROFILE_COLOR_PALETTE[index]?.hex.toUpperCase();
    if (!hex) continue;
    const option = byHex.get(hex);
    if (option) ordered.push(option);
  }
  return ordered;
}

const PALETTE_HEX = new Set(PROFILE_COLOR_PALETTE.map((c) => c.hex.toUpperCase()));

export function getProfileColorLabel(
  hex: string,
  locale: "de" | "en"
): string {
  const option = PROFILE_COLOR_PALETTE.find(
    (c) => c.hex.toUpperCase() === hex.toUpperCase()
  );
  if (!option) return hex;
  return locale === "en" ? option.nameEn : option.nameDe;
}

export function isProfilePaletteColor(hex: string): boolean {
  return PALETTE_HEX.has(hex.toUpperCase());
}

export function validateProfileColorAssignment(
  color: string,
  usedColors: string[]
): { ok: true } | { ok: false; error: string } {
  const normalized = color.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, error: "Bitte eine Farbe auswählen." };
  }
  if (!isProfilePaletteColor(normalized)) {
    return { ok: false, error: "Ungültige Farbauswahl." };
  }
  const used = new Set(usedColors.map((c) => c.toUpperCase()));
  if (used.has(normalized)) {
    return { ok: false, error: "Diese Farbe ist bereits einem anderen Mitarbeiter zugewiesen." };
  }
  return { ok: true };
}
