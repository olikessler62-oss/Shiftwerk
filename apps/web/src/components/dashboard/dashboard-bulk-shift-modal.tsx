"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchDashboardBulkShiftContext,
  type DashboardEmployeeAvailabilityEntry,
  type DashboardShiftAssignEmployee,
} from "@/app/actions/dashboard-shift-assign";
import { assignShiftBatch } from "@/app/actions/shifts";
import {
  DASHBOARD_EMPTY_EMPLOYEE_ID,
  DASHBOARD_TABLE_COMBO_TRIGGER_CLASS,
  DashboardQualificationCombobox,
  DashboardShiftEmployeeCombobox,
  DashboardShiftTypeCombobox,
  DASHBOARD_COMBO_EMPTY_LABEL,
  type DashboardAddShiftDialogState,
} from "@/components/dashboard/dashboard-add-shift-modal";
import {
  BULK_SHIFT_LIST_SCROLL_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsPrimaryActionButton,
  dashboardAlertDialogClass,
  dashboardModalBackdropClass,
  dashboardModalDialogClass,
  dashboardNestedModalOverlayClass,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsResponsiveTableWrapClass,
} from "@/components/settings/settings-list-ui";
import {
  Button,
  Alert,
  CloseIcon,
  IconButton,
  PlusIcon,
  TimeInput,
  TrashIcon,
} from "@/components/ui";
import {
  areDashboardShiftTimesComplete,
  filterDashboardShiftAssignEmployeesByWindowWithoutOverlap,
  pickEmployeeLongestWithoutShift,
  profileAvailabilityWeekdayFromDashboardDate,
} from "@/lib/available-employees-for-shift";
import {
  areaShiftTemplatesForArea,
  dashboardAssignmentPresetsForArea,
  resolvePresetIdFromTimes,
  areaShiftTemplateIdForAssign,
  type DashboardAssignmentPreset,
} from "@/lib/dashboard-assignment-presets";
import { validateDashboardShiftServiceHours } from "@/lib/service-hours-shift-validation";
import {
  areaStaffingQualificationOptions,
  filterEmployeesByQualification,
  presetQualificationForServiceHour,
  type StaffingQualificationOption,
} from "@/lib/bulk-shift-qualification";
import { sortBulkShiftRows } from "@/lib/bulk-shift-sort";
import {
  tagAreaHeaderStaffingEntries,
  type AreaServiceHourRef,
  type TagAreaHeaderStaffingEntry,
} from "@/lib/location-staffing-client";
import { formatDayHeader } from "@/lib/planning-utils";
import {
  findEmployeeWithOverlappingDashboardAssignments,
  type DashboardAssignmentTimeWindow,
} from "@/lib/shift-overlap";
import { cn } from "@/lib/cn";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
  LocationAreaStaffing,
  Qualification,
} from "@schichtwerk/types";

const MAX_ROWS = 20;
const BULK_SHIFT_TABLE_CELL_CLASS =
  "min-w-0 overflow-hidden px-1 py-2 align-middle";
const BULK_SHIFT_TABLE_COMBO_ROOT_CLASS = "h-9 w-full min-w-0";
const BULK_SHIFT_TIME_INPUT_CLASS =
  "box-border h-9 min-h-9 max-h-9 w-full min-w-0 py-0 leading-9 tabular-nums";
/** Combobox-Spalten −15 %; frei werdende Breite geht an Von/Bis */
const BULK_SHIFT_COL_TEMPLATE = "18.43072%";
const BULK_SHIFT_COL_QUALIFICATION = "19.941%";
const BULK_SHIFT_COL_EMPLOYEE = "27.54%";
const BULK_SHIFT_COL_TIME = "5.8725rem";

export type DashboardBulkShiftDialogState = DashboardAddShiftDialogState;

type BulkRow = {
  id: string;
  employeeId: string;
  qualificationId: string;
  shiftTypeId: string;
  startTime: string;
  endTime: string;
  employeeManuallySelected: boolean;
};

type Props = {
  dialog: DashboardBulkShiftDialogState;
  locationId: string;
  locationName: string;
  areas: LocationArea[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  staffingRules: LocationAreaStaffing[];
  serviceHours: AreaServiceHourRef[];
  qualifications: Qualification[];
  areaAssignedShifts: { startTime: string; endTime: string }[];
  areaExistingAssignments: DashboardAssignmentTimeWindow[];
  onClose: () => void;
  onSaved?: () => void;
};

function createEmptyRow(): BulkRow {
  return {
    id: crypto.randomUUID(),
    employeeId: DASHBOARD_EMPTY_EMPLOYEE_ID,
    qualificationId: "",
    shiftTypeId: "",
    startTime: "00:00",
    endTime: "00:00",
    employeeManuallySelected: false,
  };
}

type BulkRowValidationState = "empty" | "complete" | "incomplete";

function getBulkRowValidationState(row: BulkRow): BulkRowValidationState {
  const hasEmployee = row.employeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID;
  const timesComplete = areDashboardShiftTimesComplete(
    row.startTime,
    row.endTime
  );

  if (hasEmployee && timesComplete) return "complete";
  if (!hasEmployee && !timesComplete) return "empty";
  return "incomplete";
}

type BulkShiftRowsValidation = {
  valid: boolean;
  summary: string | null;
  completeRowCount: number;
};

function validateBulkShiftRows(
  rows: BulkRow[],
  translate: (key: string, params?: Record<string, string>) => string,
  options: { requireAllComplete?: boolean } = {}
): BulkShiftRowsValidation {
  const { requireAllComplete = false } = options;
  let completeRowCount = 0;
  let hasInvalidRow = false;

  for (const row of rows) {
    const state = getBulkRowValidationState(row);
    if (state === "complete") {
      completeRowCount += 1;
      continue;
    }

    const shouldReport =
      state === "incomplete" || (requireAllComplete && state === "empty");
    if (shouldReport) hasInvalidRow = true;
  }

  if (hasInvalidRow) {
    return {
      valid: false,
      summary: translate("dashboard.bulkShiftValidationIncomplete"),
      completeRowCount,
    };
  }

  return {
    valid: true,
    summary: null,
    completeRowCount,
  };
}

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

function buildAreaAssignmentsForRow(
  areaExistingAssignments: DashboardAssignmentTimeWindow[],
  rows: BulkRow[],
  excludeRowId: string
): DashboardAssignmentTimeWindow[] {
  const fromRows = rows.flatMap((row) => {
    if (row.id === excludeRowId) return [];
    if (row.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID) return [];
    if (!areDashboardShiftTimesComplete(row.startTime, row.endTime)) return [];
    return [
      {
        employeeId: row.employeeId,
        startTime: row.startTime,
        endTime: row.endTime,
      },
    ];
  });
  return [...areaExistingAssignments, ...fromRows];
}

function firstUnsatisfiedStaffingEntry(
  staffingEntries: TagAreaHeaderStaffingEntry[]
): TagAreaHeaderStaffingEntry | null {
  return staffingEntries.find((entry) => entry.assigned < entry.required) ?? null;
}

function computeBulkModalStaffingEntries(
  staffingRules: LocationAreaStaffing[],
  areaId: string,
  dateISO: string,
  serviceHours: AreaServiceHourRef[],
  areaAssignedShifts: { startTime: string; endTime: string }[],
  rows: BulkRow[] = []
): TagAreaHeaderStaffingEntry[] {
  const pendingAssignments = rows.flatMap((row) => {
    if (row.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID) return [];
    if (!areDashboardShiftTimesComplete(row.startTime, row.endTime)) return [];
    return [{ startTime: row.startTime, endTime: row.endTime }];
  });

  return tagAreaHeaderStaffingEntries(
    staffingRules,
    areaId,
    dateISO,
    serviceHours,
    [...areaAssignedShifts, ...pendingAssignments]
  );
}

function createPresetBulkRow(
  staffingEntries: TagAreaHeaderStaffingEntry[],
  serviceHours: AreaServiceHourRef[],
  assignmentPresets: DashboardAssignmentPreset[],
  staffingRules: LocationAreaStaffing[],
  areaId: string
): BulkRow {
  const unsatisfiedEntry = firstUnsatisfiedStaffingEntry(staffingEntries);
  const presetHour = unsatisfiedEntry
    ? serviceHours.find((hour) => hour.id === unsatisfiedEntry.serviceHourId)
    : null;

  const startTime = presetHour?.start_time
    ? timeFieldValue(presetHour.start_time)
    : "00:00";
  const endTime = presetHour?.end_time
    ? timeFieldValue(presetHour.end_time)
    : "00:00";
  const matchedPresetId =
    resolvePresetIdFromTimes(startTime, endTime, assignmentPresets) ?? "";

  return {
    ...createEmptyRow(),
    shiftTypeId: matchedPresetId,
    qualificationId: presetQualificationForServiceHour(
      staffingRules,
      areaId,
      unsatisfiedEntry?.serviceHourId
    ),
    startTime,
    endTime,
    employeeManuallySelected: false,
  };
}

type BulkShiftRowEditorProps = {
  row: BulkRow;
  weekday: number;
  employees: DashboardShiftAssignEmployee[];
  assignmentPresets: DashboardAssignmentPreset[];
  areaQualifications: StaffingQualificationOption[];
  dateISO: string;
  areaExistingAssignments: DashboardAssignmentTimeWindow[];
  allRows: BulkRow[];
  profileQualificationIds: Map<string, Set<string>>;
  onChange: (patch: Partial<BulkRow>) => void;
  onDelete: () => void;
  disabled?: boolean;
  presetPlaceholder: string;
  qualificationPlaceholder: string;
};

function BulkShiftRowEditor({
  row,
  weekday,
  employees,
  assignmentPresets,
  areaQualifications,
  dateISO,
  areaExistingAssignments,
  allRows,
  profileQualificationIds,
  onChange,
  onDelete,
  disabled = false,
  presetPlaceholder,
  qualificationPlaceholder,
}: BulkShiftRowEditorProps) {
  const t = useTranslations();
  const skipSyncRef = useRef(false);
  const timesComplete = areDashboardShiftTimesComplete(row.startTime, row.endTime);

  const areaAssignmentsForRow = useMemo(
    () => buildAreaAssignmentsForRow(areaExistingAssignments, allRows, row.id),
    [areaExistingAssignments, allRows, row.id]
  );

  const matchingEmployees = useMemo(() => {
    const byWindow = filterDashboardShiftAssignEmployeesByWindowWithoutOverlap(
      employees,
      weekday,
      row.startTime,
      row.endTime,
      dateISO,
      areaAssignmentsForRow
    );
    return filterEmployeesByQualification(
      byWindow,
      row.qualificationId,
      profileQualificationIds
    );
  }, [
    employees,
    weekday,
    row.startTime,
    row.endTime,
    row.qualificationId,
    dateISO,
    areaAssignmentsForRow,
    profileQualificationIds,
  ]);

  useEffect(() => {
    const skipTypeFromTimesSync = skipSyncRef.current;
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
    }

    if (!timesComplete) {
      const patch: Partial<BulkRow> = {};
      if (row.shiftTypeId) patch.shiftTypeId = "";
      if (
        !row.employeeManuallySelected &&
        row.employeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID
      ) {
        patch.employeeId = DASHBOARD_EMPTY_EMPLOYEE_ID;
      }
      if (Object.keys(patch).length > 0) onChange(patch);
      return;
    }

    const matched =
      resolvePresetIdFromTimes(row.startTime, row.endTime, assignmentPresets) ?? "";
    const patch: Partial<BulkRow> = {};
    if (!skipTypeFromTimesSync && matched !== row.shiftTypeId) {
      patch.shiftTypeId = matched;
    }

    if (
      row.qualificationId &&
      row.employeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID &&
      !profileQualificationIds.get(row.employeeId)?.has(row.qualificationId)
    ) {
      patch.employeeId = DASHBOARD_EMPTY_EMPLOYEE_ID;
      patch.employeeManuallySelected = false;
    }

    if (!row.employeeManuallySelected) {
      const preferred = pickEmployeeLongestWithoutShift(matchingEmployees);
      const nextId = preferred?.id ?? DASHBOARD_EMPTY_EMPLOYEE_ID;
      if (nextId !== row.employeeId) patch.employeeId = nextId;
    }
    if (Object.keys(patch).length > 0) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only on time/type inputs
  }, [
    row.startTime,
    row.endTime,
    row.shiftTypeId,
    row.qualificationId,
    row.employeeId,
    row.employeeManuallySelected,
    assignmentPresets,
    timesComplete,
    matchingEmployees,
    profileQualificationIds,
  ]);

  const selectedEmployee = useMemo(
    () =>
      row.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID
        ? null
        : employees.find((e) => e.id === row.employeeId) ?? null,
    [row.employeeId, employees]
  );

  const dayAvailabilities = useMemo(() => {
    if (!selectedEmployee) return [];
    return selectedEmployee.availabilities.filter((slot) => slot.weekday === weekday);
  }, [selectedEmployee, weekday]);

  const handleApplyAvailability = (entry: DashboardEmployeeAvailabilityEntry) => {
    const nextStart = timeFieldValue(entry.start_time);
    const nextEnd = timeFieldValue(entry.end_time);
    skipSyncRef.current = true;
    const matchedPresetId = resolvePresetIdFromTimes(
      nextStart,
      nextEnd,
      assignmentPresets
    );
    onChange({
      startTime: nextStart,
      endTime: nextEnd,
      employeeManuallySelected: true,
      shiftTypeId: matchedPresetId ?? row.shiftTypeId,
    });
  };

  return (
    <tr className="border-b border-border/60">
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <DashboardShiftTypeCombobox
          value={row.shiftTypeId}
          presets={assignmentPresets}
          placeholder={presetPlaceholder}
          disabled={disabled || assignmentPresets.length === 0}
          rootClassName={BULK_SHIFT_TABLE_COMBO_ROOT_CLASS}
          triggerClassName={DASHBOARD_TABLE_COMBO_TRIGGER_CLASS}
          onChange={(nextId) => {
            const preset = assignmentPresets.find((item) => item.id === nextId);
            if (preset) {
              skipSyncRef.current = true;
              onChange({
                shiftTypeId: nextId,
                startTime: timeFieldValue(preset.start_time),
                endTime: timeFieldValue(preset.end_time),
                employeeManuallySelected: false,
              });
            } else {
              onChange({ shiftTypeId: nextId, employeeManuallySelected: false });
            }
          }}
        />
      </td>
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <DashboardQualificationCombobox
          value={row.qualificationId}
          options={areaQualifications}
          placeholder={qualificationPlaceholder}
          disabled={disabled || areaQualifications.length === 0}
          rootClassName={BULK_SHIFT_TABLE_COMBO_ROOT_CLASS}
          triggerClassName={DASHBOARD_TABLE_COMBO_TRIGGER_CLASS}
          onChange={(qualificationId) =>
            onChange({
              qualificationId,
              employeeManuallySelected: false,
            })
          }
        />
      </td>
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <TimeInput
          className={BULK_SHIFT_TIME_INPUT_CLASS}
          value={row.startTime}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              startTime: event.target.value,
              employeeManuallySelected: false,
            })
          }
        />
      </td>
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <TimeInput
          className={BULK_SHIFT_TIME_INPUT_CLASS}
          value={row.endTime}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              endTime: event.target.value,
              employeeManuallySelected: false,
            })
          }
        />
      </td>
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <DashboardShiftEmployeeCombobox
          value={row.employeeId}
          onChange={(employeeId) =>
            onChange({ employeeId, employeeManuallySelected: true })
          }
          employees={matchingEmployees}
          selectedEmployee={selectedEmployee}
          weekday={weekday}
          dayAvailabilities={dayAvailabilities}
          emptyLabel={t("dashboard.noEmployeeSelected")}
          disabled={disabled}
          onApplyAvailability={handleApplyAvailability}
          rootClassName={BULK_SHIFT_TABLE_COMBO_ROOT_CLASS}
          triggerClassName={DASHBOARD_TABLE_COMBO_TRIGGER_CLASS}
          weekdayLabelStyle="long"
        />
      </td>
      <td className="w-10 shrink-0 px-1 py-2 align-middle">
        <div className="flex h-9 items-center justify-center">
          <IconButton
            size="sm"
            onClick={onDelete}
            disabled={disabled}
            aria-label={t("dashboard.bulkShiftDeleteRow")}
            title={t("dashboard.bulkShiftDeleteRow")}
            className="h-8 w-8 shrink-0 border-transparent bg-transparent hover:bg-subtle"
          >
            <TrashIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

export function DashboardBulkShiftModal({
  dialog,
  locationId,
  locationName,
  areas,
  areaShiftTemplates,
  staffingRules,
  serviceHours,
  qualifications,
  areaAssignedShifts,
  areaExistingAssignments,
  onClose,
  onSaved,
}: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = useTranslations();
  const intlLocale = toIntlLocale(locale);
  const weekday = profileAvailabilityWeekdayFromDashboardDate(dialog.date);

  const areaName = areas.find((area) => area.id === dialog.areaId)?.name ?? "";
  const dayHeader = formatDayHeader(dialog.date, intlLocale, "long");
  const contextLine = `${locationName} / ${areaName} - ${dayHeader.weekday}, ${dayHeader.label}`;

  const templatesForArea = useMemo(
    () => areaShiftTemplatesForArea(dialog.areaId, areaShiftTemplates),
    [areaShiftTemplates, dialog.areaId]
  );
  const assignmentPresets = useMemo(
    () => dashboardAssignmentPresetsForArea(templatesForArea),
    [templatesForArea]
  );
  const presetColumnLabel = t("dashboard.bulkShiftTemplate");
  const presetPlaceholder = DASHBOARD_COMBO_EMPTY_LABEL;
  const qualificationPlaceholder = DASHBOARD_COMBO_EMPTY_LABEL;

  const areaQualifications = useMemo(
    () =>
      areaStaffingQualificationOptions(
        staffingRules,
        dialog.areaId,
        qualifications
      ),
    [staffingRules, dialog.areaId, qualifications]
  );

  const [rows, setRows] = useState<BulkRow[]>(() => [
    createPresetBulkRow(
      computeBulkModalStaffingEntries(
        staffingRules,
        dialog.areaId,
        dialog.date,
        serviceHours,
        areaAssignedShifts
      ),
      serviceHours,
      dashboardAssignmentPresetsForArea(
        areaShiftTemplatesForArea(dialog.areaId, areaShiftTemplates)
      ),
      staffingRules,
      dialog.areaId
    ),
  ]);
  const [employees, setEmployees] = useState<DashboardShiftAssignEmployee[]>([]);
  const [profileQualificationIds, setProfileQualificationIds] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const staffingEntries = useMemo(
    () =>
      computeBulkModalStaffingEntries(
        staffingRules,
        dialog.areaId,
        dialog.date,
        serviceHours,
        areaAssignedShifts,
        rows
      ),
    [
      staffingRules,
      dialog.areaId,
      dialog.date,
      serviceHours,
      areaAssignedShifts,
      rows,
    ]
  );

  const employeeNameById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.full_name])),
    [employees]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setAlertMessage(null);
      const result = await fetchDashboardBulkShiftContext(dialog.date);
      if (cancelled) return;
      if (!result.ok) {
        setAlertMessage(result.error);
        setEmployees([]);
        setProfileQualificationIds(new Map());
      } else {
        setEmployees(result.employees);
        const map = new Map<string, Set<string>>();
        for (const [profileId, ids] of Object.entries(
          result.profileQualificationIds
        )) {
          map.set(profileId, new Set(ids));
        }
        setProfileQualificationIds(map);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [dialog.date]);

  const updateRow = useCallback((id: string, patch: Partial<BulkRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }, []);

  const deleteRow = useCallback(
    (id: string) => {
      setRows((current) => {
        const next = current.filter((row) => row.id !== id);
        if (next.length) return next;
        return [
          createPresetBulkRow(
            computeBulkModalStaffingEntries(
              staffingRules,
              dialog.areaId,
              dialog.date,
              serviceHours,
              areaAssignedShifts
            ),
            serviceHours,
            assignmentPresets,
            staffingRules,
            dialog.areaId
          ),
        ];
      });
    },
    [
      staffingRules,
      dialog.areaId,
      dialog.date,
      serviceHours,
      areaAssignedShifts,
      assignmentPresets,
    ]
  );

  const addRow = useCallback(() => {
    const validation = validateBulkShiftRows(rows, t, { requireAllComplete: true });
    if (!validation.valid) {
      setAlertMessage(validation.summary);
      return;
    }
    setAlertMessage(null);

    setRows((current) => {
      if (current.length >= MAX_ROWS) return current;
      return [
        ...current,
        createPresetBulkRow(
          staffingEntries,
          serviceHours,
          assignmentPresets,
          staffingRules,
          dialog.areaId
        ),
      ];
    });
  }, [
    rows,
    t,
    staffingEntries,
    serviceHours,
    assignmentPresets,
    staffingRules,
    dialog.areaId,
  ]);

  const handleOk = useCallback(async () => {
    const validation = validateBulkShiftRows(rows, t);
    if (!validation.valid) {
      setAlertMessage(validation.summary);
      return;
    }
    if (validation.completeRowCount === 0) {
      setAlertMessage(t("dashboard.bulkShiftValidationNoCompleteRows"));
      return;
    }

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]!;
      if (row.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID) continue;
      if (!areDashboardShiftTimesComplete(row.startTime, row.endTime)) continue;

      const serviceHoursCheck = validateDashboardShiftServiceHours(
        serviceHours,
        dialog.areaId,
        dialog.date,
        row.startTime,
        row.endTime
      );
      if (!serviceHoursCheck.ok) {
        setAlertMessage(
          t("dashboard.bulkShiftValidationOutsideServiceHours", {
            row: String(rowIndex + 1),
          })
        );
        return;
      }
    }

    const completeAssignments: DashboardAssignmentTimeWindow[] = rows.flatMap(
      (row) => {
        if (row.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID) return [];
        if (!areDashboardShiftTimesComplete(row.startTime, row.endTime)) return [];
        return [
          {
            employeeId: row.employeeId,
            startTime: row.startTime,
            endTime: row.endTime,
          },
        ];
      }
    );

    const overlapEmployeeName = findEmployeeWithOverlappingDashboardAssignments(
      dialog.date,
      completeAssignments,
      areaExistingAssignments,
      employeeNameById
    );
    if (overlapEmployeeName) {
      setAlertMessage(
        t("dashboard.bulkShiftValidationOverlap", { name: overlapEmployeeName })
      );
      return;
    }

    const sorted = sortBulkShiftRows(
      rows.map((row) => ({
        ...row,
        employeeName:
          employees.find((e) => e.id === row.employeeId)?.full_name ?? "",
      }))
    );

    const payloadRows = sorted
      .map((row, rowIndex) => ({ row, rowIndex }))
      .filter(
        ({ row }) =>
          row.employeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID &&
          areDashboardShiftTimesComplete(row.startTime, row.endTime)
      );

    setSaving(true);
    setAlertMessage(null);

    const result = await assignShiftBatch({
      shiftDate: dialog.date,
      locationId,
      locationAreaId: dialog.areaId,
      rows: payloadRows.map(({ row }) => ({
        employeeId: row.employeeId,
        startTime: row.startTime,
        endTime: row.endTime,
        areaShiftTemplateId: areaShiftTemplateIdForAssign(row.shiftTypeId),
      })),
    });
    setSaving(false);

    if (!result.ok) {
      setAlertMessage(result.error);
      return;
    }

    const failed = result.results.filter((r) => !r.ok);
    if (failed.length === 0) {
      onSaved?.();
      router.refresh();
      onClose();
      return;
    }

    const errorByRowIndex = new Map<number, string>();
    for (const entry of failed) {
      if (!entry.ok) {
        errorByRowIndex.set(entry.rowIndex, entry.error);
      }
    }

    const remainingRows: BulkRow[] = [];
    for (const { row, rowIndex } of payloadRows) {
      if (errorByRowIndex.has(rowIndex)) {
        remainingRows.push(row);
      }
    }

    setRows(remainingRows.length ? remainingRows : [createEmptyRow()]);
    setAlertMessage(t("dashboard.bulkShiftPartialSuccess"));
    if (result.undoAvailable) {
      onSaved?.();
      router.refresh();
    }
  }, [
    rows,
    employees,
    dialog.date,
    dialog.areaId,
    locationId,
    areaExistingAssignments,
    employeeNameById,
    onClose,
    onSaved,
    router,
    t,
    serviceHours,
    assignmentPresets,
  ]);

  return (
    <div
      className={cn(dashboardModalBackdropClass(), loading && "cursor-wait")}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !alertMessage) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-bulk-shift-title"
        className={cn(
          dashboardModalDialogClass("5xl"),
          loading && "cursor-wait"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-3 border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <div className="min-w-0">
            <h3 id="dashboard-bulk-shift-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("dashboard.bulkShiftTitle")}
            </h3>
            <p className="mt-0.5 text-base font-semibold text-[#0f766e]">
              {contextLine}
            </p>
            {staffingEntries.length > 0 ? (
              <p className="mt-2 text-sm leading-relaxed">
                <span className="text-muted">{t("dashboard.bulkShiftStaffingPrefix")} </span>
                {staffingEntries.map((entry, index) => (
                  <span key={entry.serviceHourId}>
                    {index > 0 ? " - " : ""}
                    <span
                      className={cn(
                        "font-medium",
                        entry.assigned >= entry.required
                          ? "text-emerald-600"
                          : "text-red-600"
                      )}
                    >
                      {entry.label}: {entry.assigned}/{entry.required}
                    </span>
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={saving}
            aria-label={t("common.close")}
            className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-hidden", settingsModalBodyPaddingClass())}>
          {assignmentPresets.length === 0 ? (
            <Alert variant="info" className="mb-4">
              {t("dashboard.noShiftTemplatesForArea")}
            </Alert>
          ) : null}
          <div className={cn(BULK_SHIFT_LIST_SCROLL_CLASS, settingsResponsiveTableWrapClass())}>
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col style={{ width: BULK_SHIFT_COL_TEMPLATE }} />
                <col style={{ width: BULK_SHIFT_COL_QUALIFICATION }} />
                <col style={{ width: BULK_SHIFT_COL_TIME }} />
                <col style={{ width: BULK_SHIFT_COL_TIME }} />
                <col style={{ width: BULK_SHIFT_COL_EMPLOYEE }} />
                <col style={{ width: "2.5rem" }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="text-left text-xs text-muted">
                  <th className="min-w-0 truncate px-1 py-2">{presetColumnLabel}</th>
                  <th className="min-w-0 truncate px-1 py-2">
                    {t("dashboard.bulkShiftQualification")}
                  </th>
                  <th className="px-1 py-2">{t("dashboard.bulkShiftFrom")}</th>
                  <th className="px-1 py-2">{t("dashboard.bulkShiftTo")}</th>
                  <th className="min-w-0 truncate px-1 py-2">
                    {t("dashboard.bulkShiftEmployee")}
                  </th>
                  <th className="px-1 py-2" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <BulkShiftRowEditor
                    key={row.id}
                    row={row}
                    weekday={weekday}
                    employees={employees}
                    assignmentPresets={assignmentPresets}
                    areaQualifications={areaQualifications}
                    dateISO={dialog.date}
                    areaExistingAssignments={areaExistingAssignments}
                    allRows={rows}
                    profileQualificationIds={profileQualificationIds}
                    disabled={loading || saving}
                    onChange={(patch) => updateRow(row.id, patch)}
                    onDelete={() => deleteRow(row.id)}
                    presetPlaceholder={presetPlaceholder}
                    qualificationPlaceholder={qualificationPlaceholder}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <SettingsPrimaryActionButton
              label={t("dashboard.addShiftTitle")}
              icon={<PlusIcon />}
              disabled={loading || saving || rows.length >= MAX_ROWS || !!alertMessage}
              onClick={addRow}
            />
            {rows.length >= MAX_ROWS ? (
              <span className="text-xs text-muted">
                {t("dashboard.bulkShiftMaxRows", { max: String(MAX_ROWS) })}
              </span>
            ) : null}
          </div>
        </div>

        <div className={settingsModalFooterClass()}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleOk()}
            disabled={loading || saving || !!alertMessage}
          >
            {t("common.ok")}
          </Button>
        </div>

        {alertMessage ? (
          <div
            className={dashboardNestedModalOverlayClass()}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setAlertMessage(null);
              }
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="dashboard-bulk-shift-validation-message"
              className={dashboardAlertDialogClass()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <p
                id="dashboard-bulk-shift-validation-message"
                className="text-sm text-foreground"
              >
                {alertMessage}
              </p>
              <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0 sm:justify-end")}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setAlertMessage(null)}
                >
                  {t("common.ok")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
