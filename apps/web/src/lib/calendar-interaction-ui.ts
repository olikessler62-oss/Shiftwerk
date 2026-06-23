/** Kalender-Oberfläche: kein Text-Cursor, nur Pfeil oder Pointer auf klickbaren Elementen. */
export const CALENDAR_INTERACTION_SURFACE_CLASS =
  "cursor-default select-none [&_button:not(:disabled)]:cursor-pointer [&_[role=button]:not([aria-disabled=true])]:cursor-pointer [&_a]:cursor-pointer [&_label[for]]:cursor-pointer";

/** Schichtkarten: keine Textauswahl beim Klick (verhindert Modal-Highlight-Bug). */
export const SHIFT_CARD_INTERACTIVE_CLASS = "select-none";

/** Verhindert Textauswahl, wenn ein Klick ein Modal öffnet (mousedown → Re-Render → mouseup). */
export function preventPointerTextSelection(event: { preventDefault(): void }): void {
  event.preventDefault();
}

export function clearDocumentTextSelection(): void {
  if (typeof window === "undefined") return;
  window.getSelection()?.removeAllRanges();
}

/** Platz für den Leuchtrand — verhindert Abschneiden durch overflow:hidden der Liste. */
export const EMPLOYEE_SHIFT_HIGHLIGHT_GLOW_BLEED_PX = 18;

/** Verzögerung Leuchteffekt (Mitarbeiterliste → Schichtkarten), kürzer als Tooltip. */
export const EMPLOYEE_SHIFT_HIGHLIGHT_HOVER_DELAY_MS = 500;

export const EMPLOYEE_SHIFT_HIGHLIGHT_OVERLAY_OPACITY = 0.4;

export function buildEmployeeShiftHighlightBoxShadow(
  baseShadow: string,
  employeeColor: string
): string {
  const color = employeeColor.trim() || "#94a3b8";
  return `0 0 0 2px ${color}, 0 0 14px 4px color-mix(in srgb, ${color} 72%, transparent), ${baseShadow}`;
}

/** Leuchteffekt innerhalb der Schichtkarten-Grenzen — kein overflow-visible nötig. */
export function buildEmployeeShiftHighlightBoxShadowInCard(
  baseShadow: string,
  employeeColor: string
): string {
  const color = employeeColor.trim() || "#94a3b8";
  return `inset 0 0 0 2px ${color}, inset 0 0 10px 1px color-mix(in srgb, ${color} 55%, transparent), ${baseShadow}`;
}

export function employeeShiftHighlightOverlayStyle(
  employeeColor: string
): { backgroundColor: string; opacity: number } {
  return {
    backgroundColor: employeeColor.trim() || "#94a3b8",
    opacity: EMPLOYEE_SHIFT_HIGHLIGHT_OVERLAY_OPACITY,
  };
}
