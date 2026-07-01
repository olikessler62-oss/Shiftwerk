import { cookies } from "next/headers";
import { getDatabase } from "@/lib/db";
import { getOrgFeatures } from "@/lib/org-features";
import { getManagerSession } from "@/lib/server-manager-session";
import { parseISODate, isPastCalendarDate } from "@/lib/dates";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import {
  PLANNING_SELECTED_LOCATION_COOKIE,
  readPlanningLocationCookie,
} from "@/lib/planning-location-preference";
import {
  emptyDashboardSummaryPageBundle,
  loadDashboardSummaryPageBundle,
  type DashboardSummaryPageBundle,
} from "@/lib/dashboard-summary-data";
import {
  computeDashboardAreaWeekStats,
  computeDashboardLocationWeekRollup,
  resolveDashboardAreaAmpelLevelFromWindowRows,
  resolveDashboardDayAreaStaffingGaugeFromWindowRows,
  sortDashboardAreaWeekStats,
  type DashboardAreaAmpelLevel,
  type DashboardDayAreaStaffingGauge,
  type DashboardLocationWeekRollup,
  type DashboardStaffingIssue,
} from "@/lib/dashboard-area-week-stats";
import { resolveDashboardPageFrame } from "@/lib/dashboard-page-frame";
import { hasEffectiveServiceHoursOnDate, areaHasEffectiveServiceHoursOnDate } from "@/lib/location-staffing-client";
import { organizationTodayISO } from "@schichtwerk/database";
import type { PlanningShift } from "@/lib/planning-shift-card";
import { shouldDisplayShiftOnPlanningCalendar } from "@/lib/shift-cancellation-policy";
import {
  aggregateConfirmationCountsForDay,
  type DashboardDayConfirmationCounts,
} from "@/lib/dashboard-day-confirmation-counts";
import { countSwapRequestsForAreaDates } from "@/lib/dashboard-area-status-footer-lines";
import type { CommunicationSwapRequestRow } from "@/lib/communication-hub";

export type DashboardExtDayAreaSnapshot = {
  areaId: string;
  areaName: string;
  shiftCount: number;
  openSlots: number;
  ampelLevel: DashboardAreaAmpelLevel;
  /** Aggregierter Tages-Füllstand (Wochentray); null wenn kein Bedarf. */
  staffingGauge: DashboardDayAreaStaffingGauge | null;
  /** Planbare Servicezeit-Fenster für diesen Bereich an diesem Tag. */
  hasServiceHours: boolean;
  confirmationCounts: DashboardDayConfirmationCounts;
  swapRequestedCount: number;
};

export type DashboardExtDaySnapshot = {
  dateISO: string;
  weekdayLabel: string;
  isToday: boolean;
  isPast: boolean;
  shiftCount: number;
  openSlots: number;
  hasIssues: boolean;
  /** Mindestens ein Bereich mit planbaren Servicezeiten an diesem Tag. */
  hasServiceHours: boolean;
  areas: DashboardExtDayAreaSnapshot[];
  confirmationCounts: DashboardDayConfirmationCounts;
};

export type DashboardExtAreaSnapshot = {
  areaId: string;
  areaName: string;
  ampelLevel: DashboardAreaAmpelLevel;
  shiftCount: number;
  assignedTotal: number;
  requiredTotal: number;
  openSlots: number;
  criticalWindowLabel: string | null;
  issueCount: number;
};

export type DashboardExtIssueSnapshot = DashboardStaffingIssue & {
  areaId: string;
  areaName: string;
};

export type DashboardExtPanelSnapshot = {
  weekStart: string;
  dates: string[];
  todayISO: string;
  locationId: string | null;
  locationName: string;
  readOnlyWeek: boolean;
  staffingEnabled: boolean;
  shiftConfirmationEnabled: boolean;
  shiftCount: number;
  rollup: DashboardLocationWeekRollup;
  days: DashboardExtDaySnapshot[];
  areas: DashboardExtAreaSnapshot[];
  issues: DashboardExtIssueSnapshot[];
};

function weekdayLabelForDate(dateISO: string): string {
  return parseISODate(dateISO).toLocaleDateString("de-DE", { weekday: "short" });
}

function formatStaffingTimeLabel(
  weekdayLabel: string,
  startTime: string,
  endTime: string
): string {
  return `${weekdayLabel} ${startTime}–${endTime}`;
}

function formatCalendarTimeLabel(startTime: string, endTime: string): string {
  return `${startTime}–${endTime}`;
}

function formatCriticalWindowLabel(
  dateISO: string,
  entry: { calendarTimeLabel?: string; label: string }
): string {
  const weekday = weekdayLabelForDate(dateISO);
  const time = entry.calendarTimeLabel ?? entry.label;
  return `${weekday} ${time}`;
}

function formatWeekdayLabel(dateISO: string): string {
  return weekdayLabelForDate(dateISO);
}

function staffingWeekdayLabel(weekdayIndex: number): string {
  const labels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return labels[weekdayIndex] ?? "—";
}

/** Wie Dashboard — nur planungsrelevante Schichten für Bedarf/KPIs. */
function planningShiftsForDashboardStaffing(
  shifts: readonly PlanningShift[],
  cancelActors: Readonly<Record<string, "employee" | "manager">>
): PlanningShift[] {
  const cancelActorsMap = new Map(Object.entries(cancelActors));
  return shifts.filter((shift) =>
    shouldDisplayShiftOnPlanningCalendar({
      id: shift.id,
      shiftDate: shift.shift_date,
      confirmationStatus: shift.confirmationStatus,
      cancelActors: cancelActorsMap,
      cancelledBy: shift.displayState?.openCancellation?.cancelledBy,
    })
  );
}

function countShiftsOnDate(
  shifts: readonly PlanningShift[],
  dateISO: string,
  areaId?: string
): number {
  return shifts.filter(
    (shift) =>
      shift.shift_date === dateISO &&
      (areaId === undefined || shift.location_area_id === areaId)
  ).length;
}

function buildDaySnapshots(input: {
  dates: readonly string[];
  todayISO: string;
  areaStats: ReturnType<typeof sortDashboardAreaWeekStats>;
  shifts: readonly PlanningShift[];
  confirmationShifts: readonly PlanningShift[];
  swapRequests: readonly CommunicationSwapRequestRow[];
  serviceHours: DashboardSummaryPageBundle["serviceHours"];
}): DashboardExtDaySnapshot[] {
  const {
    dates,
    todayISO,
    areaStats,
    shifts,
    confirmationShifts,
    swapRequests,
    serviceHours,
  } = input;
  const areaIds = areaStats.map((stats) => stats.areaId);

  return dates.map((dateISO) => {
    const areas = areaStats.map((stats) => {
      const dayRows = stats.staffingWindowRows.filter(
        (row) => row.dateISO === dateISO
      );
      const openSlots = dayRows.reduce(
        (sum, row) => sum + Math.max(0, row.required - row.assigned),
        0
      );
      return {
        areaId: stats.areaId,
        areaName: stats.areaName,
        shiftCount: countShiftsOnDate(shifts, dateISO, stats.areaId),
        openSlots,
        ampelLevel: resolveDashboardAreaAmpelLevelFromWindowRows(dayRows),
        staffingGauge: resolveDashboardDayAreaStaffingGaugeFromWindowRows(dayRows),
        hasServiceHours: areaHasEffectiveServiceHoursOnDate(
          serviceHours,
          stats.areaId,
          dateISO
        ),
        confirmationCounts: aggregateConfirmationCountsForDay(
          confirmationShifts,
          dateISO,
          stats.areaId
        ),
        swapRequestedCount: countSwapRequestsForAreaDates({
          swapRequests,
          shifts: confirmationShifts,
          areaId: stats.areaId,
          dateISOs: [dateISO],
        }),
      };
    });

    const openSlots = areas.reduce((sum, area) => sum + area.openSlots, 0);
    const hasIssues = areaStats.some((stats) =>
      stats.staffingIssues.some((issue) => issue.dateISO === dateISO)
    );

    return {
      dateISO,
      weekdayLabel: weekdayLabelForDate(dateISO),
      isToday: dateISO === todayISO,
      isPast: isPastCalendarDate(dateISO, todayISO),
      shiftCount: countShiftsOnDate(shifts, dateISO),
      openSlots,
      hasIssues,
      hasServiceHours: hasEffectiveServiceHoursOnDate(
        serviceHours,
        dateISO,
        areaIds
      ),
      areas,
      confirmationCounts: aggregateConfirmationCountsForDay(
        confirmationShifts,
        dateISO
      ),
    };
  });
}

export async function loadDashboardExtPanelSnapshot(input: {
  week?: string;
  location?: string;
}): Promise<
  | { ok: true; data: DashboardExtPanelSnapshot; bundle: DashboardSummaryPageBundle }
  | { ok: false; error: "unauthorized" | "no_location" }
> {
  const session = await getManagerSession();
  if (!session) {
    return { ok: false, error: "unauthorized" };
  }

  const frame = await resolveDashboardPageFrame({
    week: input.week,
    location: input.location,
  });

  const {
    user,
    organization,
    orgId,
    timeZone,
    weekStart,
    dates,
    from,
    to,
    readOnlyWeek,
    locationParam,
  } = frame;

  const orgFeatures = getOrgFeatures(organization);
  const staffingEnabled = orgFeatures.staffing;
  const db = await getDatabase();

  const [locations, planningEmployees] = await Promise.all([
    db.listLocations(orgId),
    db.listPlanningEmployees(orgId),
  ]);

  const cookieStore = await cookies();
  const selectedLocationId = resolveSelectedLocationId(
    locations,
    locationParam ??
      readPlanningLocationCookie(
        cookieStore.get(PLANNING_SELECTED_LOCATION_COOKIE)?.value
      )
  );

  if (!selectedLocationId) {
    return { ok: false, error: "no_location" };
  }

  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? null;

  const bundle = await loadDashboardSummaryPageBundle({
    db,
    orgId,
    userId: user.id,
    organization,
    locationId: selectedLocationId,
    weekStart,
    from,
    to,
    timeZone,
    planningEmployees,
  });

  const profileQualificationIdsMap = new Map<string, Set<string>>();
  for (const [profileId, ids] of Object.entries(bundle.profileQualificationIds)) {
    profileQualificationIdsMap.set(profileId, new Set(ids));
  }

  const employeeNameById = new Map(
    bundle.employees.map((profile) => [profile.id, profile.full_name] as const)
  );

  const calendarStaffingShifts = planningShiftsForDashboardStaffing(
    bundle.locationShifts,
    bundle.communicationCancelActors
  );

  const areaStats = sortDashboardAreaWeekStats(
    bundle.areas.map((area) =>
      computeDashboardAreaWeekStats({
        area,
        dates,
        shifts: calendarStaffingShifts,
        staffingRules: bundle.staffingRules,
        staffingOverrides: bundle.staffingOverrides,
        serviceHours: bundle.serviceHours,
        areaShiftTemplates: bundle.areaShiftTemplates,
        qualifications: bundle.qualifications,
        profileQualificationIds: profileQualificationIdsMap,
        employeeNameById,
        compensationByKey: {},
        staffingEnabled,
        formatTimeLabel: formatStaffingTimeLabel,
        weekdayLabel: staffingWeekdayLabel,
        formatCalendarTimeLabel,
        formatCriticalWindowLabel,
        formatWeekdayLabel,
        swapRequests: bundle.communicationSwapRequests,
      })
    )
  );

  const rollup = computeDashboardLocationWeekRollup(areaStats);
  const todayISO = organizationTodayISO(timeZone);

  const days = buildDaySnapshots({
    dates,
    todayISO,
    areaStats,
    shifts: calendarStaffingShifts,
    confirmationShifts: bundle.locationShifts,
    swapRequests: bundle.communicationSwapRequests,
    serviceHours: bundle.serviceHours,
  });

  const areas: DashboardExtAreaSnapshot[] = areaStats.map((stats) => ({
    areaId: stats.areaId,
    areaName: stats.areaName,
    ampelLevel: stats.ampelLevel,
    shiftCount: stats.shiftCount,
    assignedTotal: stats.assignedTotal,
    requiredTotal: stats.requiredTotal,
    openSlots: stats.openSlots,
    criticalWindowLabel: stats.criticalWindowLabel,
    issueCount: stats.staffingIssues.length,
  }));

  const issues: DashboardExtIssueSnapshot[] = areaStats.flatMap((stats) =>
    stats.staffingIssues.map((issue) => ({
      ...issue,
      areaId: stats.areaId,
      areaName: stats.areaName,
    }))
  );

  return {
    ok: true,
    bundle,
    data: {
      weekStart,
      dates,
      todayISO,
      locationId: selectedLocationId,
      locationName: selectedLocation?.name ?? "",
      readOnlyWeek: readOnlyWeek,
      staffingEnabled,
      shiftConfirmationEnabled: organization.shift_confirmation_enabled ?? false,
      shiftCount: calendarStaffingShifts.length,
      rollup,
      days,
      areas,
      issues,
    },
  };
}

export function emptyDashboardExtPanelSnapshot(): DashboardExtPanelSnapshot {
  const bundle = emptyDashboardSummaryPageBundle();
  return {
    weekStart: "",
    dates: [],
    todayISO: "",
    locationId: null,
    locationName: "",
    readOnlyWeek: false,
    staffingEnabled: false,
    shiftConfirmationEnabled: false,
    shiftCount: 0,
    rollup: {
      assignedTotal: 0,
      requiredTotal: 0,
      openSlots: 0,
      criticalAreaCount: 0,
      totalHours: 0,
      baseCost: 0,
      surchargeCost: 0,
      totalCost: 0,
      hasCompensation: false,
      currency: "EUR",
    },
    days: [],
    areas: [],
    issues: [],
  };
}
