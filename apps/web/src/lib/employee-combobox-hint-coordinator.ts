type DismissFn = () => void;

let hintGeneration = 0;
let activeDismiss: DismissFn | null = null;

/**
 * Neuer Hover auf einen Mitarbeiternamen: schließt offene Tooltips und
 * invalidiert ausstehende Öffnen-Timer in allen Combobox-Instanzen.
 */
export function beginEmployeeComboboxHintRequest(): number {
  hintGeneration += 1;
  activeDismiss?.();
  activeDismiss = null;
  return hintGeneration;
}

export function isEmployeeComboboxHintGenerationCurrent(
  generation: number
): boolean {
  return generation === hintGeneration;
}

export function registerActiveEmployeeComboboxHint(dismiss: DismissFn): void {
  activeDismiss = dismiss;
}

export function unregisterEmployeeComboboxHint(dismiss: DismissFn): void {
  if (activeDismiss === dismiss) {
    activeDismiss = null;
  }
}

/** Schließt den aktuell sichtbaren Hinweis (z. B. bei Mouseleave). */
export function dismissActiveEmployeeComboboxHint(): void {
  hintGeneration += 1;
  activeDismiss?.();
  activeDismiss = null;
}
