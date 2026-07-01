export type DashboardAreaStaffingViewPrefs = {
  /** Mehrzeilen pro Status (bestätigt/geplant getrennt). Standard: aus. */
  compactStaffingRows: boolean;
  /** Wochenansicht: vergangene Tage in der Liste. Standard: an. */
  includePastDaysInWeek: boolean;
};

export const DEFAULT_DASHBOARD_AREA_STAFFING_VIEW_PREFS: DashboardAreaStaffingViewPrefs =
  {
    compactStaffingRows: false,
    includePastDaysInWeek: true,
  };

const STORAGE_KEY = "schichtwerk.dashboardAreaStaffingViewPrefs";

type StoredPrefsByAreaId = Record<string, Partial<DashboardAreaStaffingViewPrefs>>;

function readAllStoredPrefs(): StoredPrefsByAreaId {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredPrefsByAreaId;
  } catch {
    return {};
  }
}

function writeAllStoredPrefs(prefsByAreaId: StoredPrefsByAreaId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefsByAreaId));
}

function normalizePrefs(
  partial: Partial<DashboardAreaStaffingViewPrefs> | undefined
): DashboardAreaStaffingViewPrefs {
  return {
    compactStaffingRows:
      partial?.compactStaffingRows ??
      DEFAULT_DASHBOARD_AREA_STAFFING_VIEW_PREFS.compactStaffingRows,
    includePastDaysInWeek:
      partial?.includePastDaysInWeek ??
      DEFAULT_DASHBOARD_AREA_STAFFING_VIEW_PREFS.includePastDaysInWeek,
  };
}

export function loadDashboardAreaStaffingViewPrefs(
  areaId: string
): DashboardAreaStaffingViewPrefs {
  const stored = readAllStoredPrefs()[areaId];
  return normalizePrefs(stored);
}

export function saveDashboardAreaStaffingViewPrefs(
  areaId: string,
  prefs: DashboardAreaStaffingViewPrefs
): void {
  const all = readAllStoredPrefs();
  all[areaId] = prefs;
  writeAllStoredPrefs(all);
}
