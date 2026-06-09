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
  DashboardShiftEmployeeCombobox,
  DashboardShiftTypeCombobox,
  type DashboardAddShiftDialogState,
} from "@/components/dashboard/dashboard-add-shift-modal";
import {
  BULK_SHIFT_LIST_SCROLL_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsPrimaryActionButton,
} from "@/components/settings/settings-list-ui";
import {
  Button,
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
  resolveShiftTypeIdFromTimes,
} from "@/lib/available-employees-for-shift";
import { evaluateBulkRowQualification } from "@/lib/bulk-shift-qualification";
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
  LocationArea,
  LocationAreaStaffing,
  Qualification,
  ShiftTypeWithBreaks,
} from "@schichtwerk/types";

const MAX_ROWS = 20;
const ROW_CONTROL_CLASS =
  "box-border h-9 min-h-9 max-h-9 py-0 leading-9";

export type DashboardBulkShiftDialogState = DashboardAddShiftDialogState;

type BulkRow = {
  id: string;
  employeeId: string;
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
  shiftTypes: ShiftTypeWithBreaks[];
  staffingRules: LocationAreaStaffing[];
  serviceHours: AreaServiceHourRef[];
  qualifications: Qualification[];
  areaAssignedShifts: { shiftTypeId: string }[];
  areaExistingAssignments: DashboardAssignmentTimeWindow[];
  onClose: () => void;
  onSaved?: () => void;
};

function createEmptyRow(): BulkRow {
  return {
    id: crypto.randomUUID(),
    employeeId: DASHBOARD_EMPTY_EMPLOYEE_ID,
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

function firstUnsatisfiedStaffingShiftType(
  staffingEntries: TagAreaHeaderStaffingEntry[]
): TagAreaHeaderStaffingEntry | null {
  return staffingEntries.find((entry) => entry.assigned < entry.required) ?? null;
}

function QualificationAmpel({
  status,
  missingNames,
}: {
  status: "neutral" | "ok" | "missing";
  missingNames: string[];
}) {
  const t = useTranslations();
  const title =
    status === "ok"
      ? t("dashboard.bulkShiftQualificationOk")
      : status === "missing"
        ? t("dashboard.bulkShiftQualificationMissing", {
            names: missingNames.join(", "),
          })
        : t("dashboard.bulkShiftQualificationNeutral");

  return (
    <span
      className="inline-flex items-center justify-center"
      title={title}
      aria-label={title}
    >
      <span
        className={cn(
          "inline-block h-3 w-3 rounded-full border border-border/60",
          status === "ok" && "bg-emerald-500",
          status === "missing" && "bg-amber-400",
          status === "neutral" && "bg-muted"
        )}
      />
    </span>
  );
}

type BulkShiftRowEditorProps = {
  row: BulkRow;
  weekday: number;
  employees: DashboardShiftAssignEmployee[];
  shiftTypes: ShiftTypeWithBreaks[];
  staffingRules: LocationAreaStaffing[];
  areaId: string;
  dateISO: string;
  areaExistingAssignments: DashboardAssignmentTimeWindow[];
  allRows: BulkRow[];
  qualificationNameById: Map<string, string>;
  profileQualificationIds: Map<string, Set<string>>;
  onChange: (patch: Partial<BulkRow>) => void;
  onDelete: () => void;
  disabled?: boolean;
};

function BulkShiftRowEditor({
  row,
  weekday,
  employees,
  shiftTypes,
  staffingRules,
  areaId,
  dateISO,
  areaExistingAssignments,
  allRows,
  qualificationNameById,
  profileQualificationIds,
  onChange,
  onDelete,
  disabled = false,
}: BulkShiftRowEditorProps) {
  const t = useTranslations();
  const skipSyncRef = useRef(false);
  const timesComplete = areDashboardShiftTimesComplete(row.startTime, row.endTime);

  const areaAssignmentsForRow = useMemo(
    () => buildAreaAssignmentsForRow(areaExistingAssignments, allRows, row.id),
    [areaExistingAssignments, allRows, row.id]
  );

  const matchingEmployees = useMemo(
    () =>
      filterDashboardShiftAssignEmployeesByWindowWithoutOverlap(
        employees,
        weekday,
        row.startTime,
        row.endTime,
        dateISO,
        areaAssignmentsForRow,
        shiftTypes
      ),
    [
      employees,
      weekday,
      row.startTime,
      row.endTime,
      dateISO,
      areaAssignmentsForRow,
      shiftTypes,
    ]
  );

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
      resolveShiftTypeIdFromTimes(row.startTime, row.endTime, shiftTypes) ?? "";
    const patch: Partial<BulkRow> = {};
    if (!skipTypeFromTimesSync && matched !== row.shiftTypeId) {
      patch.shiftTypeId = matched;
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
    row.employeeId,
    row.employeeManuallySelected,
    shiftTypes,
    timesComplete,
    matchingEmployees,
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

  const qualification = evaluateBulkRowQualification({
    shiftTypeId: row.shiftTypeId || null,
    employeeId:
      row.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID ? "" : row.employeeId,
    areaId,
    dateISO,
    staffingRules,
    employeeQualificationIds:
      profileQualificationIds.get(row.employeeId) ?? new Set<string>(),
    qualificationNameById,
  });

  const handleApplyAvailability = (entry: DashboardEmployeeAvailabilityEntry) => {
    const nextStart = timeFieldValue(entry.start_time);
    const nextEnd = timeFieldValue(entry.end_time);
    skipSyncRef.current = true;
    onChange({
      startTime: nextStart,
      endTime: nextEnd,
      employeeManuallySelected: true,
      shiftTypeId: entry.shift_type_id ?? row.shiftTypeId,
    });
  };

  return (
    <tr className="border-b border-border/60">
      <td className="min-w-[10rem] px-1 py-2 align-middle">
        <DashboardShiftEmployeeCombobox
          value={row.employeeId}
          onChange={(employeeId) =>
            onChange({ employeeId, employeeManuallySelected: true })
          }
          employees={matchingEmployees}
          selectedEmployee={selectedEmployee}
          dayAvailabilities={dayAvailabilities}
          emptyLabel={t("dashboard.noEmployeeSelected")}
          disabled={disabled}
          onApplyAvailability={handleApplyAvailability}
          rootClassName="w-full"
        />
      </td>
      <td className="min-w-[8rem] px-1 py-2 align-middle">
        <DashboardShiftTypeCombobox
          value={row.shiftTypeId}
          shiftTypes={shiftTypes}
          disabled={disabled || shiftTypes.length === 0}
          rootClassName="w-full"
          onChange={(nextId) => {
            const type = shiftTypes.find((item) => item.id === nextId);
            if (type) {
              skipSyncRef.current = true;
              onChange({
                shiftTypeId: nextId,
                startTime: timeFieldValue(type.start_time),
                endTime: timeFieldValue(type.end_time),
                employeeManuallySelected: false,
              });
            } else {
              onChange({ shiftTypeId: nextId, employeeManuallySelected: false });
            }
          }}
        />
      </td>
      <td className="w-[7rem] px-1 py-2 align-middle">
        <TimeInput
          className={ROW_CONTROL_CLASS}
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
      <td className="w-[7rem] px-1 py-2 align-middle">
        <TimeInput
          className={ROW_CONTROL_CLASS}
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
      <td className="w-10 px-1 py-2 align-middle">
        <div className="flex h-9 items-center justify-center">
          <QualificationAmpel
            status={qualification.status}
            missingNames={qualification.missingNames}
          />
        </div>
      </td>
      <td className="w-10 px-1 py-2 align-middle">
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
  shiftTypes,
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
  const dayHeader = formatDayHeader(dialog.date, intlLocale);
  const contextLine = `${locationName} / ${areaName} - ${dayHeader.weekday}, ${dayHeader.label}`;

  const [rows, setRows] = useState<BulkRow[]>(() => [createEmptyRow()]);
  const [employees, setEmployees] = useState<DashboardShiftAssignEmployee[]>([]);
  const [profileQualificationIds, setProfileQualificationIds] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const staffingEntries = useMemo(() => {
    const pendingAssignments = rows.flatMap((row) => {
      if (row.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID) return [];
      if (!areDashboardShiftTimesComplete(row.startTime, row.endTime)) return [];

      const shiftTypeId =
        row.shiftTypeId ||
        resolveShiftTypeIdFromTimes(row.startTime, row.endTime, shiftTypes);
      return shiftTypeId ? [{ shiftTypeId }] : [];
    });

    return tagAreaHeaderStaffingEntries(
      staffingRules,
      dialog.areaId,
      dialog.date,
      serviceHours,
      shiftTypes.map((type) => ({
        id: type.id,
        name: type.name,
        start_time: type.start_time,
      })),
      [...areaAssignedShifts, ...pendingAssignments]
    );
  }, [
    staffingRules,
    dialog.areaId,
    dialog.date,
    serviceHours,
    shiftTypes,
    areaAssignedShifts,
    rows,
  ]);

  const qualificationNameById = useMemo(
    () => new Map(qualifications.map((q) => [q.id, q.name])),
    [qualifications]
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

  const deleteRow = useCallback((id: string) => {
    setRows((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length ? next : [createEmptyRow()];
    });
  }, []);

  const addRow = useCallback(() => {
    const validation = validateBulkShiftRows(rows, t, { requireAllComplete: true });
    if (!validation.valid) {
      setAlertMessage(validation.summary);
      return;
    }
    setAlertMessage(null);

    const unsatisfiedEntry = firstUnsatisfiedStaffingShiftType(staffingEntries);
    const presetType = unsatisfiedEntry
      ? shiftTypes.find((type) => type.id === unsatisfiedEntry.shiftTypeId)
      : null;

    setRows((current) => {
      if (current.length >= MAX_ROWS) return current;
      const newRow: BulkRow = {
        ...createEmptyRow(),
        shiftTypeId: presetType?.id ?? "",
        startTime: presetType ? timeFieldValue(presetType.start_time) : "00:00",
        endTime: presetType ? timeFieldValue(presetType.end_time) : "00:00",
        employeeManuallySelected: false,
      };
      return [...current, newRow];
    });
  }, [rows, t, staffingEntries, shiftTypes]);

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
        shiftTypeId: row.shiftTypeId || null,
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
  ]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[110] flex items-center justify-center bg-black/30 p-4",
        loading && "cursor-wait"
      )}
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
          "relative z-[111] flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
          loading && "cursor-wait"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
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
                  <span key={entry.shiftTypeId}>
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

        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          <div className={cn(BULK_SHIFT_LIST_SCROLL_CLASS)}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="text-left text-xs text-muted">
                  <th className="px-1 py-2">{t("dashboard.bulkShiftEmployee")}</th>
                  <th className="px-1 py-2">{t("dashboard.bulkShiftType")}</th>
                  <th className="px-1 py-2">{t("dashboard.bulkShiftFrom")}</th>
                  <th className="px-1 py-2">{t("dashboard.bulkShiftTo")}</th>
                  <th className="px-1 py-2 text-center">
                    {t("dashboard.bulkShiftQualification")}
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
                    shiftTypes={shiftTypes}
                    staffingRules={staffingRules}
                    areaId={dialog.areaId}
                    dateISO={dialog.date}
                    areaExistingAssignments={areaExistingAssignments}
                    allRows={rows}
                    qualificationNameById={qualificationNameById}
                    profileQualificationIds={profileQualificationIds}
                    disabled={loading || saving}
                    onChange={(patch) => updateRow(row.id, patch)}
                    onDelete={() => deleteRow(row.id)}
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

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
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
            className="absolute inset-0 z-[112] flex items-center justify-center rounded-2xl bg-black/30 p-4"
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
              className="relative z-[113] w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <p
                id="dashboard-bulk-shift-validation-message"
                className="text-sm text-foreground"
              >
                {alertMessage}
              </p>
              <div className="mt-5 flex justify-end">
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
