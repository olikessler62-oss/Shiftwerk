import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";

export const OVERVIEW_MODAL_QUERY_FLAGS = [
  "uebersichtAbwesenheiten",
  "uebersichtVerfuegbarkeiten",
  "uebersichtWuensche",
  "uebersichtEntgelt",
  "uebersichtZuschlaege",
  "uebersichtTaetigkeiten",
] as const;

export const OVERVIEW_AVAILABILITIES_EMPLOYEE_QUERY_KEY =
  "uebersichtVerfuegbarkeitenEmployee";

export const OVERVIEW_ABSENCES_EMPLOYEE_QUERY_KEY = "uebersichtAbwesenheitenEmployee";

export const OVERVIEW_PREFERENCES_EMPLOYEE_QUERY_KEY = "uebersichtWuenscheEmployee";

export const OVERVIEW_COMPENSATION_EMPLOYEE_QUERY_KEY = "uebersichtEntgeltEmployee";

export const OVERVIEW_SURCHARGES_EMPLOYEE_QUERY_KEY = "uebersichtZuschlaegeEmployee";

export const OVERVIEW_QUALIFICATIONS_EMPLOYEE_QUERY_KEY =
  "uebersichtTaetigkeitenEmployee";

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

export function buildOverviewAbsencesModalUrl(
  pathname: string,
  searchParams: URLSearchParams,
  employeeId?: string
): string {
  const params = new URLSearchParams();
  params.set("uebersichtAbwesenheiten", "1");
  if (employeeId) {
    params.set(OVERVIEW_ABSENCES_EMPLOYEE_QUERY_KEY, employeeId);
  }
  for (const key of PRESERVED_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return `${overviewModalBasePath(pathname)}?${params.toString()}`;
}

export function buildOverviewShiftPreferencesModalUrl(
  pathname: string,
  searchParams: URLSearchParams,
  employeeId?: string
): string {
  const params = new URLSearchParams();
  params.set("uebersichtWuensche", "1");
  if (employeeId) {
    params.set(OVERVIEW_PREFERENCES_EMPLOYEE_QUERY_KEY, employeeId);
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

export function readOverviewAbsencesEmployeeId(
  searchParams: URLSearchParams
): string | null {
  return searchParams.get(OVERVIEW_ABSENCES_EMPLOYEE_QUERY_KEY);
}

export function readOverviewShiftPreferencesEmployeeId(
  searchParams: URLSearchParams
): string | null {
  return searchParams.get(OVERVIEW_PREFERENCES_EMPLOYEE_QUERY_KEY);
}

export function buildOverviewCompensationModalUrl(
  pathname: string,
  searchParams: URLSearchParams,
  employeeId?: string
): string {
  const params = new URLSearchParams();
  params.set("uebersichtEntgelt", "1");
  if (employeeId) {
    params.set(OVERVIEW_COMPENSATION_EMPLOYEE_QUERY_KEY, employeeId);
  }
  for (const key of PRESERVED_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return `${overviewModalBasePath(pathname)}?${params.toString()}`;
}

export function buildOverviewSurchargesModalUrl(
  pathname: string,
  searchParams: URLSearchParams,
  employeeId?: string
): string {
  const params = new URLSearchParams();
  params.set("uebersichtZuschlaege", "1");
  if (employeeId) {
    params.set(OVERVIEW_SURCHARGES_EMPLOYEE_QUERY_KEY, employeeId);
  }
  for (const key of PRESERVED_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return `${overviewModalBasePath(pathname)}?${params.toString()}`;
}

export function buildOverviewQualificationsModalUrl(
  pathname: string,
  searchParams: URLSearchParams,
  employeeId?: string
): string {
  const params = new URLSearchParams();
  params.set("uebersichtTaetigkeiten", "1");
  if (employeeId) {
    params.set(OVERVIEW_QUALIFICATIONS_EMPLOYEE_QUERY_KEY, employeeId);
  }
  for (const key of PRESERVED_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return `${overviewModalBasePath(pathname)}?${params.toString()}`;
}

export function readOverviewCompensationEmployeeId(
  searchParams: URLSearchParams
): string | null {
  return searchParams.get(OVERVIEW_COMPENSATION_EMPLOYEE_QUERY_KEY);
}

export function readOverviewSurchargesEmployeeId(
  searchParams: URLSearchParams
): string | null {
  return searchParams.get(OVERVIEW_SURCHARGES_EMPLOYEE_QUERY_KEY);
}

export function readOverviewQualificationsEmployeeId(
  searchParams: URLSearchParams
): string | null {
  return searchParams.get(OVERVIEW_QUALIFICATIONS_EMPLOYEE_QUERY_KEY);
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
  if (flag === "uebersichtAbwesenheiten") {
    params.delete(OVERVIEW_ABSENCES_EMPLOYEE_QUERY_KEY);
  }
  if (flag === "uebersichtWuensche") {
    params.delete(OVERVIEW_PREFERENCES_EMPLOYEE_QUERY_KEY);
  }
  if (flag === "uebersichtEntgelt") {
    params.delete(OVERVIEW_COMPENSATION_EMPLOYEE_QUERY_KEY);
  }
  if (flag === "uebersichtZuschlaege") {
    params.delete(OVERVIEW_SURCHARGES_EMPLOYEE_QUERY_KEY);
  }
  if (flag === "uebersichtTaetigkeiten") {
    params.delete(OVERVIEW_QUALIFICATIONS_EMPLOYEE_QUERY_KEY);
  }
  const basePath = overviewModalBasePath(pathname);
  const query = params.toString();
  router.push(query ? `${basePath}?${query}` : basePath);
}
