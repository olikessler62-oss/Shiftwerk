import { redirect } from "next/navigation";
import { weekDates } from "@/lib/dates";
import { getOrgFeatures } from "@/lib/org-features";
import { getManagerSession } from "@/lib/server-manager-session";
import { isPastWeek } from "@/lib/planning-readonly";
import { resolveOrganizationTimeZone } from "@schichtwerk/database";
import {
  redirectIfPlanningWeekClamped,
  type PlanningPagePathname,
} from "@/lib/planning-week";
import { hasSettingsModalSearchParam } from "@/lib/settings-modal-navigation";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";

export type DashboardSearchParams = {
  week?: string;
  location?: string;
  area?: string;
  standorte?: string;
  profiles?: string;
  rollen?: string;
  qualifikationen?: string;
  sonderzuschlaege?: string;
  abwesenheiten?: string;
  superadmin?: string;
};

export async function resolvePlanningPageFrame(
  pathname: PlanningPagePathname,
  params: DashboardSearchParams
) {
  const session = await getManagerSession();
  if (!session) redirect("/login");

  const {
    week,
    location: locationParam,
    area: areaParam,
  } = params;

  const { user, organization, organizationId: orgId } = session;
  const orgFeatures = getOrgFeatures(organization);
  const timeZone = resolveOrganizationTimeZone(organization);

  const weekStart = redirectIfPlanningWeekClamped(pathname, week, {
    week,
    location: locationParam,
    area: areaParam,
    ...params,
  });
  const dates = weekDates(weekStart);
  const from = dates[0];
  const to = dates[6];
  const readOnlyWeek = isPastWeek(to);

  const loadSettingsModalsData =
    SETTINGS_MODALS_ON_CURRENT_PAGE && hasSettingsModalSearchParam(params);

  return {
    session,
    user,
    organization,
    orgId,
    orgFeatures,
    timeZone,
    weekStart,
    dates,
    from,
    to,
    readOnlyWeek,
    locationParam,
    areaParam,
    loadSettingsModalsData,
  };
}

export async function resolveDashboardPageFrame(params: DashboardSearchParams) {
  return resolvePlanningPageFrame("/dashboard", params);
}

export async function resolveEmployeeCalendarPageFrame(
  params: DashboardSearchParams
) {
  return resolvePlanningPageFrame("/mitarbeiter-kalender", params);
}
