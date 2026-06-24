import type { PlanningPagePathname } from "@/lib/planning-week";

/**
 * Einstellungs-Modale auf der aktuellen Seite (Bereich-Kalender, Planung, …) statt immer /bereich-kalender.
 * Auf `false` setzen oder SETTINGS_MODALS_ROLLBACK.md — altes Verhalten (nur Bereich-Kalender-Hintergrund).
 */
export const SETTINGS_MODALS_ON_CURRENT_PAGE = true;

/** Routen, die `SettingsModalsLayer` selbst rendern — App-Shell-Fallback ausblenden. */
export const PAGE_HOSTED_SETTINGS_PATHS = [
  "/bereich-kalender",
  "/dashboard",
  "/mitarbeiter-kalender",
] as const satisfies readonly PlanningPagePathname[];

export function isPageHostedSettingsPath(pathname: string): boolean {
  return PAGE_HOSTED_SETTINGS_PATHS.includes(
    pathname as (typeof PAGE_HOSTED_SETTINGS_PATHS)[number]
  );
}
