/**
 * Shade-Overlays (absolute Panels) sind deaktiviert — sie verursachen bei
 * schmalen/mittleren Viewports Überlappungen, Overflow und fehlende Controls.
 * Stattdessen immer die scrollbare Unified-Zeile (planning-toolbar-unified-mode).
 */
export function usePlanningToolbarShadeOverlaysEnabled(_compactToolbar: boolean): boolean {
  return false;
}
