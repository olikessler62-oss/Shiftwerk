"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignShiftWithTimes } from "@/app/actions/shifts";
import {
  fetchDashboardStaffingCandidateContext,
  fetchDashboardStaffingCandidateEmployeeTooltip,
  type AreaCalendarShiftAssignEmployee,
  type OrganizationWeekShiftRef,
  type ProfileShiftPreferenceEntry,
} from "@/app/actions/areacalendar-shift-assign";
import { DashboardStaffingCandidateEmployeeTooltipContent } from "@/components/dashboard/dashboard-staffing-candidate-employee-tooltip-content";
import {
  Tooltip,
  DASHBOARD_STAFFING_CANDIDATE_TOOLTIP_OPEN_DELAY_MS,
  employeeAvailabilityTooltipContentClassName,
  employeeAvailabilityTooltipPlacement,
} from "@/components/ui/tooltip";
import type { DashboardStaffingCandidateEmployeeTooltipPayload } from "@/lib/dashboard-staffing-candidate-employee-tooltip";
import {
  settingsFixedNestedOverlayClass,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsNestedModalDialogClass,
  MODAL_SCROLLBAR_CLASS,
} from "@/components/settings/settings-modal-shell";
import { SettingsModalHeader } from "@/components/settings/settings-list-ui";
import { Alert, Button, CloseIcon } from "@/components/ui";
import { useTranslations, useLocale } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import {
  areaCalendarAssignmentPresetsForArea,
  areaShiftTemplateIdForAssign,
  resolvePresetShiftTemplateForDemandTimes,
  type AreaCalendarAssignmentPreset,
} from "@/lib/areacalendar-assignment-presets";
import { cn } from "@/lib/cn";
import {
  DASHBOARD_MODAL_ROUNDED_CLASS,
  DASHBOARD_PANEL_ROUNDED_CLASS,
} from "@/lib/dashboard-panel-styles";
import { DASHBOARD_UI_BUTTON_CLASS } from "@/lib/dashboard-toolbar-ui";
import type { DashboardStaffingWindowRow } from "@/lib/dashboard-area-week-stats";
import {
  computeDashboardStaffingCandidateSlots,
  filterDashboardStaffingCandidates,
  resolveDashboardStaffingWishContext,
  sortDashboardStaffingCandidates,
  weeklyAssignedMinutesByEmployeeId,
} from "@/lib/dashboard-staffing-candidates";
import {
  areAreaCalendarShiftTimesComplete,
  profileAvailabilityWeekdayFromAreaCalendarDate,
} from "@/lib/available-employees-for-shift";
import { weekDates } from "@/lib/dates";
import {
  isoWeekStartFromShiftDate,
} from "@schichtwerk/database";
import { formatDayHeader } from "@/lib/planning-utils";
import type { EmployeeWeeklyHoursDisplay } from "@/lib/employee-weekly-hours-display";
import {
  buildAreaIdToLocationIdMap,
  buildEmployeeWeeklyHoursDisplay,
  buildEmployeeWeeklyHoursDisplayByEmployeeId,
  buildEmployeeWeeklyHoursDisplayLinesByEmployeeId,
  buildLocationNameByIdMap,
  employeeWeeklyHoursAssignedMinutes,
} from "@/lib/employee-weekly-hours-display";
import { EmployeeWeeklyHoursLines } from "@/components/planning/employee-weekly-hours-lines";
import { useAppShellModalLockActive } from "@/lib/app-shell-modal-lock";
import { translateActionError } from "@/lib/translate-action-error";
import { useSimulatedProposedOnAssignRequest } from "@/lib/shift-confirmation-simulation-context";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
  LocationAreaStaffing,
  LocationAreaStaffingOverride,
  Qualification,
} from "@schichtwerk/types";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";

export type DashboardStaffingCandidatesPlanningContext = {
  weekStart: string;
  dates: readonly string[];
  /** Organisationsweite Schichten der Planungswoche — Wochenstunden wie beim Speichern. */
  weeklyHoursShifts?: readonly PlanningShift[];
  locations?: readonly { id: string; name: string }[];
  planningAreas?: readonly LocationArea[];
  locationId: string;
  areaId: string;
  areaName: string;
  simplePlanning: boolean;
  calendarShifts: readonly PlanningShift[];
  staffingRules: readonly LocationAreaStaffing[];
  staffingOverrides: readonly LocationAreaStaffingOverride[];
  serviceHours: readonly AreaServiceHourRef[];
  areaShiftTemplates: readonly AreaShiftTemplateWithBreaks[];
  qualifications: readonly Qualification[];
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
  employeeNameById?: ReadonlyMap<string, string>;
  areaCalendarHref: string;
  readOnlyWeek: boolean;
  formatTimeLabel: (
    weekdayLabel: string,
    startTime: string,
    endTime: string
  ) => string;
  weekdayLabel: (weekdayIndex: number) => string;
  formatCalendarTimeLabel: (startTime: string, endTime: string) => string;
};

type LoadedContext = {
  employees: AreaCalendarShiftAssignEmployee[];
  profileQualificationIds: Record<string, string[]>;
  profileShiftPreferences: Record<string, ProfileShiftPreferenceEntry[]>;
  countryCode: string;
  timeZone: string;
  organizationWeekShifts: PlanningShift[];
  locations: { id: string; name: string }[];
};

function organizationWeekShiftsToPlanningShifts(
  shifts: readonly OrganizationWeekShiftRef[]
): PlanningShift[] {
  return shifts.map((shift) => ({
    id: shift.id,
    employee_id: shift.employee_id,
    shift_date: shift.shift_date,
    shiftName: "",
    color: "#64748b",
    startTime: shift.startTime,
    endTime: shift.endTime,
    location_id: shift.location_id,
    location_area_id: shift.location_area_id,
    area_shift_template_id: shift.area_shift_template_id,
  }));
}

type Props = {
  row: DashboardStaffingWindowRow;
  planning: DashboardStaffingCandidatesPlanningContext;
  onClose: () => void;
};

export function DashboardStaffingRowCandidatesModal({
  row,
  planning,
  onClose,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const router = useRouter();
  const { simulatedProposedOnAssign, relaxAppRegistrationGate } =
    useSimulatedProposedOnAssignRequest();

  useAppShellModalLockActive(true);

  const [loadedContext, setLoadedContext] = useState<LoadedContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(null);

  const assignmentPresets = useMemo(
    (): AreaCalendarAssignmentPreset[] =>
      areaCalendarAssignmentPresetsForArea(
        planning.areaShiftTemplates.filter(
          (template) => template.location_area_id === planning.areaId
        )
      ),
    [planning.areaShiftTemplates, planning.areaId]
  );

  const slots = useMemo(
    () =>
      computeDashboardStaffingCandidateSlots({
        areaId: planning.areaId,
        dateISO: row.dateISO,
        serviceHourId: row.serviceHourId,
        simplePlanning: planning.simplePlanning,
        shifts: planning.calendarShifts,
        staffingRules: planning.staffingRules,
        staffingOverrides: planning.staffingOverrides,
        serviceHours: planning.serviceHours,
        assignmentPresets,
        qualifications: planning.qualifications,
        profileQualificationIds: planning.profileQualificationIds,
        employeeNameById: planning.employeeNameById,
        formatTimeLabel: planning.formatTimeLabel,
        weekdayLabel: planning.weekdayLabel,
        formatCalendarTimeLabel: planning.formatCalendarTimeLabel,
        headcountSectionLabel: t("dashboard.staffingCandidatesHeadcountSection"),
      }),
    [row, planning, assignmentPresets, t]
  );

  const mergedProfileQualificationIds = useMemo(() => {
    if (!loadedContext) return planning.profileQualificationIds;
    const map = new Map(planning.profileQualificationIds);
    for (const [profileId, ids] of Object.entries(
      loadedContext.profileQualificationIds
    )) {
      map.set(profileId, new Set(ids));
    }
    return map;
  }, [loadedContext, planning.profileQualificationIds]);

  const weeklyHoursWeekDates = useMemo(() => {
    const isoWeekStart = isoWeekStartFromShiftDate(row.dateISO);
    return weekDates(isoWeekStart);
  }, [row.dateISO]);

  const shiftsForWeeklyHoursDisplay = useMemo(() => {
    if (loadedContext?.organizationWeekShifts.length) {
      return loadedContext.organizationWeekShifts;
    }
    if (planning.weeklyHoursShifts?.length) {
      return planning.weeklyHoursShifts;
    }
    return planning.calendarShifts;
  }, [
    loadedContext?.organizationWeekShifts,
    planning.weeklyHoursShifts,
    planning.calendarShifts,
  ]);

  const shiftsForWeeklyHoursValidation = shiftsForWeeklyHoursDisplay;

  const locationNameById = useMemo(() => {
    const locations =
      loadedContext?.locations.length
        ? loadedContext.locations
        : planning.locations ?? [];
    return buildLocationNameByIdMap(locations);
  }, [loadedContext?.locations, planning.locations]);

  const areaIdToLocationId = useMemo(
    () =>
      buildAreaIdToLocationIdMap(
        (planning.planningAreas ?? []).map((area) => ({
          id: area.id,
          location_id: area.location_id,
        }))
      ),
    [planning.planningAreas]
  );

  const weeklyAssignedMinutes = useMemo(() => {
    const map = new Map<string, number>();
    if (!loadedContext) return map;

    for (const employee of loadedContext.employees) {
      const display = buildEmployeeWeeklyHoursDisplay({
        employeeId: employee.id,
        shifts: shiftsForWeeklyHoursDisplay,
        weekDates: weeklyHoursWeekDates,
        targetHours: employee.weekly_hours ?? 40,
        locationNameById,
        areaIdToLocationId,
        fallbackLocationId: planning.locationId,
      });
      map.set(employee.id, employeeWeeklyHoursAssignedMinutes(display));
    }
    return map;
  }, [
    loadedContext,
    shiftsForWeeklyHoursDisplay,
    weeklyHoursWeekDates,
    locationNameById,
    areaIdToLocationId,
    planning.locationId,
  ]);

  const weeklyHoursDisplayByEmployeeId = useMemo(() => {
    if (!loadedContext) return new Map<string, EmployeeWeeklyHoursDisplay>();

    return buildEmployeeWeeklyHoursDisplayByEmployeeId({
      employees: loadedContext.employees,
      shifts: shiftsForWeeklyHoursDisplay,
      weekDates: weeklyHoursWeekDates,
      locationNameById,
      areaIdToLocationId,
      fallbackLocationId: planning.locationId,
    });
  }, [
    loadedContext,
    shiftsForWeeklyHoursDisplay,
    weeklyHoursWeekDates,
    locationNameById,
    areaIdToLocationId,
    planning.locationId,
  ]);

  const weeklyHoursLabelByEmployeeId = useMemo(() => {
    if (!loadedContext) return new Map<string, string[]>();

    return buildEmployeeWeeklyHoursDisplayLinesByEmployeeId({
      employees: loadedContext.employees,
      shifts: shiftsForWeeklyHoursDisplay,
      weekDates: weeklyHoursWeekDates,
      locale,
      locationNameById,
      totalLabel: t("dashboard.weeklyHoursTotalLabel"),
      areaIdToLocationId,
      fallbackLocationId: planning.locationId,
    });
  }, [
    loadedContext,
    shiftsForWeeklyHoursDisplay,
    weeklyHoursWeekDates,
    locale,
    locationNameById,
    areaIdToLocationId,
    planning.locationId,
    t,
  ]);

  const employeeColorById = useMemo(() => {
    const map = new Map<string, string | null>();
    if (!loadedContext) return map;
    for (const employee of loadedContext.employees) {
      map.set(employee.id, employee.color);
    }
    return map;
  }, [loadedContext]);

  const weeklyHoursTargetByEmployeeId = useMemo(() => {
    const map = new Map<string, number>();
    if (!loadedContext) return map;
    for (const employee of loadedContext.employees) {
      map.set(employee.id, employee.weekly_hours ?? 40);
    }
    return map;
  }, [loadedContext]);

  const slotCandidates = useMemo(() => {
    if (!loadedContext) return new Map<string, { id: string; full_name: string }[]>();

    const weekday = profileAvailabilityWeekdayFromAreaCalendarDate(row.dateISO);
    const result = new Map<string, { id: string; full_name: string }[]>();

    for (const slot of slots) {
      const key = slot.qualificationId ?? "__headcount__";
      const filtered = filterDashboardStaffingCandidates({
        slot,
        row: {
          dateISO: row.dateISO,
          timeFrom: row.timeFrom,
          timeTo: row.timeTo,
        },
        areaId: planning.areaId,
        locationId: planning.locationId,
        simplePlanning: planning.simplePlanning,
        employees: loadedContext.employees,
        profileQualificationIds: mergedProfileQualificationIds,
        profileShiftPreferences: loadedContext.profileShiftPreferences,
        areaShifts: planning.calendarShifts.filter(
          (shift) => shift.location_area_id === planning.areaId
        ),
        locationShifts: shiftsForWeeklyHoursValidation,
        weekDates: weeklyHoursWeekDates,
        timeZone: loadedContext.timeZone,
        countryCode: loadedContext.countryCode,
      });

      const sorted = sortDashboardStaffingCandidates(
        filtered,
        resolveDashboardStaffingWishContext({
          weekday,
          timeFrom: row.timeFrom,
          timeTo: row.timeTo,
          areaId: planning.areaId,
          locationId: planning.locationId,
          qualificationId: slot.qualificationId,
        }),
        loadedContext.profileShiftPreferences,
        weeklyAssignedMinutes
      );

      result.set(key, sorted);
    }

    return result;
  }, [
    loadedContext,
    slots,
    row,
    planning,
    mergedProfileQualificationIds,
    weeklyAssignedMinutes,
    shiftsForWeeklyHoursValidation,
    weeklyHoursWeekDates,
  ]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setLoadedContext(null);

    void fetchDashboardStaffingCandidateContext(row.dateISO, {
      simulatedProposedOnAssign,
      relaxAppRegistrationGate,
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      const next: LoadedContext = {
        employees: result.employees,
        profileQualificationIds: result.profileQualificationIds,
        profileShiftPreferences: result.profileShiftPreferences,
        countryCode: result.countryCode,
        timeZone: result.timeZone,
        organizationWeekShifts: organizationWeekShiftsToPlanningShifts(
          result.organizationWeekShifts ?? []
        ),
        locations: result.locations,
      };
      setLoadedContext(next);
    });

    return () => {
      cancelled = true;
    };
  }, [row.dateISO, simulatedProposedOnAssign, relaxAppRegistrationGate]);

  const resolveAreaShiftTemplateId = useCallback(() => {
    if (planning.simplePlanning) return null;
    const presetId = resolvePresetShiftTemplateForDemandTimes(
      row.timeFrom,
      row.timeTo,
      assignmentPresets
    );
    return areaShiftTemplateIdForAssign(presetId);
  }, [planning.simplePlanning, row.timeFrom, row.timeTo, assignmentPresets]);

  const handleAssign = useCallback(
    async (employeeId: string) => {
      if (planning.readOnlyWeek || pendingEmployeeId) return;

      setAssignError(null);
      setPendingEmployeeId(employeeId);

      const result = await assignShiftWithTimes({
        employeeId,
        shiftDate: row.dateISO,
        startTime: row.timeFrom,
        endTime: row.timeTo,
        areaShiftTemplateId: resolveAreaShiftTemplateId(),
        locationId: planning.locationId,
        locationAreaId: planning.simplePlanning ? null : planning.areaId,
        weekDates: weeklyHoursWeekDates,
        simulatedProposedOnAssign,
        relaxAppRegistrationGate,
      });

      setPendingEmployeeId(null);

      if (!result.ok) {
        setAssignError(translateActionError(result.error, t));
        return;
      }

      onClose();
      router.refresh();
    },
    [
      planning,
      pendingEmployeeId,
      row,
      resolveAreaShiftTemplateId,
      weeklyHoursWeekDates,
      simulatedProposedOnAssign,
      relaxAppRegistrationGate,
      onClose,
      router,
      t,
    ]
  );

  const contextLine = useMemo(() => {
    const { label: dateLabel } = formatDayHeader(row.dateISO, intlLocale, "long");
    const timeLabel = areAreaCalendarShiftTimesComplete(row.timeFrom, row.timeTo)
      ? planning.formatCalendarTimeLabel(row.timeFrom, row.timeTo)
      : null;
    return [
      planning.areaName,
      row.weekdayLabel,
      dateLabel,
      timeLabel,
      row.shiftName,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · ");
  }, [
    planning.areaName,
    planning.formatCalendarTimeLabel,
    row.dateISO,
    row.weekdayLabel,
    row.shiftName,
    row.timeFrom,
    row.timeTo,
    intlLocale,
  ]);

  const showUnderstaffedCounts = row.status === "understaffed";

  const candidateGroups = useMemo(() => {
    const groups: {
      slotKey: string;
      qualificationName: string;
      candidates: { id: string; full_name: string }[];
    }[] = [];

    for (const slot of slots) {
      const key = slot.qualificationId ?? "__headcount__";
      const candidates = slotCandidates.get(key) ?? [];
      if (candidates.length === 0) continue;
      groups.push({
        slotKey: key,
        qualificationName: slot.qualificationName,
        candidates,
      });
    }

    return groups;
  }, [slots, slotCandidates]);

  const hasCandidates = candidateGroups.length > 0;

  const emptySlots = useMemo(
    () =>
      slots.filter((slot) => {
        const key = slot.qualificationId ?? "__headcount__";
        return (slotCandidates.get(key) ?? []).length === 0;
      }),
    [slots, slotCandidates]
  );

  const assignDisabled = planning.readOnlyWeek || pendingEmployeeId !== null;

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={settingsFixedNestedOverlayClass()}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-staffing-candidates-title"
        className={settingsNestedModalDialogClass("2xl", DASHBOARD_MODAL_ROUNDED_CLASS)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SettingsModalHeader
          titleId="dashboard-staffing-candidates-title"
          onClose={onClose}
          closeDisabled={assignDisabled}
          closeAriaLabel={t("common.close")}
        >
          <div className="space-y-2">
              <p className="text-sm font-semibold leading-snug text-foreground">
                {contextLine}
              </p>
              <div
                className={cn(
                  "space-y-1 border border-border/60 bg-background/55 px-3 py-2 text-sm leading-snug text-foreground shadow-sm",
                  DASHBOARD_PANEL_ROUNDED_CLASS
                )}
              >
                <p>
                  <span className="font-medium">
                    {t("dashboard.staffingCandidatesProblemUnderstaffed")}
                  </span>
                  {showUnderstaffedCounts ? (
                    <span className="tabular-nums text-red-600">
                      {" "}
                      ({row.assigned}/{row.required})
                    </span>
                  ) : null}
                </p>
                {slots.length === 0 ? (
                  <StaffingCandidateMissingLine
                    count={Math.max(0, row.required - row.assigned)}
                    qualification={t(
                      "dashboard.staffingCandidatesHeadcountSection"
                    )}
                    t={t}
                  />
                ) : (
                  slots.map((slot) => (
                    <StaffingCandidateMissingLine
                      key={slot.qualificationId ?? "__headcount__"}
                      count={slot.missingCount}
                      qualification={slot.qualificationName}
                      t={t}
                    />
                  ))
                )}
              </div>
              <div className="flex items-baseline gap-2 border-l-[3px] border-[var(--brand-neon-cyan)] pl-3">
                <p
                  id="dashboard-staffing-candidates-title"
                  className="text-base font-semibold tracking-tight text-foreground"
                >
                  {t("dashboard.staffingCandidatesSuggestionTitle")}
                </p>
                <p className="text-xs font-normal text-muted">
                  {t("dashboard.staffingCandidatesSuggestionHint")}
                </p>
              </div>
            </div>
        </SettingsModalHeader>

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            settingsModalBodyPaddingClass()
          )}
        >
          {planning.readOnlyWeek ? (
            <Alert variant="info" className="mb-3">
              {t("dashboard.readOnlyWeek")}
            </Alert>
          ) : null}

          {loadError ? (
            <Alert variant="error" className="mb-3">
              {loadError}
            </Alert>
          ) : null}

          {assignError ? (
            <Alert variant="error" className="mb-3">
              {assignError}
            </Alert>
          ) : null}

          {!loadedContext && !loadError ? (
            <p className="text-sm text-muted">
              {t("dashboard.staffingCandidatesLoading")}
            </p>
          ) : null}

          {loadedContext ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              {hasCandidates ? (
                <CandidateList
                  groups={candidateGroups}
                  assignDisabled={assignDisabled}
                  pendingEmployeeId={pendingEmployeeId}
                  onAssign={handleAssign}
                  dateISO={row.dateISO}
                  qualifications={planning.qualifications}
                  weeklyHoursLabelByEmployeeId={weeklyHoursLabelByEmployeeId}
                  weeklyHoursDisplayByEmployeeId={weeklyHoursDisplayByEmployeeId}
                  weeklyAssignedMinutesByEmployeeId={weeklyAssignedMinutes}
                  weeklyHoursTargetByEmployeeId={weeklyHoursTargetByEmployeeId}
                  employeeColorById={employeeColorById}
                  t={t}
                />
              ) : null}

              {emptySlots.map((slot) => (
                <div
                  key={slot.qualificationId ?? "__headcount__"}
                  className={cn("border border-border/70 bg-background/40 px-3 py-2", DASHBOARD_PANEL_ROUNDED_CLASS)}
                >
                  <p className="text-xs text-muted">
                    {t("dashboard.staffingCandidatesEmpty", {
                      qualification: slot.qualificationName,
                    })}
                  </p>
                  <Link
                    href={planning.areaCalendarHref}
                    className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    {t("dashboard.staffingCandidatesOpenCalendar")}
                  </Link>
                </div>
              ))}

              {slots.length === 0 ? (
                <p className="text-sm text-muted">
                  {t("dashboard.staffingCandidatesNoOpenSlots")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={settingsModalFooterClass()}>
          <Button
            type="button"
            variant="outline"
            className={DASHBOARD_UI_BUTTON_CLASS}
            onClick={onClose}
          >
            <CloseIcon />
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

type TooltipCacheEntry =
  | { status: "loading" }
  | { status: "loaded"; data: DashboardStaffingCandidateEmployeeTooltipPayload }
  | { status: "error" };

const CANDIDATE_EMPLOYEE_STRIP_WIDTH_PX = 3;

const EMPLOYEE_COLOR_FALLBACK = "#94a3b8";

const CANDIDATE_ASSIGN_HIGHLIGHT_BUTTON_CLASS = cn(
  "border border-[color-mix(in_srgb,var(--brand-neon-cyan)_45%,rgb(20_60_90))]",
  "bg-[color-mix(in_srgb,var(--brand-neon-cyan)_62%,rgb(24_72_108))]",
  "text-white hover:bg-[color-mix(in_srgb,var(--brand-neon-cyan)_70%,rgb(28_80_118))]"
);

function StaffingCandidateMissingLine({
  count,
  qualification,
  t,
}: {
  count: number;
  qualification: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <p className="text-foreground/85">
      {t("dashboard.staffingCandidatesProblemMissingLabel")}{" "}
      <span className="font-medium tabular-nums text-red-600">{count}x</span>{" "}
      {qualification}
    </p>
  );
}

function weeklyHoursLineClassName(
  assignedMinutes: number,
  targetHours: number
): string {
  const targetMinutes = targetHours * 60;
  if (targetMinutes <= 0) return "text-muted-foreground";
  if (assignedMinutes / targetMinutes >= 0.9) {
    return "font-medium text-amber-600";
  }
  return "text-foreground/75";
}

type CandidateGroup = {
  slotKey: string;
  qualificationName: string;
  candidates: readonly { id: string; full_name: string }[];
};

function CandidateList({
  groups,
  assignDisabled,
  pendingEmployeeId,
  onAssign,
  dateISO,
  qualifications,
  weeklyHoursLabelByEmployeeId,
  weeklyHoursDisplayByEmployeeId,
  weeklyAssignedMinutesByEmployeeId,
  weeklyHoursTargetByEmployeeId,
  employeeColorById,
  t,
}: {
  groups: readonly CandidateGroup[];
  assignDisabled: boolean;
  pendingEmployeeId: string | null;
  onAssign: (employeeId: string) => void;
  dateISO: string;
  qualifications: readonly Qualification[];
  weeklyHoursLabelByEmployeeId: ReadonlyMap<string, readonly string[]>;
  weeklyHoursDisplayByEmployeeId: ReadonlyMap<string, EmployeeWeeklyHoursDisplay>;
  weeklyAssignedMinutesByEmployeeId: ReadonlyMap<string, number>;
  weeklyHoursTargetByEmployeeId: ReadonlyMap<string, number>;
  employeeColorById: ReadonlyMap<string, string | null>;
  t: ReturnType<typeof useTranslations>;
}) {
  const [tooltipCache, setTooltipCache] = useState<
    Record<string, TooltipCacheEntry>
  >({});
  const tooltipFetchStartedRef = useRef(new Set<string>());

  const ensureTooltipLoaded = useCallback(
    (employeeId: string) => {
      if (tooltipFetchStartedRef.current.has(employeeId)) return;
      tooltipFetchStartedRef.current.add(employeeId);

      setTooltipCache((previous) => ({
        ...previous,
        [employeeId]: { status: "loading" },
      }));

      void fetchDashboardStaffingCandidateEmployeeTooltip(
        employeeId,
        dateISO
      ).then((result) => {
        setTooltipCache((current) => ({
          ...current,
          [employeeId]: result.ok
            ? { status: "loaded", data: result.data }
            : { status: "error" },
        }));
      });
    },
    [dateISO]
  );

  return (
    <section
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden border border-border/50 bg-background/20",
        DASHBOARD_PANEL_ROUNDED_CLASS,
        MODAL_SCROLLBAR_CLASS
      )}
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {groups.map((group) => (
          <div key={group.slotKey} className="overflow-hidden border border-border/40">
            <p className="bg-[#c7d4e5] px-2.5 py-1.5 text-sm font-semibold leading-tight text-[#273b55]">
              {group.qualificationName}
            </p>
            <ul className="flex flex-col gap-0.5" role="list">
              {group.candidates.map((candidate, candidateIndex) => {
                const cacheEntry = tooltipCache[candidate.id];
                const isTopPick = candidateIndex === 0;
                const weeklyHoursLabel =
                  weeklyHoursLabelByEmployeeId.get(candidate.id) ?? [];
                const weeklyHoursDisplay =
                  weeklyHoursDisplayByEmployeeId.get(candidate.id) ?? null;
                const assignedMinutes =
                  weeklyAssignedMinutesByEmployeeId.get(candidate.id) ?? 0;
                const targetHours =
                  weeklyHoursTargetByEmployeeId.get(candidate.id) ?? 40;
                const employeeColor =
                  employeeColorById.get(candidate.id) ?? EMPLOYEE_COLOR_FALLBACK;

                return (
                  <li key={`${group.slotKey}:${candidate.id}`}>
                    <div
                      className={cn(
                        "group relative flex min-h-[2.75rem] items-stretch overflow-hidden bg-white/80 transition-colors",
                        isTopPick &&
                          "bg-[color-mix(in_srgb,var(--brand-neon-cyan)_6%,white)]"
                      )}
                    >
                      <div
                        className="shrink-0 self-stretch"
                        style={{
                          width: CANDIDATE_EMPLOYEE_STRIP_WIDTH_PX,
                          backgroundColor: employeeColor,
                        }}
                        aria-hidden
                      />
                      <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Tooltip
                              openDelayMs={
                                DASHBOARD_STAFFING_CANDIDATE_TOOLTIP_OPEN_DELAY_MS
                              }
                              placement={employeeAvailabilityTooltipPlacement}
                              contentClassName={
                                employeeAvailabilityTooltipContentClassName
                              }
                              className="max-w-full min-w-0 cursor-default justify-start"
                              content={
                                <DashboardStaffingCandidateEmployeeTooltipContent
                                  employeeName={candidate.full_name}
                                  payload={
                                    cacheEntry?.status === "loaded"
                                      ? cacheEntry.data
                                      : null
                                  }
                                  loading={
                                    !cacheEntry ||
                                    cacheEntry.status === "loading"
                                  }
                                  error={cacheEntry?.status === "error"}
                                  qualifications={qualifications}
                                  weeklyHoursDisplay={weeklyHoursDisplay}
                                />
                              }
                            >
                              <span
                                data-employee-availability-tooltip-anchor=""
                                className="block min-w-0 cursor-default truncate text-left text-sm font-medium leading-tight text-foreground/90"
                                onMouseEnter={() =>
                                  ensureTooltipLoaded(candidate.id)
                                }
                                onFocus={() =>
                                  ensureTooltipLoaded(candidate.id)
                                }
                              >
                                {candidate.full_name}
                              </span>
                            </Tooltip>
                          </div>
                          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                            {weeklyHoursLabel.length > 0 ? (
                              <EmployeeWeeklyHoursLines
                                lines={weeklyHoursLabel}
                                className="text-[0.6875rem] text-muted-foreground"
                                lineClassName={weeklyHoursLineClassName(
                                  assignedMinutes,
                                  targetHours
                                )}
                              />
                            ) : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isTopPick ? "default" : "outline"}
                          className={cn(
                            DASHBOARD_UI_BUTTON_CLASS,
                            "shrink-0 px-2.5 text-xs leading-none",
                            isTopPick && CANDIDATE_ASSIGN_HIGHLIGHT_BUTTON_CLASS
                          )}
                          disabled={
                            assignDisabled || pendingEmployeeId === candidate.id
                          }
                          onClick={() => onAssign(candidate.id)}
                        >
                          {pendingEmployeeId === candidate.id
                            ? t("common.saving")
                            : t("dashboard.staffingCandidatesAssign")}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
