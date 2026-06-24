import { useLayoutEffect, useState, type RefObject } from "react";

export const CONTEXT_MENU_VIEWPORT_PADDING_PX = 8;

/** Sichtbare Breite: 60 % Basis, zweimal +35 %, einmal −10 % → 0,6 × 1,35² × 0,9. */
export const PLANNING_CELL_CONTEXT_MENU_WIDTH_SCALE = 0.6 * 1.35 * 1.35 * 0.9;

const DASHBOARD_CELL_CONTEXT_MENU_WIDTH_REM = 15 * PLANNING_CELL_CONTEXT_MENU_WIDTH_SCALE;
const AREA_DAY_CONTEXT_MENU_WIDTH_REM = 11 * PLANNING_CELL_CONTEXT_MENU_WIDTH_SCALE;
const AREA_SHIFT_CONTEXT_MENU_WIDTH_REM =
  (220 / 16) * PLANNING_CELL_CONTEXT_MENU_WIDTH_SCALE;

export const DASHBOARD_CELL_CONTEXT_MENU_WIDTH_PX = Math.round(
  DASHBOARD_CELL_CONTEXT_MENU_WIDTH_REM * 16
);
export const AREA_DAY_CONTEXT_MENU_WIDTH_PX = Math.round(
  AREA_DAY_CONTEXT_MENU_WIDTH_REM * 16
);
/** Tag-Bereich-Zellen im Bereich-Kalender — 50 % breiter als {@link AREA_DAY_CONTEXT_MENU_WIDTH_PX}. */
export const AREA_CALENDAR_DAY_CONTEXT_MENU_WIDTH_PX = Math.round(
  AREA_DAY_CONTEXT_MENU_WIDTH_PX * 1.5
);
export const AREA_SHIFT_CONTEXT_MENU_WIDTH_PX = Math.round(
  AREA_SHIFT_CONTEXT_MENU_WIDTH_REM * 16
);

export const PLANNING_CONTEXT_MENU_SURFACE_CLASS =
  "fixed z-[210] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg";

export type ContextMenuPoint = {
  x: number;
  y: number;
};

/** Hält Kontextmenüs vollständig im sichtbaren Browserbereich (oben links am Anker). */
export function clampContextMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
  padding = CONTEXT_MENU_VIEWPORT_PADDING_PX
): ContextMenuPoint {
  if (typeof window === "undefined") {
    return { x: clientX, y: clientY };
  }

  return {
    x: Math.max(
      padding,
      Math.min(clientX, window.innerWidth - menuWidth - padding)
    ),
    y: Math.max(
      padding,
      Math.min(clientY, window.innerHeight - menuHeight - padding)
    ),
  };
}

export function useClampedContextMenuPosition(
  open: boolean,
  anchorX: number,
  anchorY: number,
  menuRef: RefObject<HTMLElement | null>,
  remeasureDeps: readonly unknown[] = []
): ContextMenuPoint {
  const [position, setPosition] = useState<ContextMenuPoint>({
    x: anchorX,
    y: anchorY,
  });

  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const menu = menuRef.current;
      if (!menu || typeof window === "undefined") {
        setPosition({ x: anchorX, y: anchorY });
        return;
      }

      const { width, height } = menu.getBoundingClientRect();
      setPosition(clampContextMenuPosition(anchorX, anchorY, width, height));
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open, anchorX, anchorY, menuRef, ...remeasureDeps]);

  return position;
}
