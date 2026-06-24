"use client";

import { useCallback, useMemo } from "react";
import { Alert } from "@/components/ui";
import { DashboardAreaAmpelCard } from "@/components/dashboard/dashboard-area-ampel-card";
import { DashboardLocationKpiStrip } from "@/components/dashboard/dashboard-location-kpi-strip";
import { SettingsModalsLayer } from "@/components/settings/settings-modals-layer";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
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
import type { PlanningShift } from "@/lib/planning-shift-card";
import { weekdayLabelFromIndex } from "@/lib/location-staffing-client";
import { useLazyShiftCompensation } from "@/lib/use-lazy-shift-compensation";
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

type Props = {
  weekStart: string;
  dates: string[];
  locations: Location[];
  selectedLocationId: string | null;
  areas: LocationArea[];
  calendarShifts: PlanningShift[];
  serviceHours: AreaServiceHourRef[];
  staffingRules: LocationAreaStaffing[];
  staffingOverrides: LocationAreaStaffingOverride[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  profileQualificationIds: Record<string, string[]>;
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
  areas,
  calendarShifts,
  serviceHours,
  staffingRules,
  staffingOverrides,
  areaShiftTemplates,
  qualifications,
  profileQualificationIds,
  staffingEnabled,
  readOnlyWeek = false,
  settingsModals,
}: Props) {
  const { locale } = useLocale();
  const t = useTranslations();
  const intlLocale = toIntlLocale(locale);

  useClearMainNavPendingWhenReady(true);

  const compensationShiftRefs = useMemo(
    () =>
      calendarShifts.map((shift) => ({
        employeeId: shift.employee_id,
        shift_date: shift.shift_date,
        startTime: shift.startTime,
        endTime: shift.endTime,
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
        compensationByKey: shiftCompensation,
        staffingEnabled,
        formatTimeLabel: formatStaffingTimeLabel,
        weekdayLabel: staffingWeekdayLabel,
        formatCalendarTimeLabel: formatCalendarStaffingTimeLabel,
        formatCriticalWindowLabel,
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
    shiftCompensation,
    staffingEnabled,
    formatStaffingTimeLabel,
    staffingWeekdayLabel,
    formatCalendarStaffingTimeLabel,
    formatCriticalWindowLabel,
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

  return (
    <>
      {readOnlyWeek ? (
        <Alert variant="info" className="mx-4 mt-4 md:mx-6">
          {t("dashboard.readOnlyWeek")}
        </Alert>
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-5 px-4 pb-6 md:px-6",
          APP_SHELL_CONTENT_OFFSET_CLASS
        )}
      >
        {locations.length === 0 ? (
          <p className="text-sm text-muted">{t("areaCalendar.noLocations")}</p>
        ) : areas.length === 0 ? (
          <p className="text-sm text-muted">{t("dashboard.noAreas")}</p>
        ) : (
          <>
            <DashboardLocationKpiStrip
              rollup={locationRollup}
              staffingEnabled={staffingEnabled}
            />
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
