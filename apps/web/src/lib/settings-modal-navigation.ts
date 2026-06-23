import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";

export const SETTINGS_MODAL_QUERY_FLAGS = [
  "standorte",
  "profiles",
  "rollen",
  "qualifikationen",
  "sonderzuschlaege",
  "abwesenheiten",
] as const;

export type SettingsModalQueryFlag = (typeof SETTINGS_MODAL_QUERY_FLAGS)[number];

const PRESERVED_QUERY_KEYS = ["week", "location", "area"] as const;

export function isSettingsModalOpen(params: URLSearchParams): boolean {
  return SETTINGS_MODAL_QUERY_FLAGS.some((key) => params.get(key) === "1");
}

export function hasSettingsModalSearchParam(
  params: Record<string, string | string[] | undefined>
): boolean {
  return SETTINGS_MODAL_QUERY_FLAGS.some((key) => params[key] === "1");
}

function settingsModalBasePath(pathname: string): string {
  if (SETTINGS_MODALS_ON_CURRENT_PAGE) return pathname;
  return "/dashboard";
}

/** URL zum Öffnen eines Einstellungs-Modals — behält Woche/Standort/Bereich bei. */
export function buildSettingsModalUrl(
  pathname: string,
  searchParams: URLSearchParams,
  flag: SettingsModalQueryFlag
): string {
  const params = new URLSearchParams();
  params.set(flag, "1");
  for (const key of PRESERVED_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return `${settingsModalBasePath(pathname)}?${params.toString()}`;
}

/** Schließt ein Einstellungs-Modal und bleibt auf der aktuellen Seite (replace — kein erneutes Öffnen per Browser-Zurück). */
export function closeSettingsModal(
  router: AppRouterInstance,
  pathname: string,
  searchParams: URLSearchParams,
  flag: SettingsModalQueryFlag
): void {
  const params = new URLSearchParams(searchParams.toString());
  params.delete(flag);
  const basePath = settingsModalBasePath(pathname);
  const query = params.toString();
  router.replace(query ? `${basePath}?${query}` : basePath);
}
