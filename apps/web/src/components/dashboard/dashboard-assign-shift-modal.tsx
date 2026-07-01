"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAreaCalendarBulkShiftContext } from "@/app/actions/areacalendar-shift-assign";
import {
  ADD_SHIFT_AVAILABILITY_NOTICE_CLASS,
  AreaCalendarQualificationCombobox,
  AreaCalendarShiftEmployeeCombobox,
  AreaCalendarShiftTypeCombobox,
  DASHBOARD_COMBO_EMPTY_LABEL,
} from "@/components/areacalendar/areacalendar-add-shift-modal";
import {
  PlanningSidePanel,
  PlanningSidePanelNestedAlertPortal,
  PLANNING_SIDE_PANEL_FOOTER_CLASS,
} from "@/components/planning/planning-side-panel";
import {
  areaCalendarAlertDialogClass,
  areaCalendarNestedModalOverlayClass,
  settingsModalFooterClass,
  SettingsConfirmDialogCloseHeader,
} from "@/components/settings/settings-list-ui";
import {
  Alert,
  Button,
  Checkbox,
  LabelMuted,
  Textarea,
  TimeInput,
} from "@/components/ui";
import { translateActionError } from "@/lib/translate-action-error";
import { DASHBOARD_UI_BUTTON_CLASS } from "@/lib/dashboard-toolbar-ui";
import { useSimulatedProposedOnAssignRequest } from "@/lib/shift-confirmation-simulation-context";
import { cn } from "@/lib/cn";
import {
  filterPlanningAssignShiftEmployees,
  profileAvailabilitiesForWeekday,
  profileAvailabilityWeekdayFromAreaCalendarDate,
} from "@/lib/available-employees-for-shift";
import { assignmentWindowsFromShiftRefsForDate, locationDayAssignmentsFromShiftRefsForDate } from "@/lib/shift-overlap";
import { filterEmployeesByOrganizationDayShiftCompliance } from "@/lib/bulk-shift-day-compliance";
import { DEFAULT_ORGANIZATION_TIME_ZONE } from "@/lib/dates";
import type { EmployeeWeeklyHoursDisplay } from "@/lib/employee-weekly-hours-display";
import {
  areaStaffingQualificationOptions,
  presetQualificationForServiceHour,
} from "@/lib/bulk-shift-qualification";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import {
  formatDayHeader,
} from "@/lib/planning-utils";
import { findServiceHourIdForShift } from "@/lib/location-staffing-client";
import { validateAreaCalendarShiftServiceHours } from "@/lib/service-hours-shift-validation";
import { hasRemainingAssignableWeekDates } from "@/lib/shift-assign-rest-of-week";
import {
  evaluateShiftAssignAvailabilityConflict,
  isShiftAssignAvailabilityConflictError,
  useShiftAssignAvailabilityNotice,
} from "@/lib/shift-assign-availability-notice";
import { isShiftAssignWeeklyHoursExceededError } from "@/lib/shift-assign-blocking-errors";
import { staffingQualificationIdsForServiceHour } from "@schichtwerk/database";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { LocationAreaStaffing, Qualification } from "@schichtwerk/types";
import type { AreaCalendarShiftAssignEmployee } from "@/app/actions/areacalendar-shift-assign";
import type { ShiftAssignWeekShiftRef } from "@/lib/shift-weekly-hours-validation-client";

export type DashboardShiftActionResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; error: string };

type MessagePrompt = {
  kind: "error" | "info";
  message: string;
  closeAssignModalOnDismiss?: boolean;
  blocking?: boolean;
};

export type DashboardAssignPresetEmployee = Pick<
  AreaCalendarShiftAssignEmployee,
  "id" | "full_name" | "color"
>;

function planningAssignPresetEmployeeStub(
  preset: DashboardAssignPresetEmployee
): AreaCalendarShiftAssignEmployee {
  return {
    id: preset.id,
    full_name: preset.full_name,
    color: preset.color,
    weekly_hours: null,
    last_shift_date: null,
    availabilities: [],
  };
}

type Props = {
  date: string;
  areaName: string;
  areaId: string | null;
  intlLocale: string;
  t: (key: string) => string;
  simplePlanning: boolean;
  assignmentPresets: AreaCalendarAssignmentPreset[];
  selectedPresetId: string;
  onPresetChange: (presetId: string) => void;
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  selectedEmployeeId: string;
  onEmployeeChange: (employeeId: string) => void;
  qualificationId: string;
  onQualificationChange: (qualificationId: string) => void;
  qualificationManuallySelected: boolean;
  onQualificationManuallySelectedChange: (value: boolean) => void;
  staffingRules: LocationAreaStaffing[];
  serviceHours: AreaServiceHourRef[];
  qualifications: Qualification[];
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>;
  note: string;
  onNoteChange: (value: string) => void;
  dayReadOnly: boolean;
  withoutServiceHours?: boolean;
  timesComplete: boolean;
  canAssign: boolean;
  hasExistingShift: boolean;
  editingShiftId?: string | null;
  weekDates: readonly string[];
  weekShifts?: readonly ShiftAssignWeekShiftRef[];
  organizationWeekShifts?: readonly ShiftAssignWeekShiftRef[];
  timeZone?: string;
  weeklyHoursDisplayByEmployeeId?: ReadonlyMap<string, EmployeeWeeklyHoursDisplay>;
  onAssign: (
    options?: {
      withoutServiceHours?: boolean;
      assignToRemainingWeekDays?: boolean;
    }
  ) => Promise<DashboardShiftActionResult>;
  onClose: () => void;
  /** Mitarbeiter aus Dashboard-Zelle (Kontextmenü / Klick) — bis Qualifikation geladen ist behalten. */
  presetEmployeeId?: string;
  /** Profil aus Dashboard-Grid für Anzeige, falls Server-Liste noch lädt oder filtert. */
  presetEmployee?: DashboardAssignPresetEmployee;
};

export function DashboardAssignShiftModal({
  date,
  areaName,
  areaId,
  intlLocale,
  t,
  simplePlanning,
  assignmentPresets,
  selectedPresetId,
  onPresetChange,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  selectedEmployeeId,
  onEmployeeChange,
  qualificationId,
  onQualificationChange,
  qualificationManuallySelected,
  onQualificationManuallySelectedChange,
  staffingRules,
  serviceHours,
  qualifications,
  profileQualificationIds,
  note,
  onNoteChange,
  dayReadOnly,
  withoutServiceHours = false,
  timesComplete,
  canAssign,
  hasExistingShift,
  editingShiftId = null,
  weekDates,
  weekShifts = [],
  organizationWeekShifts = [],
  timeZone = DEFAULT_ORGANIZATION_TIME_ZONE,
  weeklyHoursDisplayByEmployeeId,
  onAssign,
  onClose,
  presetEmployeeId,
  presetEmployee,
}: Props) {
  const { simulatedProposedOnAssign, relaxAppRegistrationGate } =
    useSimulatedProposedOnAssignRequest();
  const [employees, setEmployees] = useState<AreaCalendarShiftAssignEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [countryCode, setCountryCode] = useState("DE");
  const [saving, setSaving] = useState(false);
  const [messagePrompt, setMessagePrompt] = useState<MessagePrompt | null>(null);
  const [outsideServiceHoursConfirm, setOutsideServiceHoursConfirm] =
    useState(false);
  const [assignRestOfWeekDays, setAssignRestOfWeekDays] = useState(false);
  const skipQualificationSyncRef = useRef(false);

  const showAssignRestOfWeekDaysOption =
    !simplePlanning &&
    !hasExistingShift &&
    hasRemainingAssignableWeekDates(date, weekDates);

  const weekday = profileAvailabilityWeekdayFromAreaCalendarDate(date);
  const dayHeader = formatDayHeader(date, intlLocale);

  const areaQualifications = useMemo(
    () =>
      areaId
        ? areaStaffingQualificationOptions(staffingRules, areaId, qualifications)
        : [],
    [areaId, staffingRules, qualifications]
  );
  const qualificationNameById = useMemo(
    () => new Map(qualifications.map((qualification) => [qualification.id, qualification.name])),
    [qualifications]
  );
  const qualificationSortOrder = useMemo(
    () =>
      new Map(
        qualifications.map((qualification) => [
          qualification.id,
          qualification.sort_order,
        ])
      ),
    [qualifications]
  );

  const demandServiceHourId = useMemo(() => {
    if (simplePlanning || !areaId || !timesComplete) return null;
    return findServiceHourIdForShift(
      serviceHours,
      areaId,
      date,
      startTime,
      endTime
    );
  }, [simplePlanning, areaId, timesComplete, serviceHours, date, startTime, endTime]);

  const qualificationOptions = useMemo(() => {
    if (simplePlanning) return [];
    if (!demandServiceHourId || !areaId) return areaQualifications;
    const demandIds = staffingQualificationIdsForServiceHour(
      staffingRules,
      areaId,
      demandServiceHourId
    );
    if (demandIds.size === 0) return areaQualifications;
    return areaQualifications.filter((option) => demandIds.has(option.id));
  }, [
    simplePlanning,
    demandServiceHourId,
    areaId,
    staffingRules,
    areaQualifications,
  ]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !saving &&
        !messagePrompt &&
        !outsideServiceHoursConfirm
      ) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving, messagePrompt, outsideServiceHoursConfirm]);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      setLoadingEmployees(true);
      const result = await fetchAreaCalendarBulkShiftContext(date, {
        simulatedProposedOnAssign,
        relaxAppRegistrationGate,
      });
      if (cancelled) return;
      if (!result.ok) {
        setMessagePrompt({
          kind: "error",
          message: translateActionError(result.error, t),
        });
        setEmployees([]);
      } else {
        setEmployees(result.employees);
        setCountryCode(result.countryCode);
      }
      setLoadingEmployees(false);
    }

    void loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [date, relaxAppRegistrationGate, simulatedProposedOnAssign, t]);

  useEffect(() => {
    if (skipQualificationSyncRef.current) {
      skipQualificationSyncRef.current = false;
      return;
    }
    if (qualificationManuallySelected || simplePlanning || !areaId) return;

    const presetQualification = presetQualificationForServiceHour(
      staffingRules,
      areaId,
      demandServiceHourId
    );
    if (presetQualification && presetQualification !== qualificationId) {
      onQualificationChange(presetQualification);
      return;
    }

    if (
      qualificationOptions.length === 1 &&
      qualificationOptions[0]!.id !== qualificationId
    ) {
      onQualificationChange(qualificationOptions[0]!.id);
    }
  }, [
    qualificationManuallySelected,
    simplePlanning,
    areaId,
    demandServiceHourId,
    staffingRules,
    qualificationOptions,
    qualificationId,
    onQualificationChange,
  ]);

  const organizationDayOverlapAssignments = useMemo(() => {
    const shiftsForOverlap =
      organizationWeekShifts.length > 0 ? organizationWeekShifts : weekShifts;
    return assignmentWindowsFromShiftRefsForDate(shiftsForOverlap, date, {
      excludeShiftIds: editingShiftId
        ? new Set([editingShiftId])
        : undefined,
    });
  }, [organizationWeekShifts, weekShifts, date, editingShiftId]);

  const organizationDayAssignments = useMemo(
    () =>
      locationDayAssignmentsFromShiftRefsForDate(
        organizationWeekShifts.length > 0 ? organizationWeekShifts : weekShifts,
        date,
        {
          excludeShiftIds: editingShiftId
            ? new Set([editingShiftId])
            : undefined,
        }
      ),
    [organizationWeekShifts, weekShifts, date, editingShiftId]
  );

  const matchingEmployees = useMemo(
    () => {
      const byPlanning = filterPlanningAssignShiftEmployees(
        employees,
        weekday,
        startTime,
        endTime,
        {
          simplePlanning,
          qualificationId,
          profileQualificationIds,
          shiftDate: date,
          organizationDayAssignments: organizationDayOverlapAssignments,
          timeZone,
        }
      );
      return filterEmployeesByOrganizationDayShiftCompliance(byPlanning, {
        countryCode,
        shiftDate: date,
        windowStart: startTime,
        windowEnd: endTime,
        organizationDayAssignments,
      });
    },
    [
      employees,
      weekday,
      startTime,
      endTime,
      simplePlanning,
      qualificationId,
      profileQualificationIds,
      date,
      organizationDayOverlapAssignments,
      organizationDayAssignments,
      timeZone,
      countryCode,
    ]
  );

  const availabilityNotice = useShiftAssignAvailabilityNotice({
    weekday,
    startTime,
    endTime,
    employeeId: selectedEmployeeId,
    employees,
    loadingEmployees,
    assignmentPresets,
    shiftTypeId: selectedPresetId,
    timesComplete,
  });

  const showAvailabilityConflictFeedback = useCallback(
    (message: string) => {
      availabilityNotice.runAvailabilityCheck();
      setMessagePrompt({ kind: "error", message });
    },
    [availabilityNotice]
  );

  const matchingEmployeeIdsKey = useMemo(
    () => matchingEmployees.map((employee) => employee.id).join("\0"),
    [matchingEmployees]
  );

  const presetEmployeeStub = useMemo(
    () =>
      presetEmployee ? planningAssignPresetEmployeeStub(presetEmployee) : null,
    [presetEmployee]
  );

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return (
      employees.find((employee) => employee.id === selectedEmployeeId) ??
      (presetEmployeeStub?.id === selectedEmployeeId ? presetEmployeeStub : null)
    );
  }, [employees, selectedEmployeeId, presetEmployeeStub]);

  const employeesForCombobox = useMemo(() => {
    const employeeForSelection =
      selectedEmployee ??
      (presetEmployeeId &&
      selectedEmployeeId === presetEmployeeId &&
      presetEmployeeStub
        ? presetEmployeeStub
        : null);

    const shouldIncludeSelected =
      selectedEmployeeId &&
      employeeForSelection &&
      !matchingEmployees.some((employee) => employee.id === selectedEmployeeId);

    if (
      shouldIncludeSelected &&
      (hasExistingShift ||
        (presetEmployeeId && selectedEmployeeId === presetEmployeeId))
    ) {
      return [employeeForSelection, ...matchingEmployees];
    }
    return matchingEmployees;
  }, [
    hasExistingShift,
    presetEmployeeId,
    matchingEmployees,
    presetEmployeeStub,
    selectedEmployee,
    selectedEmployeeId,
  ]);

  const weeklyHoursDisplayByEmployeeIdResolved = weeklyHoursDisplayByEmployeeId;

  useEffect(() => {
    if (loadingEmployees || hasExistingShift) return;
    if (!timesComplete) {
      if (selectedEmployeeId) onEmployeeChange("");
      return;
    }
    if (!simplePlanning && !qualificationId) {
      if (
        presetEmployeeId &&
        selectedEmployeeId === presetEmployeeId
      ) {
        return;
      }
      if (selectedEmployeeId) onEmployeeChange("");
      return;
    }
    if (
      selectedEmployeeId &&
      !matchingEmployees.some((employee) => employee.id === selectedEmployeeId)
    ) {
      if (presetEmployeeId && selectedEmployeeId === presetEmployeeId) {
        return;
      }
      onEmployeeChange("");
    }
  }, [
    loadingEmployees,
    hasExistingShift,
    timesComplete,
    simplePlanning,
    qualificationId,
    selectedEmployeeId,
    matchingEmployeeIdsKey,
    matchingEmployees,
    onEmployeeChange,
    presetEmployeeId,
  ]);

  const dayAvailabilities = useMemo(() => {
    if (!selectedEmployee) return [];
    return profileAvailabilitiesForWeekday(
      selectedEmployee.availabilities,
      weekday
    );
  }, [selectedEmployee, weekday]);

  const handleEmployeeChange = useCallback(
    (nextId: string) => {
      onEmployeeChange(nextId);
      availabilityNotice.notifyEmployeeChange(nextId);
    },
    [onEmployeeChange, availabilityNotice]
  );

  const handlePresetChange = useCallback(
    (presetId: string) => {
      const preset = assignmentPresets.find((item) => item.id === presetId);
      onPresetChange(presetId);
      if (preset) {
        availabilityNotice.notifyShiftTemplateChange(
          preset.start_time.slice(0, 5),
          preset.end_time.slice(0, 5)
        );
      }
    },
    [assignmentPresets, onPresetChange, availabilityNotice]
  );

  const handleQualificationChange = useCallback(
    (nextId: string) => {
      skipQualificationSyncRef.current = true;
      onQualificationManuallySelectedChange(true);
      onQualificationChange(nextId);
    },
    [onQualificationChange, onQualificationManuallySelectedChange]
  );

  const handleApplyAvailability = useCallback(
    (entry: { start_time: string; end_time: string }) => {
      availabilityNotice.beforeTimeInputChange();
      onStartTimeChange(entry.start_time.slice(0, 5));
      onEndTimeChange(entry.end_time.slice(0, 5));
    },
    [onStartTimeChange, onEndTimeChange, availabilityNotice]
  );

  const dismissMessagePrompt = useCallback(() => {
    let shouldCloseAssignModal = false;
    setMessagePrompt((current) => {
      shouldCloseAssignModal = Boolean(current?.closeAssignModalOnDismiss);
      return null;
    });
    if (shouldCloseAssignModal) {
      queueMicrotask(onClose);
    }
  }, [onClose]);

  const finishAssign = useCallback(
    async (options?: {
      withoutServiceHours?: boolean;
      assignToRemainingWeekDays?: boolean;
    }) => {
      setSaving(true);
      const result = await onAssign({
        ...options,
        assignToRemainingWeekDays:
          options?.assignToRemainingWeekDays ?? assignRestOfWeekDays,
      });
      setSaving(false);

      if (!result.ok) {
        if (
          isShiftAssignAvailabilityConflictError(result.error) ||
          result.error === t("shiftAssign.shiftOutsideAvailability") ||
          result.error === t("shiftAssign.noWeekdayAvailability") ||
          result.error === t("areaCalendar.shiftOutsideEmployeeAvailability")
        ) {
          availabilityNotice.runAvailabilityCheck();
        }
        setMessagePrompt({
          kind: "error",
          message: result.error,
          blocking: isShiftAssignWeeklyHoursExceededError(result.error),
        });
        return;
      }

      if (result.warnings?.length) {
        setMessagePrompt({
          kind: "info",
          message: result.warnings.join(" "),
          closeAssignModalOnDismiss: true,
        });
        return;
      }

      queueMicrotask(onClose);
    },
    [assignRestOfWeekDays, onAssign, onClose, availabilityNotice, t]
  );

  const handleOk = useCallback(() => {
    if (!selectedEmployeeId || !timesComplete || dayReadOnly || saving) return;

    if (
      evaluateShiftAssignAvailabilityConflict({
        employeeId: selectedEmployeeId,
        employees,
        weekday,
        startTime,
        endTime,
      })
    ) {
      showAvailabilityConflictFeedback(
        t("areaCalendar.shiftOutsideEmployeeAvailability")
      );
      return;
    }

    if (!simplePlanning && areaId && !withoutServiceHours) {
      const serviceHoursCheck = validateAreaCalendarShiftServiceHours(
        serviceHours,
        areaId,
        date,
        startTime,
        endTime
      );
      if (!serviceHoursCheck.ok) {
        setOutsideServiceHoursConfirm(true);
        return;
      }
    }

    void finishAssign(
      withoutServiceHours ? { withoutServiceHours: true } : undefined
    );
  }, [
    selectedEmployeeId,
    timesComplete,
    dayReadOnly,
    saving,
    simplePlanning,
    areaId,
    withoutServiceHours,
    serviceHours,
    date,
    startTime,
    endTime,
    finishAssign,
    employees,
    weekday,
    showAvailabilityConflictFeedback,
    t,
  ]);

  const busy = saving || loadingEmployees;
  const subtitle = simplePlanning
    ? `${dayHeader.weekday}, ${dayHeader.label}`
    : `${areaName} · ${dayHeader.weekday}, ${dayHeader.label}`;

  return (
    <>
      <PlanningSidePanel
        title={
          hasExistingShift
            ? t("areaCalendar.editShift")
            : t("areaCalendar.addShiftTitle")
        }
        subtitle={subtitle}
        titleId="planning-assign-shift-title"
        onClose={onClose}
        closeDisabled={busy}
        closeAriaLabel={t("common.close")}
        footer={
          <div className={PLANNING_SIDE_PANEL_FOOTER_CLASS}>
            {showAssignRestOfWeekDaysOption ? (
              <label className="flex min-w-0 cursor-pointer items-start gap-2 text-sm text-foreground">
                <Checkbox
                  checked={assignRestOfWeekDays}
                  disabled={busy || dayReadOnly}
                  onChange={(event) =>
                    setAssignRestOfWeekDays(event.target.checked)
                  }
                  className="mt-0.5 shrink-0"
                />
                <span>{t("areaCalendar.assignRestOfWeekDays")}</span>
              </label>
            ) : (
              <span />
            )}
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className={DASHBOARD_UI_BUTTON_CLASS}
                disabled={busy}
                onClick={onClose}
              >
                {t("common.cancel")}
              </Button>
              {!dayReadOnly ? (
                <Button
                  type="button"
                  className={DASHBOARD_UI_BUTTON_CLASS}
                  disabled={
                    busy ||
                    !canAssign ||
                    !timesComplete ||
                    !selectedEmployeeId ||
                    loadingEmployees
                  }
                  onClick={handleOk}
                >
                  {t("common.ok")}
                </Button>
              ) : null}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {dayReadOnly ? (
            <p className="text-xs text-muted">{t("dashboard.readOnlyDay")}</p>
          ) : null}

          {!simplePlanning && assignmentPresets.length === 0 ? (
            <Alert variant="info">
              {t("areaCalendar.noShiftTemplatesForArea")}
            </Alert>
          ) : null}

          {!simplePlanning ? (
            <div>
              <LabelMuted>{t("areaCalendar.shiftTemplateLabel")}</LabelMuted>
              <AreaCalendarShiftTypeCombobox
                value={selectedPresetId}
                presets={assignmentPresets}
                placeholder={t("areaCalendar.selectShiftTemplate")}
                disabled={dayReadOnly || assignmentPresets.length === 0 || busy}
                onChange={handlePresetChange}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <LabelMuted>{t("shiftTypes.timeFrom")}</LabelMuted>
              <TimeInput
                className="mt-1"
                value={startTime}
                disabled={dayReadOnly || busy}
                onChange={(event) => {
                  availabilityNotice.beforeTimeInputChange();
                  onStartTimeChange(event.target.value);
                }}
              />
            </div>
            <div>
              <LabelMuted>{t("shiftTypes.timeTo")}</LabelMuted>
              <TimeInput
                className="mt-1"
                value={endTime}
                disabled={dayReadOnly || busy}
                onChange={(event) => {
                  availabilityNotice.beforeTimeInputChange();
                  onEndTimeChange(event.target.value);
                }}
              />
            </div>
          </div>

          {!simplePlanning ? (
            <div>
              <LabelMuted>{t("areaCalendar.bulkShiftQualification")}</LabelMuted>
              <AreaCalendarQualificationCombobox
                value={qualificationId}
                options={qualificationOptions}
                placeholder={DASHBOARD_COMBO_EMPTY_LABEL}
                disabled={
                  dayReadOnly ||
                  busy ||
                  !timesComplete ||
                  qualificationOptions.length === 0
                }
                onChange={handleQualificationChange}
              />
            </div>
          ) : null}

          <div>
            <LabelMuted>{t("common.basic")}</LabelMuted>
            <AreaCalendarShiftEmployeeCombobox
              value={selectedEmployeeId}
              onChange={handleEmployeeChange}
              employees={employeesForCombobox}
              selectedEmployee={selectedEmployee}
              weekday={weekday}
              dayAvailabilities={dayAvailabilities}
              emptyLabel={t("areaCalendar.noEmployeeSelected")}
              disabled={
                loadingEmployees ||
                busy ||
                dayReadOnly ||
                !timesComplete ||
                (!simplePlanning &&
                  !qualificationId &&
                  !hasExistingShift &&
                  !presetEmployeeId)
              }
              onApplyAvailability={handleApplyAvailability}
              weekdayLabelStyle="long"
              profileQualificationIds={profileQualificationIds}
              qualificationNameById={qualificationNameById}
              qualificationSortOrder={qualificationSortOrder}
              weeklyHoursDisplayByEmployeeId={weeklyHoursDisplayByEmployeeIdResolved}
            />
            {availabilityNotice.visible ? (
              <p className={ADD_SHIFT_AVAILABILITY_NOTICE_CLASS}>
                {t("areaCalendar.shiftOutsideEmployeeAvailability")}
              </p>
            ) : null}
          </div>

          {!simplePlanning &&
          timesComplete &&
          qualificationId &&
          !loadingEmployees &&
          matchingEmployees.length === 0 &&
          !(
            presetEmployeeId &&
            selectedEmployeeId === presetEmployeeId
          ) ? (
            <p className="text-xs text-muted">
              {t("areaCalendar.bulkShiftNoEligibleEmployees")}
            </p>
          ) : null}

          <div>
            <LabelMuted>{t("dashboard.assignNoteLabel")}</LabelMuted>
            <Textarea
              className="mt-1"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={2}
              disabled={dayReadOnly || busy}
              placeholder={t("dashboard.assignNotePlaceholder")}
            />
          </div>
        </div>
      </PlanningSidePanel>

      {messagePrompt ? (
        <PlanningSidePanelNestedAlertPortal>
        <div
          className={areaCalendarNestedModalOverlayClass()}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !busy &&
              !messagePrompt.blocking
            ) {
              dismissMessagePrompt();
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="planning-assign-shift-message"
            className={cn(areaCalendarAlertDialogClass(), "overflow-hidden p-0")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <SettingsConfirmDialogCloseHeader
              onClose={dismissMessagePrompt}
              closeDisabled={busy || messagePrompt.blocking}
              closeAriaLabel={t("common.close")}
            />
            <div className="px-4 py-4 sm:px-5">
            <p
              id="planning-assign-shift-message"
              className={cn(
                "text-sm",
                messagePrompt.kind === "error"
                  ? "text-destructive"
                  : "text-foreground"
              )}
            >
              {messagePrompt.message}
            </p>
            <div
              className={settingsModalFooterClass(
                "mt-5 border-0 px-0 pb-0 pt-0 sm:justify-end"
              )}
            >
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={dismissMessagePrompt}
              >
                {t("common.ok")}
              </Button>
            </div>
            </div>
          </div>
        </div>
        </PlanningSidePanelNestedAlertPortal>
      ) : null}

      {outsideServiceHoursConfirm ? (
        <PlanningSidePanelNestedAlertPortal>
        <div
          className={areaCalendarNestedModalOverlayClass()}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setOutsideServiceHoursConfirm(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="planning-assign-shift-service-hours-confirm"
            className={cn(areaCalendarAlertDialogClass(), "overflow-hidden p-0")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <SettingsConfirmDialogCloseHeader
              onClose={() => setOutsideServiceHoursConfirm(false)}
              closeDisabled={busy}
              closeAriaLabel={t("common.close")}
            />
            <div className="px-4 py-4 sm:px-5">
            <p
              id="planning-assign-shift-service-hours-confirm"
              className="text-sm text-foreground"
            >
              {t("areaCalendar.bulkShiftOutsideServiceHoursConfirm")}
            </p>
            <div
              className={settingsModalFooterClass(
                "mt-5 border-0 px-0 pb-0 pt-0 sm:justify-end"
              )}
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => setOutsideServiceHoursConfirm(false)}
                disabled={busy}
              >
                {t("common.no")}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={() => {
                  setOutsideServiceHoursConfirm(false);
                  void finishAssign({ withoutServiceHours: true });
                }}
              >
                {t("common.yes")}
              </Button>
            </div>
            </div>
          </div>
        </div>
        </PlanningSidePanelNestedAlertPortal>
      ) : null}
    </>
  );
}
