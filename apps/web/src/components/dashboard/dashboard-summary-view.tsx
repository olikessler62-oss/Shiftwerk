"use client";

import { useCallback, useMemo } from "react";
import { DashboardAreaAmpelCard } from "@/components/dashboard/dashboard-area-ampel-card";
import { DashboardLocationKpiStrip } from "@/components/dashboard/dashboard-location-kpi-strip";
import { DashboardSummaryHeader } from "@/components/dashboard/dashboard-summary-header";
import { SettingsModalsLayer } from "@/components/settings/settings-modals-layer";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrgFeatures, useShiftConfirmationPendingAfterMinutes, useAllowPastShiftChanges, useOrganization } from "@/lib/org-features-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { formatDayHeader } from "@/lib/planning-utils";
import {
  APP_SHELL_CONTENT_OFFSET_CLASS,
} from "@/lib/app-shell-layout";
import { useClearMainNavPendingWhenReady } from "@/lib/app-shell-main-nav-pending";
import {
  computeDashboardAreaWeekStats,
  computeDashboardLocationWeekRollup,
  sortDashboardAreaWeekStats,
} from "@/lib/dashboard-area-week-stats";
import { buildPlanningPageUrl } from "@/lib/planning-week";
import { shouldShowLocationInPlanningUi } from "@/lib/planning-location-ui";
import type { PlanningShift } from "@/lib/planning-shift-card";
import { weekdayLabelFromIndex } from "@/lib/location-staffing-client";
import { useLazyShiftCompensation } from "@/lib/use-lazy-shift-compensation";
import { resolveOrganizationTimeZone } from "@schichtwerk/database";
import type {
  AreaShiftTemplateWithBreaks,
  CompensationSurchargeType,
  Location,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  Profile,
  Qualification,
  Role,
} from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { DashboardStaffingCandidatesPlanningContext } from "@/components/dashboard/dashboard-staffing-row-candidates-modal";
import type { DashboardStaffingWindowIssuesContext } from "@/lib/dashboard-staffing-window-issues";
import { useEffectiveShiftConfirmationEnabled } from "@/lib/shift-confirmation-simulation-context";
import { formatDashboardAreaCardWeekRange } from "@/lib/dashboard-area-card-scope-label";
import { toISODate } from "@/lib/dates";

type Props = {
  weekStart: string;
  dates: string[];
  locations: Location[];
  selectedLocationId: string | null;
  selectedLocationName?: string;
  areas: LocationArea[];
  calendarShifts: PlanningShift[];
  weeklyHoursShifts?: readonly PlanningShift[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: LocationAreaStaffing[];
  staffingOverrides: LocationAreaStaffingOverride[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  profileQualificationIds: Record<string, string[]>;
  employeeNameById?: ReadonlyMap<string, string>;
  employeeColorById?: ReadonlyMap<string, string | null | undefined>;
  staffingEnabled: boolean;
  readOnlyWeek?: boolean;
  settingsModals?: {
    profiles: Profile[];
    roles: Role[];
    compensationSurchargeTypes: CompensationSurchargeType[];
  };
};

export function DashboardSummaryView({
  weekStart,
  dates,
  locations,
  selectedLocationId,
  selectedLocationName = "",
  areas,
  calendarShifts,
  weeklyHoursShifts,
  serviceHours,
  staffingRules,
  staffingOverrides,
  areaShiftTemplates,
  qualifications,
  profileQualificationIds,
  employeeNameById,
  employeeColorById,
  staffingEnabled,
  readOnlyWeek = false,
  settingsModals,
}: Props) {
  const { locale } = useLocale();
  const t = useTranslations();
  const intlLocale = toIntlLocale(locale);
  const features = useOrgFeatures();
  const simplePlanning = !features.areas;
  const shiftConfirmationEnabled = useEffectiveShiftConfirmationEnabled();
  const pendingAfterMinutes = useShiftConfirmationPendingAfterMinutes();
  const allowPastShiftChanges = useAllowPastShiftChanges();
  const organization = useOrganization();
  const organizationTimeZone = useMemo(
    () => resolveOrganizationTimeZone(organization),
    [organization]
  );
  const todayISO = toISODate(new Date());

  useClearMainNavPendingWhenReady(true);
  const showLocationInUi = shouldShowLocationInPlanningUi(locations.length);

  const compensationShiftRefs = useMemo(
    () =>
      calendarShifts.map((shift) => ({
        employeeId: shift.employee_id,
        shift_date: shift.shift_date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        area_shift_template_id: shift.area_shift_template_id,
        location_area_id: shift.location_area_id,
      })),
    [calendarShifts]
  );
  const shiftCompensation = useLazyShiftCompensation(compensationShiftRefs);

  const profileQualificationIdsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [profileId, ids] of Object.entries(profileQualificationIds)) {
      map.set(profileId, new Set(ids));
    }
    return map;
  }, [profileQualificationIds]);

  const formatStaffingTimeLabel = useCallback(
    (weekdayLabel: string, startTime: string, endTime: string) =>
      t("areaCalendar.bulkShiftStaffingPeriodLabel", {
        weekday: weekdayLabel,
        start: startTime,
        end: endTime,
      }),
    [t]
  );

  const formatCalendarStaffingTimeLabel = useCallback(
    (startTime: string, endTime: string) =>
      t("areaCalendar.bulkShiftStaffingCalendarTooltipTimeLabel", {
        start: startTime,
        end: endTime,
      }),
    [t]
  );

  const staffingWeekdayLabel = useCallback(
    (weekdayIndex: number) => weekdayLabelFromIndex(weekdayIndex, t),
    [t]
  );

  const formatCriticalWindowLabel = useCallback(
    (dateISO: string, entry: { calendarTimeLabel?: string; label: string }) => {
      const dayHeader = formatDayHeader(dateISO, intlLocale, "short");
      const time = entry.calendarTimeLabel ?? entry.label;
      return `${dayHeader.weekday} ${time}`;
    },
    [intlLocale]
  );

  const formatWeekdayLabel = useCallback(
    (dateISO: string) => formatDayHeader(dateISO, intlLocale, "short").weekday,
    [intlLocale]
  );

  const areaStats = useMemo(() => {
    const stats = areas.map((area) =>
      computeDashboardAreaWeekStats({
        area,
        dates,
        shifts: calendarShifts,
        staffingRules,
        staffingOverrides,
        serviceHours,
        areaShiftTemplates,
        qualifications,
        profileQualificationIds: profileQualificationIdsMap,
        employeeNameById,
        compensationByKey: shiftCompensation,
        staffingEnabled,
        formatTimeLabel: formatStaffingTimeLabel,
        weekdayLabel: staffingWeekdayLabel,
        formatCalendarTimeLabel: formatCalendarStaffingTimeLabel,
        formatCriticalWindowLabel,
        formatWeekdayLabel,
      })
    );
    return sortDashboardAreaWeekStats(stats);
  }, [
    areas,
    dates,
    calendarShifts,
    staffingRules,
    staffingOverrides,
    serviceHours,
    areaShiftTemplates,
    qualifications,
    profileQualificationIdsMap,
    employeeNameById,
    shiftCompensation,
    staffingEnabled,
    formatStaffingTimeLabel,
    staffingWeekdayLabel,
    formatCalendarStaffingTimeLabel,
    formatCriticalWindowLabel,
    formatWeekdayLabel,
  ]);

  const locationRollup = useMemo(
    () => computeDashboardLocationWeekRollup(areaStats),
    [areaStats]
  );

  const buildAreaHref = useCallback(
    (pathname: "/bereich-kalender" | "/mitarbeiter-kalender", areaId: string) => {
      const params = new URLSearchParams();
      params.set("week", weekStart);
      if (selectedLocationId) params.set("location", selectedLocationId);
      params.set("area", areaId);
      return buildPlanningPageUrl(pathname, params);
    },
    [weekStart, selectedLocationId]
  );

  const candidatesPlanningBase = useMemo(():
    | Omit<
        DashboardStaffingCandidatesPlanningContext,
        "areaId" | "areaName" | "areaCalendarHref"
      >
    | null => {
    if (!selectedLocationId || !staffingEnabled) return null;

    return {
      weekStart,
      dates,
      weeklyHoursShifts,
      locationId: selectedLocationId,
      simplePlanning,
      calendarShifts,
      staffingRules,
      staffingOverrides,
      serviceHours,
      areaShiftTemplates,
      qualifications,
      profileQualificationIds: profileQualificationIdsMap,
      employeeNameById,
      employeeColorById,
      readOnlyWeek,
      formatTimeLabel: formatStaffingTimeLabel,
      weekdayLabel: staffingWeekdayLabel,
      formatCalendarTimeLabel: formatCalendarStaffingTimeLabel,
    };
  }, [
    selectedLocationId,
    staffingEnabled,
    weekStart,
    dates,
    weeklyHoursShifts,
    simplePlanning,
    calendarShifts,
    staffingRules,
    staffingOverrides,
    serviceHours,
    areaShiftTemplates,
    qualifications,
    profileQualificationIdsMap,
    employeeNameById,
    employeeColorById,
    readOnlyWeek,
    formatStaffingTimeLabel,
    staffingWeekdayLabel,
    formatCalendarStaffingTimeLabel,
  ]);

  const windowIssuesContextBase = useMemo(():
    | Omit<
        DashboardStaffingWindowIssuesContext,
        "areaId" | "areaName" | "areaCalendarHref"
      >
    | null => {
    if (!selectedLocationId || !shiftConfirmationEnabled || !employeeNameById) {
      return null;
    }

    return {
      weekStart,
      locationId: selectedLocationId,
      calendarShifts,
      serviceHours,
      employeeNameById,
      employeeColorById,
      shiftConfirmationEnabled,
      pendingAfterMinutes,
      readOnlyWeek,
      todayISO,
      timeZone: organizationTimeZone,
      allowPastShiftChanges,
    };
  }, [
    selectedLocationId,
    shiftConfirmationEnabled,
    pendingAfterMinutes,
    weekStart,
    calendarShifts,
    serviceHours,
    employeeNameById,
    employeeColorById,
    readOnlyWeek,
    todayISO,
    organizationTimeZone,
    allowPastShiftChanges,
  ]);

  return (
    <>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6 md:px-6",
          APP_SHELL_CONTENT_OFFSET_CLASS
        )}
      >
        {locations.length === 0 ? (
          <p className="text-sm text-muted">{t("areaCalendar.noLocations")}</p>
        ) : areas.length === 0 ? (
          <p className="text-sm text-muted">{t("dashboard.noAreas")}</p>
        ) : (
            <>
              <div
                className={cn(
                  "grid gap-4",
                  selectedLocationName
                    ? "grid-cols-1 sm:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]"
                    : "grid-cols-1"
                )}
              >
                {selectedLocationName ? (
                  <DashboardSummaryHeader
                    locationName={selectedLocationName}
                    weekStart={weekStart}
                    compact
                    showLocation={showLocationInUi}
                  />
                ) : null}
                <DashboardLocationKpiStrip
                  rollup={locationRollup}
                  staffingEnabled={staffingEnabled}
                  className="min-w-0"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {areaStats.map((stats) => (
                  <DashboardAreaAmpelCard
                    key={stats.areaId}
                    stats={stats}
                    staffingEnabled={staffingEnabled}
                    areaCalendarHref={buildAreaHref("/bereich-kalender", stats.areaId)}
                    employeeCalendarHref={buildAreaHref(
                      "/mitarbeiter-kalender",
                      stats.areaId
                    )}
                    candidatesPlanning={candidatesPlanningBase}
                    shiftConfirmationEnabled={shiftConfirmationEnabled}
                    todayISO={todayISO}
                    staffingScopeDateLabel={formatDashboardAreaCardWeekRange(
                      weekStart,
                      intlLocale
                    )}
                    windowIssuesContext={windowIssuesContextBase}
                  />
                ))}
              </div>
            </>
        )}
      </div>

      {SETTINGS_MODALS_ON_CURRENT_PAGE && settingsModals ? (
        <SettingsModalsLayer
          data={{
            locations,
            selectedLocationId,
            areas,
            serviceHours,
            fullStaffingRules: staffingRules,
            areaShiftTemplates,
            qualifications,
            compensationSurchargeTypes: settingsModals.compensationSurchargeTypes,
            roles: settingsModals.roles,
            profiles: settingsModals.profiles,
          }}
        />
      ) : null}
    </>
  );
}
