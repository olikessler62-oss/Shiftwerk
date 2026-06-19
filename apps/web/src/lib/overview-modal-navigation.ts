import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";

export const OVERVIEW_MODAL_QUERY_FLAGS = [
  "uebersichtAbwesenheiten",
  "uebersichtVerfuegbarkeiten",
] as const;

export const OVERVIEW_AVAILABILITIES_EMPLOYEE_QUERY_KEY =
  "uebersichtVerfuegbarkeitenEmployee";

export type OverviewModalQueryFlag = (typeof OVERVIEW_MODAL_QUERY_FLAGS)[number];

const PRESERVED_QUERY_KEYS = ["week", "location", "area"] as const;

export function isOverviewModalOpen(params: URLSearchParams): boolean {
  return OVERVIEW_MODAL_QUERY_FLAGS.some((key) => params.get(key) === "1");
}

function overviewModalBasePath(pathname: string): string {
  if (SETTINGS_MODALS_ON_CURRENT_PAGE) return pathname;
  return "/dashboard";
}

export function buildOverviewModalUrl(
  pathname: string,
  searchParams: URLSearchParams,
  flag: OverviewModalQueryFlag
): string {
  const params = new URLSearchParams();
  params.set(flag, "1");
  for (const key of PRESERVED_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return `${overviewModalBasePath(pathname)}?${params.toString()}`;
}

export function buildOverviewAvailabilitiesModalUrl(
  pathname: string,
  searchParams: URLSearchParams,
  employeeId?: string
): string {
  const params = new URLSearchParams();
  params.set("uebersichtVerfuegbarkeiten", "1");
  if (employeeId) {
    params.set(OVERVIEW_AVAILABILITIES_EMPLOYEE_QUERY_KEY, employeeId);
  }
  for (const key of PRESERVED_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return `${overviewModalBasePath(pathname)}?${params.toString()}`;
}

export function readOverviewAvailabilitiesEmployeeId(
  searchParams: URLSearchParams
): string | null {
  return searchParams.get(OVERVIEW_AVAILABILITIES_EMPLOYEE_QUERY_KEY);
}

export function closeOverviewModal(
  router: AppRouterInstance,
  pathname: string,
  searchParams: URLSearchParams,
  flag: OverviewModalQueryFlag
): void {
  const params = new URLSearchParams(searchParams.toString());
  params.delete(flag);
  if (flag === "uebersichtVerfuegbarkeiten") {
    params.delete(OVERVIEW_AVAILABILITIES_EMPLOYEE_QUERY_KEY);
  }
  const basePath = overviewModalBasePath(pathname);
  const query = params.toString();
  router.push(query ? `${basePath}?${query}` : basePath);
}
