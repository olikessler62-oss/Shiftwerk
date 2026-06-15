"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDashboardShiftAssignEmployees } from "@/app/actions/dashboard-shift-assign";
import {
  DashboardQualificationCombobox,
  DashboardShiftEmployeeCombobox,
  DashboardShiftTypeCombobox,
  DASHBOARD_COMBO_EMPTY_LABEL,
} from "@/components/dashboard/dashboard-add-shift-modal";
import {
  MODAL_SCROLLBAR_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  dashboardAlertDialogClass,
  dashboardNestedModalOverlayClass,
  settingsModalFooterClass,
} from "@/components/settings/settings-list-ui";
import {
  Alert,
  Button,
  CloseIcon,
  IconButton,
  LabelMuted,
  Textarea,
  TimeInput,
} from "@/components/ui";
import { translateActionError } from "@/lib/translate-action-error";
import { cn } from "@/lib/cn";
import {
  filterPlanningAssignShiftEmployees,
  profileAvailabilitiesForWeekday,
  profileAvailabilityWeekdayFromDashboardDate,
} from "@/lib/available-employees-for-shift";
import {
  areaStaffingQualificationOptions,
  presetQualificationForServiceHour,
} from "@/lib/bulk-shift-qualification";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import { formatDayHeader } from "@/lib/planning-utils";
import { findServiceHourIdForShift } from "@/lib/location-staffing-client";
import { validateDashboardShiftServiceHours } from "@/lib/service-hours-shift-validation";
import { staffingQualificationIdsForServiceHour } from "@schichtwerk/database";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { LocationAreaStaffing, Qualification } from "@schichtwerk/types";
import type { DashboardShiftAssignEmployee } from "@/app/actions/dashboard-shift-assign";

export type PlanningShiftActionResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; error: string };

type MessagePrompt = {
  kind: "error" | "info";
  message: string;
  closeAssignModalOnDismiss?: boolean;
};

type Props = {
  date: string;
  areaName: string;
  areaId: string | null;
  intlLocale: string;
  t: (key: string) => string;
  simplePlanning: boolean;
  assignmentPresets: DashboardAssignmentPreset[];
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
  timesComplete: boolean;
  canAssign: boolean;
  hasExistingShift: boolean;
  onAssign: (
    options?: { withoutServiceHours?: boolean }
  ) => Promise<PlanningShiftActionResult>;
  onRemove: () => Promise<PlanningShiftActionResult>;
  onClose: () => void;
};

export function PlanningAssignShiftModal({
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
  timesComplete,
  canAssign,
  hasExistingShift,
  onAssign,
  onRemove,
  onClose,
}: Props) {
  const [employees, setEmployees] = useState<DashboardShiftAssignEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messagePrompt, setMessagePrompt] = useState<MessagePrompt | null>(null);
  const [outsideServiceHoursConfirm, setOutsideServiceHoursConfirm] =
    useState(false);
  const skipQualificationSyncRef = useRef(false);

  const weekday = profileAvailabilityWeekdayFromDashboardDate(date);
  const dayHeader = formatDayHeader(date, intlLocale);

  const areaQualifications = useMemo(
    () =>
      areaId
        ? areaStaffingQualificationOptions(staffingRules, areaId, qualifications)
        : [],
    [areaId, staffingRules, qualifications]
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
      const result = await fetchDashboardShiftAssignEmployees(date);
      if (cancelled) return;
      if (!result.ok) {
        setMessagePrompt({
          kind: "error",
          message: translateActionError(result.error, t),
        });
        setEmployees([]);
      } else {
        setEmployees(result.employees);
      }
      setLoadingEmployees(false);
    }

    void loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [date, t]);

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

  const matchingEmployees = useMemo(
    () =>
      filterPlanningAssignShiftEmployees(
        employees,
        weekday,
        startTime,
        endTime,
        {
          simplePlanning,
          qualificationId,
          profileQualificationIds,
        }
      ),
    [
      employees,
      weekday,
      startTime,
      endTime,
      simplePlanning,
      qualificationId,
      profileQualificationIds,
    ]
  );

  const matchingEmployeeIdsKey = useMemo(
    () => matchingEmployees.map((employee) => employee.id).join("\0"),
    [matchingEmployees]
  );

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  );

  const employeesForCombobox = useMemo(() => {
    if (
      !hasExistingShift ||
      !selectedEmployeeId ||
      !selectedEmployee ||
      matchingEmployees.some((employee) => employee.id === selectedEmployeeId)
    ) {
      return matchingEmployees;
    }
    return [selectedEmployee, ...matchingEmployees];
  }, [
    hasExistingShift,
    matchingEmployees,
    selectedEmployee,
    selectedEmployeeId,
  ]);

  useEffect(() => {
    if (loadingEmployees || hasExistingShift) return;
    if (!timesComplete) {
      if (selectedEmployeeId) onEmployeeChange("");
      return;
    }
    if (!simplePlanning && !qualificationId) {
      if (selectedEmployeeId) onEmployeeChange("");
      return;
    }
    if (
      selectedEmployeeId &&
      !matchingEmployees.some((employee) => employee.id === selectedEmployeeId)
    ) {
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
    },
    [onEmployeeChange]
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
      onStartTimeChange(entry.start_time.slice(0, 5));
      onEndTimeChange(entry.end_time.slice(0, 5));
    },
    [onStartTimeChange, onEndTimeChange]
  );

  const dismissMessagePrompt = useCallback(() => {
    setMessagePrompt((current) => {
      if (current?.closeAssignModalOnDismiss) {
        onClose();
      }
      return null;
    });
  }, [onClose]);

  const finishAssign = useCallback(
    async (options?: { withoutServiceHours?: boolean }) => {
      setSaving(true);
      const result = await onAssign(options);
      setSaving(false);

      if (!result.ok) {
        setMessagePrompt({ kind: "error", message: result.error });
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

      onClose();
    },
    [onAssign, onClose]
  );

  const handleOk = useCallback(() => {
    if (!selectedEmployeeId || !timesComplete || dayReadOnly || saving) return;

    if (!simplePlanning && areaId) {
      const serviceHoursCheck = validateDashboardShiftServiceHours(
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

    void finishAssign();
  }, [
    selectedEmployeeId,
    timesComplete,
    dayReadOnly,
    saving,
    simplePlanning,
    areaId,
    serviceHours,
    date,
    startTime,
    endTime,
    finishAssign,
  ]);

  const handleRemoveClick = useCallback(() => {
    if (saving || dayReadOnly) return;
    void (async () => {
      setSaving(true);
      const result = await onRemove();
      setSaving(false);
      if (!result.ok) {
        setMessagePrompt({ kind: "error", message: result.error });
        return;
      }
      onClose();
    })();
  }, [saving, dayReadOnly, onRemove, onClose]);

  const busy = saving || loadingEmployees;
  const subtitle = simplePlanning
    ? `${dayHeader.weekday}, ${dayHeader.label}`
    : `${areaName} · ${dayHeader.weekday}, ${dayHeader.label}`;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !busy &&
          !messagePrompt &&
          !outsideServiceHoursConfirm
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planning-assign-shift-title"
        className={cn(
          "relative z-[111] flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
          MODAL_SCROLLBAR_CLASS
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3
              id="planning-assign-shift-title"
              className={SETTINGS_MODAL_TITLE_CLASS}
            >
              {t("dashboard.addShiftTitle")}
            </h3>
            <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
          </div>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={busy}
            aria-label={t("common.close")}
            className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div className="space-y-4 px-5 py-4">
          {dayReadOnly ? (
            <p className="text-xs text-muted">{t("planning.readOnlyDay")}</p>
          ) : null}

          {!simplePlanning && assignmentPresets.length === 0 ? (
            <Alert variant="info">
              {t("dashboard.noShiftTemplatesForArea")}
            </Alert>
          ) : null}

          {!simplePlanning ? (
            <div>
              <LabelMuted>{t("dashboard.shiftTemplateLabel")}</LabelMuted>
              <DashboardShiftTypeCombobox
                value={selectedPresetId}
                presets={assignmentPresets}
                placeholder={t("dashboard.selectShiftTemplate")}
                disabled={dayReadOnly || assignmentPresets.length === 0 || busy}
                onChange={onPresetChange}
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
                onChange={(event) => onStartTimeChange(event.target.value)}
              />
            </div>
            <div>
              <LabelMuted>{t("shiftTypes.timeTo")}</LabelMuted>
              <TimeInput
                className="mt-1"
                value={endTime}
                disabled={dayReadOnly || busy}
                onChange={(event) => onEndTimeChange(event.target.value)}
              />
            </div>
          </div>

          {!simplePlanning ? (
            <div>
              <LabelMuted>{t("dashboard.bulkShiftQualification")}</LabelMuted>
              <DashboardQualificationCombobox
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
            <DashboardShiftEmployeeCombobox
              value={selectedEmployeeId}
              onChange={handleEmployeeChange}
              employees={employeesForCombobox}
              selectedEmployee={selectedEmployee}
              weekday={weekday}
              dayAvailabilities={dayAvailabilities}
              emptyLabel={t("dashboard.noEmployeeSelected")}
              disabled={
                loadingEmployees ||
                busy ||
                dayReadOnly ||
                !timesComplete ||
                (!simplePlanning && !qualificationId && !hasExistingShift)
              }
              onApplyAvailability={handleApplyAvailability}
              weekdayLabelStyle="long"
            />
          </div>

          {!simplePlanning &&
          timesComplete &&
          qualificationId &&
          !loadingEmployees &&
          matchingEmployees.length === 0 ? (
            <p className="text-xs text-muted">
              {t("dashboard.bulkShiftNoEligibleEmployees")}
            </p>
          ) : null}

          <div>
            <LabelMuted>{t("planning.assignNoteLabel")}</LabelMuted>
            <Textarea
              className="mt-1"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={2}
              disabled={dayReadOnly || busy}
              placeholder={t("planning.assignNotePlaceholder")}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            {t("common.cancel")}
          </Button>
          {hasExistingShift && !dayReadOnly ? (
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={handleRemoveClick}
            >
              {t("planning.assignRemove")}
            </Button>
          ) : null}
          {!dayReadOnly ? (
            <Button
              type="button"
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

      {messagePrompt ? (
        <div
          className={dashboardNestedModalOverlayClass()}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              dismissMessagePrompt();
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="planning-assign-shift-message"
            className={dashboardAlertDialogClass()}
            onMouseDown={(event) => event.stopPropagation()}
          >
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
      ) : null}

      {outsideServiceHoursConfirm ? (
        <div
          className={dashboardNestedModalOverlayClass()}
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
            className={dashboardAlertDialogClass()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p
              id="planning-assign-shift-service-hours-confirm"
              className="text-sm text-foreground"
            >
              {t("dashboard.bulkShiftOutsideServiceHoursConfirm")}
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
      ) : null}
    </div>
  );
}
