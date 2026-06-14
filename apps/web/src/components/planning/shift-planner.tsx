"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { assignShiftWithTimes, removeShift } from "@/app/actions/shifts";
import { isPastCalendarDate, toISODate, startOfWeek, parseISODate } from "@/lib/dates";
import { PlanningCalendarGrid } from "@/components/planning/planning-calendar-grid";
import { PlanningAssignShiftModal } from "@/components/planning/planning-assign-shift-modal";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import { planningShiftToDashboardCard, type PlanningShift } from "@/lib/planning-shift-card";
import { resolveNarrowDayColumnWidthsPx } from "@/lib/day-column-width";
import {
  createPlanningActiveDayDates,
  PLANNING_CALENDAR_LAYOUT_ANIMATION_DELAY_MS,
  PLANNING_DAY_HEADER_ROW_HEIGHT,
  PLANNING_EMPLOYEE_ROW_HEIGHT,
  PLANNING_STAFF_COLUMN_WIDTH_PX,
  planningCalendarMinWidth,
  planningGridTemplateColumns,
  resolvePlanningLayoutDayDates,
} from "@/lib/planning-calendar-layout";
import { resolveLocationServiceDayTimeline } from "@/lib/shift-card-cell-layout";
import { isAnyAreaOpenInCalendar, hasServiceHoursOnDate } from "@/lib/location-staffing-client";
import { isPlanningWeekAtEarliest } from "@schichtwerk/database";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { buildHolidayNamesByDate } from "@/lib/german-public-holidays";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrgFeatures } from "@/lib/org-features-provider";
import { translateActionError } from "@/lib/translate-action-error";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import {
  buildPlanningWarnings,
  formatPlanningHoursInParens,
  formatTimeRange,
  getDashboardWeekHeaderParts,
  planningHoursUnitLabel,
  shiftHours,
  weeklySummary,
} from "@/lib/planning-utils";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import {
  areaShiftTemplatesForArea,
  dashboardAssignmentPresetsForArea,
  resolvePresetIdFromTimes,
  areaShiftTemplateIdForAssign,
  type DashboardAssignmentPreset,
} from "@/lib/dashboard-assignment-presets";
import { validateDashboardShiftServiceHours } from "@/lib/service-hours-shift-validation";
import {
  areDashboardShiftTimesComplete,
  profileAvailabilityWeekdayFromDashboardDate,
} from "@/lib/available-employees-for-shift";
import {
  employeeHasRecurringAvailabilityOnWeekday,
  employeeMatchesShiftAvailability,
  isEmployeeAbsentOnDate,
} from "@schichtwerk/database";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type {
  AbsenceRequest,
  AreaShiftTemplateWithBreaks,
  AvailabilityStatus,
  Location,
  LocationArea,
  Profile,
  ProfileRecurringAvailability,
} from "@schichtwerk/types";
import { LocationSelect } from "@/components/dashboard/location-select";
import {
  Alert,
  Button,
  ControlDisplay,
  IconButton,
  Select,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";

/** Sidebar Schichtvorlagen: w-56 (224px) minus Farbpunkt (10px) und gap-2 (8px). */
const PLANNING_SHIFT_TEMPLATE_SIDEBAR_WIDTH_CLASS = "xl:w-[12.875rem]";

export type { PlanningShift } from "@/lib/planning-shift-card";

type AvailabilityRow = {
  employee_id: string;
  available_date: string;
  status: AvailabilityStatus;
};

type Props = {
  weekStart: string;
  dates: string[];
  employees: Profile[];
  shifts: PlanningShift[];
  availability: AvailabilityRow[];
  recurringAvailability: ProfileRecurringAvailability[];
  absences: AbsenceRequest[];
  locations: Location[];
  selectedLocationId: string | null;
  areas: LocationArea[];
  selectedAreaId: string | null;
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  serviceHours: AreaServiceHourRef[];
  readOnlyWeek?: boolean;
};

type Picker = { employeeId: string; date: string };

type DayAssignBlockReason = "absent" | "no_availability";

/** Gleiche Höhe wie IconButton size="md" (h-9). */
const HEADER_CONTROL_H = "h-9 min-h-9";

function getDayAssignBlockReason(
  employeeId: string,
  date: string,
  recurringAvailability: ProfileRecurringAvailability[],
  absences: AbsenceRequest[]
): DayAssignBlockReason | null {
  if (isEmployeeAbsentOnDate(employeeId, absences, date)) return "absent";
  const weekday = profileAvailabilityWeekdayFromDashboardDate(date);
  if (
    !employeeHasRecurringAvailabilityOnWeekday(
      employeeId,
      recurringAvailability,
      weekday
    )
  ) {
    return "no_availability";
  }
  return null;
}

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

export function ShiftPlanner({
  weekStart,
  dates,
  employees,
  shifts,
  availability,
  recurringAvailability,
  absences,
  locations,
  selectedLocationId,
  areas,
  selectedAreaId,
  areaShiftTemplates,
  serviceHours,
  readOnlyWeek = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const { locale } = useLocale();
  const features = useOrgFeatures();
  const atEarliestWeek = isPlanningWeekAtEarliest(weekStart);
  const simplePlanning = !features.areas;
  const intlLocale = toIntlLocale(locale);
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [complianceNotice, setComplianceNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:00");
  const [note, setNote] = useState("");
  const skipPresetFromTimesSyncRef = useRef(false);

  const templatesForArea = useMemo(
    () =>
      selectedAreaId
        ? areaShiftTemplatesForArea(selectedAreaId, areaShiftTemplates)
        : [],
    [areaShiftTemplates, selectedAreaId]
  );

  const assignmentPresets = useMemo(
    () => dashboardAssignmentPresetsForArea(templatesForArea),
    [templatesForArea]
  );

  const serviceHourAreaIds = useMemo(
    () => (selectedAreaId ? [selectedAreaId] : areas.map((area) => area.id)),
    [selectedAreaId, areas]
  );

  const holidayNames = useMemo(
    () => buildHolidayNamesByDate(dates, locale === "en" ? "en" : "de"),
    [dates, locale]
  );

  const dayHasServiceHours = useMemo(
    () =>
      dates.map((date) =>
        hasServiceHoursOnDate(serviceHours, date, serviceHourAreaIds)
      ),
    [dates, serviceHours, serviceHourAreaIds]
  );

  const currentWeekStart = useMemo(
    () => toISODate(startOfWeek(new Date())),
    [todayISO]
  );
  const isCurrentWeek = weekStart === currentWeekStart;

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const shift of shifts) {
      map.set(shift.shift_date, (map.get(shift.shift_date) ?? 0) + 1);
    }
    return map;
  }, [shifts]);

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const dashboardShiftsByDate = useMemo(() => {
    const map = new Map<string, DashboardShiftCard[]>();
    for (const date of dates) {
      map.set(
        date,
        shifts
          .filter((shift) => shift.shift_date === date)
          .flatMap((shift) => {
            const employee = employeesById.get(shift.employee_id);
            return employee
              ? [planningShiftToDashboardCard(shift, employee)]
              : [];
          })
      );
    }
    return map;
  }, [dates, shifts, employeesById]);

  const serviceTimelinesByDate = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof resolveLocationServiceDayTimeline>
    >();
    for (const date of dates) {
      map.set(date, resolveLocationServiceDayTimeline(serviceHours, date));
    }
    return map;
  }, [dates, serviceHours]);

  const dayHasOpenArea = useMemo(
    () =>
      dates.map((date) => {
        const hasShifts = (shiftsByDate.get(date) ?? 0) > 0;
        if (simplePlanning) {
          return !isPastCalendarDate(date, todayISO);
        }
        return isAnyAreaOpenInCalendar(
          serviceHours,
          serviceHourAreaIds,
          date,
          hasShifts
        );
      }),
    [
      dates,
      serviceHours,
      serviceHourAreaIds,
      shiftsByDate,
      simplePlanning,
      todayISO,
    ]
  );

  const [activeDayDates, setActiveDayDates] = useState<Set<string>>(() =>
    createPlanningActiveDayDates(
      dates,
      serviceHourAreaIds,
      serviceHours,
      shiftsByDate,
      { simplePlanning, todayISO }
    )
  );
  const [layoutActiveDayDates, setLayoutActiveDayDates] = useState<Set<string>>(
    () =>
      createPlanningActiveDayDates(
        dates,
        serviceHourAreaIds,
        serviceHours,
        shiftsByDate,
        { simplePlanning, todayISO }
      )
  );
  const layoutDayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planningLayoutScopeRef = useRef<string | null>(null);
  const currentWeekDayExpansionRef = useRef<Set<string>>(new Set());
  const hasInitializedCurrentWeekDayLayoutRef = useRef(false);
  const [isPlanningCalendarVisible, setIsPlanningCalendarVisible] =
    useState(false);

  const clearLayoutDayTimer = useCallback(() => {
    if (layoutDayTimerRef.current !== null) {
      clearTimeout(layoutDayTimerRef.current);
      layoutDayTimerRef.current = null;
    }
  }, []);

  const syncLayoutDaysImmediate = useCallback(
    (next: Set<string>) => {
      clearLayoutDayTimer();
      setLayoutActiveDayDates(new Set(next));
    },
    [clearLayoutDayTimer]
  );

  const scheduleLayoutDays = useCallback(
    (next: Set<string>) => {
      clearLayoutDayTimer();
      layoutDayTimerRef.current = setTimeout(() => {
        setLayoutActiveDayDates(new Set(next));
        layoutDayTimerRef.current = null;
      }, PLANNING_CALENDAR_LAYOUT_ANIMATION_DELAY_MS);
    },
    [clearLayoutDayTimer]
  );

  useEffect(
    () => () => {
      clearLayoutDayTimer();
    },
    [clearLayoutDayTimer]
  );

  useLayoutEffect(() => {
    const scopeKey = `${weekStart}:${selectedLocationId ?? ""}:${selectedAreaId ?? ""}`;
    if (planningLayoutScopeRef.current === scopeKey) {
      return;
    }
    planningLayoutScopeRef.current = scopeKey;

    const isFirstCurrentWeekView =
      weekStart === currentWeekStart &&
      !hasInitializedCurrentWeekDayLayoutRef.current;
    const nextDays = resolvePlanningLayoutDayDates(
      dates,
      serviceHourAreaIds,
      serviceHours,
      shiftsByDate,
      {
        weekStart,
        currentWeekStart,
        todayISO,
        savedCurrentWeekExpansion: isFirstCurrentWeekView
          ? null
          : currentWeekDayExpansionRef.current,
        isFirstCurrentWeekView,
        simplePlanning,
      }
    );
    if (weekStart === currentWeekStart) {
      if (isFirstCurrentWeekView) {
        hasInitializedCurrentWeekDayLayoutRef.current = true;
      }
      currentWeekDayExpansionRef.current = new Set(nextDays);
    }
    setActiveDayDates(nextDays);
    syncLayoutDaysImmediate(nextDays);
    setIsPlanningCalendarVisible(true);
  }, [
    dates,
    weekStart,
    currentWeekStart,
    todayISO,
    selectedLocationId,
    selectedAreaId,
    serviceHourAreaIds,
    serviceHours,
    shiftsByDate,
    simplePlanning,
    syncLayoutDaysImmediate,
  ]);

  const toggleDayActive = useCallback(
    (date: string, active: boolean) => {
      setActiveDayDates((prev) => {
        const next = new Set(prev);
        if (active) next.add(date);
        else next.delete(date);
        if (isCurrentWeek) {
          currentWeekDayExpansionRef.current = new Set(next);
        }
        scheduleLayoutDays(next);
        return next;
      });
    },
    [isCurrentWeek, scheduleLayoutDays]
  );

  const dayUsesWideColumn = useMemo(
    () =>
      dates.map((date, dayIndex) => {
        if (!layoutActiveDayDates.has(date)) return false;
        if (!dayHasOpenArea[dayIndex]) return false;
        const hasShifts = (shiftsByDate.get(date) ?? 0) > 0;
        return hasShifts || dayHasServiceHours[dayIndex];
      }),
    [
      dates,
      dayHasOpenArea,
      dayHasServiceHours,
      shiftsByDate,
      layoutActiveDayDates,
    ]
  );

  const fillColumnsEqually = useMemo(
    () => !dayUsesWideColumn.some(Boolean),
    [dayUsesWideColumn]
  );

  const narrowDayColumnWidthsPx = useMemo(
    () => resolveNarrowDayColumnWidthsPx(dates, holidayNames, intlLocale),
    [dates, holidayNames, intlLocale]
  );

  const columnTemplate = useMemo(
    () =>
      planningGridTemplateColumns(
        PLANNING_STAFF_COLUMN_WIDTH_PX,
        dayUsesWideColumn,
        narrowDayColumnWidthsPx,
        fillColumnsEqually
      ),
    [dayUsesWideColumn, narrowDayColumnWidthsPx, fillColumnsEqually]
  );

  const minPlanningCalendarWidth = useMemo(() => {
    if (fillColumnsEqually) return undefined;
    return planningCalendarMinWidth(
      PLANNING_STAFF_COLUMN_WIDTH_PX,
      dayUsesWideColumn,
      narrowDayColumnWidthsPx
    );
  }, [dayUsesWideColumn, narrowDayColumnWidthsPx, fillColumnsEqually]);

  const planningRowTemplate = useMemo(() => {
    const bodyRows = employees.length > 0 ? `repeat(${employees.length}, ${PLANNING_EMPLOYEE_ROW_HEIGHT})` : "";
    const footerRow = "auto";
    return `${PLANNING_DAY_HEADER_ROW_HEIGHT} ${bodyRows} ${footerRow}`.trim();
  }, [employees.length]);

  const timesComplete = areDashboardShiftTimesComplete(startTime, endTime);

  const shiftMap = useMemo(() => {
    const map = new Map<string, PlanningShift>();
    for (const s of shifts) map.set(`${s.employee_id}:${s.shift_date}`, s);
    return map;
  }, [shifts]);

  const availabilityMap = useMemo(() => {
    const map = new Map<string, AvailabilityStatus>();
    for (const a of availability) {
      map.set(`${a.employee_id}:${a.available_date}`, a.status);
    }
    return map;
  }, [availability]);

  const summary = useMemo(
    () => weeklySummary(shifts, employees),
    [shifts, employees]
  );

  const warnings = useMemo(
    () => buildPlanningWarnings(employees, shifts, dates),
    [employees, shifts, dates]
  );

  const dailyCounts = useMemo(() => {
    return dates.map((date) => {
      const dayShifts = shifts.filter((s) => s.shift_date === date);
      const byPreset = assignmentPresets.map((preset) => ({
        preset,
        count: dayShifts.filter(
          (shift) =>
            resolvePresetIdFromTimes(
              shift.startTime,
              shift.endTime,
              assignmentPresets
            ) === preset.id
        ).length,
      }));
      return { date, total: dayShifts.length, byPreset };
    });
  }, [dates, shifts, assignmentPresets]);

  const pickerEmployee = picker
    ? employees.find((e) => e.id === picker.employeeId)
    : null;

  const pushPlanungQuery = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      const q = params.toString();
      startTransition(() => {
        router.push(q ? `/planung?${q}` : "/planung");
      });
    },
    [router, searchParams]
  );

  const weekHeader = useMemo(
    () => getDashboardWeekHeaderParts(weekStart, intlLocale),
    [weekStart, intlLocale]
  );

  const weekLabelTitle = `${weekHeader.rangeLabel} ${weekHeader.year} KW ${weekHeader.calendarWeek}`;

  const navigateWeek = useCallback(
    (delta: number) => {
      if (delta < 0 && atEarliestWeek) return;
      const d = parseISODate(weekStart);
      d.setDate(d.getDate() + delta * 7);
      pushPlanungQuery({ week: toISODate(d) });
    },
    [atEarliestWeek, pushPlanungQuery, weekStart]
  );

  const goToToday = useCallback(() => {
    pushPlanungQuery({ week: toISODate(startOfWeek(new Date())) });
  }, [pushPlanungQuery]);

  function isDayReadOnly(date: string) {
    return readOnlyWeek || isPastShiftDate(date);
  }

  function applyPreset(preset: DashboardAssignmentPreset) {
    setSelectedPresetId(preset.id);
    setStartTime(timeFieldValue(preset.start_time));
    setEndTime(timeFieldValue(preset.end_time));
  }

  function openPicker(employeeId: string, date: string) {
    const existing = shiftMap.get(`${employeeId}:${date}`);
    if (isDayReadOnly(date) && !existing) return;
    if (
      !existing &&
      getDayAssignBlockReason(employeeId, date, recurringAvailability, absences)
    ) {
      return;
    }
    setPicker({ employeeId, date });
    setError(null);
    if (existing) {
      setStartTime(existing.startTime);
      setEndTime(existing.endTime);
      const matchedPresetId =
        resolvePresetIdFromTimes(
          existing.startTime,
          existing.endTime,
          assignmentPresets
        ) ?? "";
      setSelectedPresetId(matchedPresetId);
    } else if (assignmentPresets[0]) {
      applyPreset(assignmentPresets[0]);
    } else {
      setSelectedPresetId("");
      setStartTime("00:00");
      setEndTime("00:00");
    }
  }

  useEffect(() => {
    if (skipPresetFromTimesSyncRef.current) {
      skipPresetFromTimesSyncRef.current = false;
      return;
    }
    if (!timesComplete) {
      if (selectedPresetId) setSelectedPresetId("");
      return;
    }
    const matchedPresetId = resolvePresetIdFromTimes(
      startTime,
      endTime,
      assignmentPresets
    );
    if (matchedPresetId !== selectedPresetId) {
      setSelectedPresetId(matchedPresetId ?? "");
    }
  }, [startTime, endTime, assignmentPresets, selectedPresetId, timesComplete]);

  function handlePresetChange(presetId: string) {
    const preset = assignmentPresets.find((entry) => entry.id === presetId);
    if (preset) {
      skipPresetFromTimesSyncRef.current = true;
      applyPreset(preset);
    } else {
      setSelectedPresetId(presetId);
    }
  }

  function handleAssign() {
    if (!picker || isDayReadOnly(picker.date)) return;
    if (!selectedLocationId) {
      setError(t("dashboard.noLocations"));
      return;
    }
    if (!simplePlanning && !selectedAreaId) {
      setError(t("planning.noAreas"));
      return;
    }
    if (!timesComplete) {
      setError(t("dashboard.bulkShiftValidationTimesRequired"));
      return;
    }

    if (!simplePlanning) {
      const serviceHoursCheck = validateDashboardShiftServiceHours(
        serviceHours,
        selectedAreaId!,
        picker.date,
        startTime,
        endTime
      );
      if (!serviceHoursCheck.ok) {
        setError(translateActionError(serviceHoursCheck.error, t));
        return;
      }
    }

    const weekday = profileAvailabilityWeekdayFromDashboardDate(picker.date);
    if (isEmployeeAbsentOnDate(picker.employeeId, absences, picker.date)) {
      setError(t("shiftAssign.employeeAbsent"));
      return;
    }
    if (
      !employeeMatchesShiftAvailability(
        picker.employeeId,
        recurringAvailability,
        weekday,
        startTime,
        endTime
      )
    ) {
      setError(t("shiftAssign.shiftOutsideAvailability"));
      return;
    }

    setError(null);
    setComplianceNotice(null);
    startTransition(async () => {
      const result = await assignShiftWithTimes({
        employeeId: picker.employeeId,
        shiftDate: picker.date,
        startTime,
        endTime,
        areaShiftTemplateId: simplePlanning
          ? null
          : areaShiftTemplateIdForAssign(selectedPresetId),
        locationId: selectedLocationId,
        locationAreaId: simplePlanning ? null : selectedAreaId,
      });
      if (!result.ok) {
        setError(translateActionError(result.error, t));
        setComplianceNotice(null);
        return;
      }
      setPicker(null);
      setNote("");
      router.refresh();
      if (result.warnings?.length) {
        setComplianceNotice(result.warnings.join(" "));
      }
    });
  }

  function handleRemove(shiftId: string) {
    if (picker && isDayReadOnly(picker.date)) return;
    setError(null);
    startTransition(async () => {
      const result = await removeShift(shiftId);
      if (!result.ok) setError(translateActionError(result.error, t));
      else {
        setPicker(null);
        router.refresh();
      }
    });
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-muted">
          {t("planning.noEmployeesPrefix")}{" "}
          <a href="/dashboard?profiles=1" className="font-medium text-primary">
            {t("planning.noEmployeesProfilesLink")}
          </a>{" "}
          {t("planning.noEmployeesSuffix")}
        </p>
      </div>
    );
  }

  const getDayAssignBlockReasonForCell = useCallback(
    (employeeId: string, date: string) =>
      getDayAssignBlockReason(
        employeeId,
        date,
        recurringAvailability,
        absences
      ),
    [recurringAvailability, absences]
  );

  const canAssign =
    Boolean(selectedLocationId) &&
    (simplePlanning ||
      (Boolean(selectedAreaId) && assignmentPresets.length > 0));

  return (
    <div className="-m-4 flex min-h-[calc(100vh-4.5rem)] flex-col bg-subtle md:-m-6">
      <header className="border-b border-border bg-surface px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Schichtplan erstellen
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip content="Demnächst verfügbar">
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                >
                  Vorlage der Vorwoche übernehmen
                </Button>
              </span>
            </Tooltip>
            <Tooltip content="Demnächst verfügbar">
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                >
                  Leeren Plan erstellen
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 select-none md:gap-4">
          <div
            role="group"
            aria-label={`${t("common.prevWeek")} / ${t("common.nextWeek")}`}
            className="flex shrink-0 items-center gap-1.5 sm:gap-2"
          >
            <IconButton
              size="md"
              onClick={() => navigateWeek(-1)}
              disabled={pending || atEarliestWeek}
              aria-label={t("common.prevWeek")}
              className={cn(HEADER_CONTROL_H, "shrink-0 text-muted")}
            >
              <ChevronIcon direction="left" />
            </IconButton>

            <Button
              type="button"
              variant="outline"
              size="header"
              onClick={goToToday}
              disabled={pending}
              className={cn(HEADER_CONTROL_H, "shrink-0 font-semibold")}
            >
              {t("common.today")}
            </Button>

            <IconButton
              size="md"
              onClick={() => navigateWeek(1)}
              disabled={pending}
              aria-label={t("common.nextWeek")}
              className={cn(HEADER_CONTROL_H, "shrink-0 text-muted")}
            >
              <ChevronIcon direction="right" />
            </IconButton>
          </div>

          <p
            className="min-w-0 select-none text-sm leading-none"
            title={weekLabelTitle}
          >
            <span className="font-semibold">{weekHeader.monthYearLabel}</span>
            <span className="ml-1.5 text-xs font-normal text-muted">
              KW {weekHeader.calendarWeek}
            </span>
          </p>

          {features.areas ? (
            <div className="flex shrink-0 flex-nowrap items-center">
              <span className="shrink-0 text-sm text-foreground">
                {t("dashboard.location")}
              </span>
              <div className="ml-2 w-[11rem] shrink-0">
                <LocationSelect
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                  basePath="/planung"
                  className="!mt-0 w-full font-semibold"
                />
              </div>
              <span className="ml-5 shrink-0 text-sm text-foreground">
                {t("planning.area")}
              </span>
              <div className="ml-2 w-[11rem] shrink-0">
                {areas.length === 0 ? (
                  <ControlDisplay className="w-full py-2 text-muted">
                    {t("planning.noAreas")}
                  </ControlDisplay>
                ) : (
                  <Select
                    value={selectedAreaId ?? areas[0].id}
                    disabled={pending || areas.length === 0}
                    aria-label={t("planning.selectArea")}
                    className="w-full font-semibold"
                    onChange={(event) =>
                      pushPlanungQuery({ area: event.target.value })
                    }
                  >
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                        {area.archived_at ? ` (${t("common.archived")})` : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {readOnlyWeek && (
        <Alert variant="info" className="mx-4 mt-4 md:mx-6">
          {t("planning.readOnlyWeek")}
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mx-4 mt-4 md:mx-6">
          {error}
        </Alert>
      )}

      {complianceNotice && (
        <Alert variant="info" className="mx-4 mt-4 md:mx-6">
          {complianceNotice}
        </Alert>
      )}

      <div className="flex flex-1 flex-col gap-0 overflow-hidden xl:flex-row">
        <aside
          className={cn(
            "hidden shrink-0 overflow-y-auto border-b border-border bg-surface p-4 xl:block xl:border-b-0 xl:border-r",
            PLANNING_SHIFT_TEMPLATE_SIDEBAR_WIDTH_CLASS,
            MODAL_SCROLLBAR_CLASS
          )}
        >
          {!simplePlanning ? (
            <SidebarSection title={t("dashboard.shiftTemplateLabel")}>
              {assignmentPresets.length === 0 ? (
                <p className="text-xs text-muted">
                  {t("dashboard.noShiftTemplatesForArea")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {assignmentPresets.map((preset) => {
                    const hours = shiftHours({
                      start_time: preset.start_time,
                      end_time: preset.end_time,
                    });
                    return (
                    <li
                      key={preset.id}
                      className="rounded-lg border border-border bg-background p-2.5"
                    >
                      <div className="min-w-0 text-sm font-medium">{preset.name}</div>
                      <p className="mt-1 text-xs text-muted">
                        {formatTimeRange(preset.start_time, preset.end_time)}{" "}
                        {formatPlanningHoursInParens(hours, locale)}
                      </p>
                    </li>
                    );
                  })}
                </ul>
              )}
            </SidebarSection>
          ) : null}

          <SidebarSection title={t("planning.legendAvailability")} className={simplePlanning ? "" : "mt-6"}>
            <LegendDot color="#22c55e" label={t("planning.legendAvailable")} />
            <LegendDot color="#eab308" label={t("planning.legendPreferred")} />
            <LegendDot color="#ef4444" label={t("planning.legendUnavailable")} />
            <LegendDot color="#94a3b8" label={t("planning.legendAbsent")} />
          </SidebarSection>
        </aside>

        <main
          className={cn(
            "min-w-0 flex-1 overflow-auto p-3 md:p-4",
            MODAL_SCROLLBAR_CLASS
          )}
        >
          <PlanningCalendarGrid
            dates={dates}
            employees={employees}
            shifts={shifts}
            shiftMap={shiftMap}
            availabilityMap={availabilityMap}
            holidayNames={holidayNames}
            dayHasServiceHours={dayHasServiceHours}
            dayHasOpenArea={dayHasOpenArea}
            activeDayDates={activeDayDates}
            layoutActiveDayDates={layoutActiveDayDates}
            dashboardShiftsByDate={dashboardShiftsByDate}
            serviceTimelinesByDate={serviceTimelinesByDate}
            columnTemplate={columnTemplate}
            rowTemplate={planningRowTemplate}
            minCalendarWidth={minPlanningCalendarWidth}
            fillColumnsEqually={fillColumnsEqually}
            narrowDayColumnWidthsPx={narrowDayColumnWidthsPx}
            dayUsesWideColumn={dayUsesWideColumn}
            isCalendarVisible={isPlanningCalendarVisible}
            todayISO={todayISO}
            intlLocale={intlLocale}
            locale={locale}
            pending={pending}
            canAssign={canAssign}
            picker={picker}
            dailyCounts={dailyCounts}
            t={t}
            isDayReadOnly={isDayReadOnly}
            getDayAssignBlockReason={getDayAssignBlockReasonForCell}
            onToggleDayActive={toggleDayActive}
            onOpenPicker={openPicker}
          />
        </main>

        <aside
          className={cn(
            "hidden w-full shrink-0 border-t border-border bg-surface xl:block xl:w-72 xl:border-t-0 xl:border-l",
            MODAL_SCROLLBAR_CLASS
          )}
          aria-hidden
        />

        {picker && pickerEmployee ? (
          <PlanningAssignShiftModal
            employee={pickerEmployee}
            date={picker.date}
            intlLocale={intlLocale}
            t={t}
            simplePlanning={simplePlanning}
            assignmentPresets={assignmentPresets}
            selectedPresetId={selectedPresetId}
            onPresetChange={handlePresetChange}
            startTime={startTime}
            endTime={endTime}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            note={note}
            onNoteChange={setNote}
            dayReadOnly={isDayReadOnly(picker.date)}
            pending={pending}
            timesComplete={timesComplete}
            canAssign={canAssign}
            hasExistingShift={Boolean(
              shiftMap.get(`${picker.employeeId}:${picker.date}`)
            )}
            onAssign={handleAssign}
            onRemove={() => {
              const shift = shiftMap.get(`${picker.employeeId}:${picker.date}`);
              if (shift) handleRemove(shift.id);
            }}
            onClose={() => setPicker(null)}
          />
        ) : null}
      </div>

      <footer className="grid gap-4 border-t border-border bg-surface p-4 lg:grid-cols-3">
        <FooterPanel title="Wochenzusammenfassung">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Geplante Stunden"
              value={`${summary.plannedHours} ${planningHoursUnitLabel(locale)}`}
            />
            <Stat
              label="Gesamtstunden Soll"
              value={`${summary.targetHours} ${planningHoursUnitLabel(locale)}`}
            />
            <Stat label="Offene Schichten" value={String(summary.openShifts)} />
            <Stat
              label="Geschätzte Personalkosten"
              value={`${summary.estimatedCost} €`}
            />
          </div>
        </FooterPanel>

        <FooterPanel title="Warnungen">
          {warnings.length === 0 ? (
            <p className="text-sm text-muted">Keine Warnungen für diese Woche.</p>
          ) : (
            <ul className="space-y-2">
              {warnings.map((w) => (
                <li
                  key={w.id}
                  className="flex gap-2 text-sm text-amber-800"
                >
                  <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
                  {w.message}
                </li>
              ))}
            </ul>
          )}
        </FooterPanel>

        <FooterPanel title="Aktionen">
          <div className="space-y-2">
            <ActionLink disabled>PDF exportieren</ActionLink>
            <ActionLink disabled>Excel exportieren</ActionLink>
            <ActionLink disabled>Personal benachrichtigen</ActionLink>
          </div>
        </FooterPanel>
      </footer>
    </div>
  );
}

function SidebarSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs text-muted">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </div>
  );
}

function FooterPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function ActionLink({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="block cursor-not-allowed text-sm text-muted opacity-60">
        {children}
      </span>
    );
  }
  return (
    <Button type="button" variant="ghost" size="sm" className="h-auto justify-start px-0 text-primary">
      {children}
    </Button>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="currentColor"
      aria-hidden
      className={direction === "right" ? "scale-x-[-1]" : undefined}
    >
      <path d="M7 0L1 6l6 6V0z" />
    </svg>
  );
}

/** @deprecated Use ShiftPlanner */
export const WeekCalendar = ShiftPlanner;