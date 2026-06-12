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
  type DashboardBulkShiftDialogState,
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
  tooltipContentClassName,
} from "@/components/ui";
import {
  areDashboardShiftTimesComplete,
  dedupeDashboardAssignmentWindows,
  filterBulkShiftAssignEmployeesForRow,
  pickEmployeeLongestWithoutShift,
  profileAvailabilitiesForWeekday,
  profileAvailabilityWeekdayFromDashboardDate,
  resolveShiftAssignmentRequestWindow,
} from "@/lib/available-employees-for-shift";
import {
  areaShiftTemplatesForArea,
  dashboardAssignmentPresetsForArea,
  filterAssignmentPresetsMatchingTimes,
  resolvePresetShiftTemplateForDemandTimes,
  areaShiftTemplateIdForAssign,
  type DashboardAssignmentPreset,
} from "@/lib/dashboard-assignment-presets";
import { validateDashboardShiftServiceHours } from "@/lib/service-hours-shift-validation";
import {
  presetQualificationForServiceHour,
  areaStaffingQualificationOptions,
  employeeAreaQualificationOptions,
  filterEmployeesWithAnyAreaQualification,
  filterEmployeesWithAnyQualificationInSet,
  resolvePresetQualificationForEmployee,
  staffingQualificationIdsForServiceHour,
  type StaffingQualificationOption,
} from "@/lib/bulk-shift-qualification";
import {
  findBulkShiftDayComplianceViolation,
  type LocationDayAssignment,
} from "@/lib/bulk-shift-day-compliance";
import { DEFAULT_ORGANIZATION_TIME_ZONE } from "@schichtwerk/database";
import { sortBulkShiftRows } from "@/lib/bulk-shift-sort";
import {
  isStaffingFullyCovered,
  personalbedarfDemandTimesForEntry,
  personalbedarfTimesForServiceHour,
  personalbedarfTimesForShiftType,
  staffingDemandExceeded,
  staffingEntryForNewBulkRow,
} from "@/lib/bulk-shift-staffing";
import {
  computeBulkStaffingHeaderEntries,
  type StaffingAssignmentRef,
} from "@/lib/bulk-staffing-header";
import { formatDayHeader } from "@/lib/planning-utils";
import {
  findServiceHourIdForShift,
  weekdayLabelFromIndex,
  type AreaServiceHourRef,
  type TagAreaHeaderStaffingEntry,
} from "@/lib/location-staffing-client";
import {
  findEmployeeWithOverlappingDashboardAssignments,
  type DashboardAssignmentTimeWindow,
} from "@/lib/shift-overlap";
import { cn } from "@/lib/cn";
import { translateActionError } from "@/lib/translate-action-error";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import type {
  AreaShiftTemplateWithBreaks,
  LocationArea,
  LocationAreaStaffing,
  Qualification,
} from "@schichtwerk/types";

const MAX_ROWS = 20;
const PENDING_NEW_BULK_ROW_ID = "__pending-new-bulk-row__";

type BulkStaffingTableRow = {
  key: string;
  timeLabel: string;
  hasFormattedTimeRange: boolean;
  required: number;
  qualificationName: string;
  assigned: number;
  met: boolean;
};

function buildBulkStaffingTableRows(
  entries: readonly TagAreaHeaderStaffingEntry[]
): BulkStaffingTableRow[] {
  const rows: BulkStaffingTableRow[] = [];
  for (const entry of entries) {
    const qualifications =
      entry.qualifications?.filter((qualification) => qualification.required > 0) ??
      [];
    if (qualifications.length > 0) {
      for (const qualification of qualifications) {
        rows.push({
          key: `${entry.serviceHourId}:${qualification.qualificationId}`,
          timeLabel: entry.timeLabel ?? entry.label,
          hasFormattedTimeRange: Boolean(entry.timeLabel),
          required: qualification.required,
          qualificationName: qualification.name,
          assigned: qualification.assigned,
          met: qualification.assigned >= qualification.required,
        });
      }
      continue;
    }
    rows.push({
      key: entry.serviceHourId,
      timeLabel: entry.timeLabel ?? entry.label,
      hasFormattedTimeRange: Boolean(entry.timeLabel),
      required: entry.required,
      qualificationName: "—",
      assigned: entry.assigned,
      met: entry.assigned >= entry.required,
    });
  }
  return rows;
}

function bulkStaffingStatusClass(met: boolean): string {
  return met ? "text-emerald-600" : "text-red-600";
}

function BulkShiftStaffingTable({
  rows,
  locale,
}: {
  rows: BulkStaffingTableRow[];
  locale: string;
}) {
  const t = useTranslations();

  return (
    <div className="shrink-0 rounded border border-border px-2 py-1.5">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-left text-[10px] font-medium text-muted">
            <th className="whitespace-nowrap px-1.5 pb-1 pr-3 font-medium">
              {t("dashboard.bulkShiftStaffingTableTime")}
            </th>
            <th className="whitespace-nowrap px-1.5 pb-1 pr-3 text-center font-medium">
              {t("dashboard.bulkShiftStaffingTableRequired")}
            </th>
            <th className="whitespace-nowrap px-1.5 pb-1 pr-3 font-medium">
              {t("dashboard.bulkShiftStaffingTableQualification")}
            </th>
            <th className="whitespace-nowrap px-1.5 pb-1 text-center font-medium">
              {t("dashboard.bulkShiftStaffingTableAssigned")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="leading-snug">
              <td className="whitespace-nowrap px-1.5 py-0.5 pr-3 text-foreground">
                {row.timeLabel}
                {row.hasFormattedTimeRange && locale === "de" ? (
                  <span className="text-[10px] font-normal"> Uhr</span>
                ) : null}
              </td>
              <td
                className={cn(
                  "whitespace-nowrap px-1.5 py-0.5 pr-3 text-center font-medium tabular-nums",
                  bulkStaffingStatusClass(row.met)
                )}
              >
                {row.required}
              </td>
              <td
                className={cn(
                  "whitespace-nowrap px-1.5 py-0.5 pr-3 font-medium",
                  bulkStaffingStatusClass(row.met)
                )}
              >
                {row.qualificationName}
              </td>
              <td
                className="whitespace-nowrap px-1.5 py-0.5 text-center font-medium tabular-nums text-foreground"
              >
                {row.assigned}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

export type { DashboardBulkShiftDialogState } from "./dashboard-add-shift-modal";

export type BulkModalExistingShift = {
  id: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  areaShiftTemplateId: string | null;
};

type BulkModalPrompt =
  | { kind: "alert"; message: string; blocking?: boolean }
  | { kind: "confirm-add-row" }
  | { kind: "confirm-overstaff-save" };

type BulkRow = {
  id: string;
  /** Gespeicherte Schicht — wird beim Speichern nicht erneut angelegt. */
  existingShiftId?: string;
  employeeId: string;
  qualificationId: string;
  shiftTypeId: string;
  startTime: string;
  endTime: string;
  /** Angeforderte Schichtzeit (Personalbedarf) — bleibt bei Auto-Zuweisung erhalten. */
  requestedStartTime?: string;
  requestedEndTime?: string;
  /** Servicezeit aus dem Personalbedarf (für Funktionsfilter). */
  demandServiceHourId?: string;
  employeeManuallySelected: boolean;
  shiftTypeManuallySelected: boolean;
  qualificationManuallySelected: boolean;
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
  existingAreaShifts: BulkModalExistingShift[];
  areaExistingAssignments: DashboardAssignmentTimeWindow[];
  locationDayAssignments: LocationDayAssignment[];
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
    shiftTypeManuallySelected: false,
    qualificationManuallySelected: false,
  };
}

type BulkRowValidationState = "empty" | "complete" | "incomplete";

function getBulkRowValidationState(row: BulkRow): BulkRowValidationState {
  const hasEmployee = row.employeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID;
  const timesComplete = areDashboardShiftTimesComplete(
    row.startTime,
    row.endTime
  );
  const hasQualification = row.qualificationId.length > 0;

  if (hasEmployee && timesComplete && hasQualification) return "complete";
  if (!hasEmployee && !timesComplete) return "empty";
  return "incomplete";
}

function getBulkRowIssueMessage(
  row: BulkRow,
  translate: (key: string) => string
): string | null {
  const state = getBulkRowValidationState(row);
  if (state !== "incomplete") return null;

  const hasEmployee = row.employeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID;
  const timesComplete = areDashboardShiftTimesComplete(
    row.startTime,
    row.endTime
  );
  const hasQualification = row.qualificationId.length > 0;

  if (!hasEmployee && timesComplete) {
    return translate("dashboard.bulkShiftValidationEmployeeRequired");
  }
  if (hasEmployee && !timesComplete) {
    return translate("dashboard.bulkShiftValidationTimesRequired");
  }
  if (hasEmployee && timesComplete && !hasQualification) {
    return translate("dashboard.bulkShiftValidationQualificationRequired");
  }
  return translate("dashboard.bulkShiftValidationEmployeeOrTimesRequired");
}

function validateBulkShiftRowsForOk(
  rows: BulkRow[],
  translate: (key: string) => string
): {
  valid: boolean;
  summary: string | null;
  completeRowCount: number;
  rowHints: Record<string, string>;
} {
  const rowHints: Record<string, string> = {};
  let completeRowCount = 0;

  for (const row of rows) {
    const state = getBulkRowValidationState(row);
    if (state === "empty") continue;
    if (state === "complete") {
      completeRowCount += 1;
      continue;
    }

    rowHints[row.id] = getBulkRowIssueMessage(row, translate)!;
  }

  if (Object.keys(rowHints).length > 0) {
    return {
      valid: false,
      summary:
        completeRowCount === 0
          ? translate("dashboard.bulkShiftValidationNoCompleteRows")
          : translate("dashboard.bulkShiftValidationIncomplete"),
      completeRowCount,
      rowHints,
    };
  }

  return {
    valid: true,
    summary: null,
    completeRowCount,
    rowHints,
  };
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
  return dedupeDashboardAssignmentWindows([...areaExistingAssignments, ...fromRows]);
}

function otherAreaAssignmentsForBulkRow(
  locationDayAssignments: LocationDayAssignment[],
  areaId: string
): DashboardAssignmentTimeWindow[] {
  return locationDayAssignments
    .filter(
      (assignment) =>
        assignment.locationAreaId !== areaId &&
        areDashboardShiftTimesComplete(assignment.startTime, assignment.endTime)
    )
    .map((assignment) => ({
      employeeId: assignment.employeeId,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
    }));
}

function matchingEmployeesForBulkRow(
  row: Pick<
    BulkRow,
    | "id"
    | "startTime"
    | "endTime"
    | "requestedStartTime"
    | "requestedEndTime"
    | "demandServiceHourId"
  >,
  options: {
    employees: DashboardShiftAssignEmployee[];
    weekday: number;
    dateISO: string;
    areaId: string;
    countryCode: string;
    timeZone: string;
    staffingRules: LocationAreaStaffing[];
    areaQualifications: StaffingQualificationOption[];
    profileQualificationIds: Map<string, Set<string>>;
    areaExistingAssignments: DashboardAssignmentTimeWindow[];
    locationDayAssignments: LocationDayAssignment[];
    allRows: BulkRow[];
  }
): DashboardShiftAssignEmployee[] {
  const requestWindow = resolveShiftAssignmentRequestWindow(row);
  const requestTimesComplete = areDashboardShiftTimesComplete(
    requestWindow.startTime,
    requestWindow.endTime
  );
  if (!requestTimesComplete) return [];

  const areaQualificationIds = new Set(
    options.areaQualifications.map((option) => option.id)
  );
  const areaAssignmentsForRow = buildAreaAssignmentsForRow(
    options.areaExistingAssignments,
    options.allRows,
    row.id
  );
  const { startTime, endTime } = requestWindow;
  const byWindow = filterBulkShiftAssignEmployeesForRow(
    options.employees,
    options.weekday,
    startTime,
    endTime,
    {
      shiftDate: options.dateISO,
      countryCode: options.countryCode,
      timeZone: options.timeZone,
      areaAssignments: areaAssignmentsForRow,
      otherAreaAssignments: otherAreaAssignmentsForBulkRow(
        options.locationDayAssignments,
        options.areaId
      ),
    }
  );
  const demandQualificationIds = staffingQualificationIdsForServiceHour(
    options.staffingRules,
    options.areaId,
    row.demandServiceHourId
  );
  if (demandQualificationIds.size > 0) {
    return filterEmployeesWithAnyQualificationInSet(
      byWindow,
      demandQualificationIds,
      options.profileQualificationIds
    );
  }
  return filterEmployeesWithAnyAreaQualification(
    byWindow,
    areaQualificationIds,
    options.profileQualificationIds
  );
}

function computeBulkModalStaffingEntries(
  staffingRules: LocationAreaStaffing[],
  areaId: string,
  dateISO: string,
  serviceHours: AreaServiceHourRef[],
  rows: BulkRow[] = [],
  assignmentPresets: DashboardAssignmentPreset[],
  qualifications: Qualification[],
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>,
  formatTimeLabel: (
    weekdayLabel: string,
    startTime: string,
    endTime: string
  ) => string,
  weekdayLabel: (weekday: number) => string
): TagAreaHeaderStaffingEntry[] {
  const assignments: StaffingAssignmentRef[] = rows.flatMap((row) => {
    if (row.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID) return [];
    if (!areDashboardShiftTimesComplete(row.startTime, row.endTime)) return [];
    return [
      {
        startTime: row.startTime,
        endTime: row.endTime,
        employeeId: row.employeeId,
        qualificationId: row.qualificationId || undefined,
      },
    ];
  });

  return computeBulkStaffingHeaderEntries({
    staffingRules,
    areaId,
    dateISO,
    serviceHours,
    assignments,
    assignmentPresets,
    qualifications,
    profileQualificationIds,
    formatTimeLabel,
    weekdayLabel,
  });
}

function createBulkRowFromExistingShift(
  shift: BulkModalExistingShift,
  options: {
    serviceHours: AreaServiceHourRef[];
    assignmentPresets: DashboardAssignmentPreset[];
    staffingRules: LocationAreaStaffing[];
    areaId: string;
    dateISO: string;
  }
): BulkRow {
  const startTime = timeFieldValue(shift.startTime);
  const endTime = timeFieldValue(shift.endTime);
  const serviceHourId = findServiceHourIdForShift(
    options.serviceHours,
    options.areaId,
    options.dateISO,
    startTime,
    endTime
  );
  const shiftTypeId =
    shift.areaShiftTemplateId ??
    resolvePresetShiftTemplateForDemandTimes(
      startTime,
      endTime,
      options.assignmentPresets
    ) ??
    "";

  return {
    id: crypto.randomUUID(),
    existingShiftId: shift.id,
    employeeId: shift.employeeId,
    qualificationId: presetQualificationForServiceHour(
      options.staffingRules,
      options.areaId,
      serviceHourId
    ),
    shiftTypeId,
    startTime,
    endTime,
    requestedStartTime: startTime,
    requestedEndTime: endTime,
    demandServiceHourId: serviceHourId ?? undefined,
    employeeManuallySelected: true,
    shiftTypeManuallySelected: true,
    qualificationManuallySelected: true,
  };
}

function createInitialBulkModalRows(
  existingAreaShifts: BulkModalExistingShift[],
  options: {
    staffingRules: LocationAreaStaffing[];
    areaId: string;
    dateISO: string;
    serviceHours: AreaServiceHourRef[];
    assignmentPresets: DashboardAssignmentPreset[];
    qualifications: Qualification[];
    formatTimeLabel: (
      weekdayLabel: string,
      startTime: string,
      endTime: string
    ) => string;
    weekdayLabel: (weekday: number) => string;
  }
): BulkRow[] {
  const existingRows = sortBulkShiftRows(
    existingAreaShifts.map((shift) => ({
      ...createBulkRowFromExistingShift(shift, options),
      employeeName: "",
    }))
  );

  const staffingEntries = computeBulkModalStaffingEntries(
    options.staffingRules,
    options.areaId,
    options.dateISO,
    options.serviceHours,
    existingRows,
    options.assignmentPresets,
    options.qualifications,
    new Map(),
    options.formatTimeLabel,
    options.weekdayLabel
  );

  const presetRow = createPresetBulkRow(
    staffingEntries,
    options.serviceHours,
    options.assignmentPresets,
    options.staffingRules,
    options.areaId,
    existingRows
  );

  return existingRows.length > 0 ? [...existingRows, presetRow] : [presetRow];
}

function createPresetBulkRow(
  staffingEntries: TagAreaHeaderStaffingEntry[],
  serviceHours: AreaServiceHourRef[],
  assignmentPresets: DashboardAssignmentPreset[],
  staffingRules: LocationAreaStaffing[],
  areaId: string,
  existingRows: BulkRow[] = []
): BulkRow {
  const targetEntry = staffingEntryForNewBulkRow(staffingEntries, existingRows);
  let demand = targetEntry
    ? personalbedarfDemandTimesForEntry(
        targetEntry.serviceHourId,
        serviceHours,
        assignmentPresets,
        staffingRules,
        areaId
      )
    : null;

  if (!demand && targetEntry?.serviceHourId) {
    const hourTimes = personalbedarfTimesForServiceHour(
      serviceHours,
      targetEntry.serviceHourId
    );
    if (hourTimes) {
      demand = {
        ...hourTimes,
        serviceHourId: targetEntry.serviceHourId,
      };
    }
  }

  const startTime = demand?.startTime ?? "00:00";
  const endTime = demand?.endTime ?? "00:00";
  const demandTimesComplete = areDashboardShiftTimesComplete(startTime, endTime);
  const matchedPresetId = demandTimesComplete
    ? resolvePresetShiftTemplateForDemandTimes(
        startTime,
        endTime,
        assignmentPresets
      )
    : "";

  return {
    ...createEmptyRow(),
    shiftTypeId: matchedPresetId,
    startTime: demandTimesComplete ? startTime : "00:00",
    endTime: demandTimesComplete ? endTime : "00:00",
    requestedStartTime: demandTimesComplete ? startTime : undefined,
    requestedEndTime: demandTimesComplete ? endTime : undefined,
    demandServiceHourId:
      demand?.serviceHourId || targetEntry?.serviceHourId || undefined,
    qualificationId: "",
    employeeManuallySelected: false,
    shiftTypeManuallySelected: false,
    qualificationManuallySelected: false,
  };
}

type BulkShiftRowEditorProps = {
  row: BulkRow;
  weekday: number;
  areaId: string;
  employees: DashboardShiftAssignEmployee[];
  assignmentPresets: DashboardAssignmentPreset[];
  areaQualifications: StaffingQualificationOption[];
  staffingRules: LocationAreaStaffing[];
  serviceHours: AreaServiceHourRef[];
  dateISO: string;
  countryCode: string;
  timeZone: string;
  areaExistingAssignments: DashboardAssignmentTimeWindow[];
  locationDayAssignments: LocationDayAssignment[];
  allRows: BulkRow[];
  profileQualificationIds: Map<string, Set<string>>;
  onChange: (patch: Partial<BulkRow>) => void;
  onDelete: () => void;
  disabled?: boolean;
  presetPlaceholder: string;
  qualificationPlaceholder: string;
  validationHint?: string | null;
};

function BulkShiftRowEditor({
  row,
  weekday,
  areaId,
  employees,
  assignmentPresets,
  areaQualifications,
  staffingRules,
  serviceHours,
  dateISO,
  countryCode,
  timeZone,
  areaExistingAssignments,
  locationDayAssignments,
  allRows,
  profileQualificationIds,
  onChange,
  onDelete,
  disabled = false,
  presetPlaceholder,
  qualificationPlaceholder,
  validationHint = null,
}: BulkShiftRowEditorProps) {
  const t = useTranslations();
  const skipSyncRef = useRef(false);
  const timesComplete = areDashboardShiftTimesComplete(row.startTime, row.endTime);
  const requestWindow = resolveShiftAssignmentRequestWindow(row);
  const requestTimesComplete = areDashboardShiftTimesComplete(
    requestWindow.startTime,
    requestWindow.endTime
  );

  const matchingEmployees = useMemo(
    () =>
      matchingEmployeesForBulkRow(row, {
        employees,
        weekday,
        dateISO,
        areaId,
        countryCode,
        timeZone,
        staffingRules,
        areaQualifications,
        profileQualificationIds,
        areaExistingAssignments,
        locationDayAssignments,
        allRows,
      }),
    [
      row,
      employees,
      weekday,
      dateISO,
      areaId,
      countryCode,
      timeZone,
      staffingRules,
      areaQualifications,
      profileQualificationIds,
      areaExistingAssignments,
      locationDayAssignments,
      allRows,
    ]
  );

  const rowQualificationOptions = useMemo(
    () =>
      employeeAreaQualificationOptions(
        row.employeeId,
        areaQualifications,
        profileQualificationIds,
        DASHBOARD_EMPTY_EMPLOYEE_ID
      ),
    [row.employeeId, areaQualifications, profileQualificationIds]
  );

  const rowAssignmentPresets = useMemo(() => {
    if (!requestTimesComplete) return [];
    return filterAssignmentPresetsMatchingTimes(
      requestWindow.startTime,
      requestWindow.endTime,
      assignmentPresets
    );
  }, [
    assignmentPresets,
    requestTimesComplete,
    requestWindow.endTime,
    requestWindow.startTime,
  ]);

  useEffect(() => {
    const skipTypeFromTimesSync = skipSyncRef.current;
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
    }

    if (!requestTimesComplete) {
      const patch: Partial<BulkRow> = {};
      if (row.shiftTypeId) patch.shiftTypeId = "";
      if (
        !row.employeeManuallySelected &&
        row.employeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID
      ) {
        patch.employeeId = DASHBOARD_EMPTY_EMPLOYEE_ID;
      }
      if (row.qualificationId) patch.qualificationId = "";
      if (Object.keys(patch).length > 0) onChange(patch);
      return;
    }

    const patch: Partial<BulkRow> = {};
    if (!skipTypeFromTimesSync && !row.shiftTypeManuallySelected) {
      const nextShiftTypeId = resolvePresetShiftTemplateForDemandTimes(
        requestWindow.startTime,
        requestWindow.endTime,
        assignmentPresets,
        row.shiftTypeId
      );
      if (nextShiftTypeId !== row.shiftTypeId) {
        patch.shiftTypeId = nextShiftTypeId;
      }
    } else if (
      row.shiftTypeId &&
      !rowAssignmentPresets.some((preset) => preset.id === row.shiftTypeId)
    ) {
      patch.shiftTypeId = "";
    }

    let nextEmployeeId = row.employeeId;
    if (!row.employeeManuallySelected) {
      const preferred = pickEmployeeLongestWithoutShift(matchingEmployees);
      nextEmployeeId = preferred?.id ?? DASHBOARD_EMPTY_EMPLOYEE_ID;
      if (nextEmployeeId !== row.employeeId) {
        patch.employeeId = nextEmployeeId;
        patch.qualificationManuallySelected = false;
      }
    }

    const effectiveEmployeeId = patch.employeeId ?? row.employeeId;

    if (!row.qualificationManuallySelected) {
      const nextQualificationId = resolvePresetQualificationForEmployee(
        effectiveEmployeeId,
        areaQualifications,
        profileQualificationIds,
        DASHBOARD_EMPTY_EMPLOYEE_ID,
        row.qualificationId
      );
      if (nextQualificationId !== row.qualificationId) {
        patch.qualificationId = nextQualificationId;
      }
    } else if (
      row.qualificationId &&
      effectiveEmployeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID &&
      !rowQualificationOptions.some((option) => option.id === row.qualificationId)
    ) {
      patch.qualificationId = "";
      patch.qualificationManuallySelected = false;
    }

    if (
      patch.employeeId !== undefined &&
      patch.employeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID &&
      requestTimesComplete
    ) {
      if (row.startTime !== requestWindow.startTime) {
        patch.startTime = requestWindow.startTime;
      }
      if (row.endTime !== requestWindow.endTime) {
        patch.endTime = requestWindow.endTime;
      }
    }

    if (Object.keys(patch).length > 0) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only on time/type inputs
  }, [
    row.startTime,
    row.endTime,
    row.requestedStartTime,
    row.requestedEndTime,
    row.shiftTypeId,
    row.qualificationId,
    row.employeeId,
    row.employeeManuallySelected,
    row.shiftTypeManuallySelected,
    row.qualificationManuallySelected,
    assignmentPresets,
    areaQualifications,
    timesComplete,
    requestTimesComplete,
    requestWindow.startTime,
    requestWindow.endTime,
    matchingEmployees,
    profileQualificationIds,
    rowQualificationOptions,
    rowAssignmentPresets,
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
    return profileAvailabilitiesForWeekday(
      selectedEmployee.availabilities,
      weekday
    );
  }, [selectedEmployee, weekday]);

  const handleTimeFieldChange = (
    field: "startTime" | "endTime",
    value: string
  ) => {
    skipSyncRef.current = true;
    const patch: Partial<BulkRow> = {
      [field]: value,
      employeeManuallySelected: false,
      shiftTypeManuallySelected: false,
      qualificationManuallySelected: false,
    };
    if (field === "startTime") {
      patch.requestedStartTime = value;
    } else {
      patch.requestedEndTime = value;
    }
    onChange(patch);
  };

  const handleApplyAvailability = (entry: DashboardEmployeeAvailabilityEntry) => {
    const nextStart = timeFieldValue(entry.start_time);
    const nextEnd = timeFieldValue(entry.end_time);
    skipSyncRef.current = true;
    const matchedPresetId = resolvePresetShiftTemplateForDemandTimes(
      nextStart,
      nextEnd,
      assignmentPresets
    );
    onChange({
      startTime: nextStart,
      endTime: nextEnd,
      requestedStartTime: nextStart,
      requestedEndTime: nextEnd,
      employeeManuallySelected: true,
      qualificationManuallySelected: false,
      shiftTypeManuallySelected: false,
      shiftTypeId: matchedPresetId,
    });
  };

  return (
    <tr className="border-b border-border/60">
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <DashboardShiftTypeCombobox
          value={row.shiftTypeId}
          presets={rowAssignmentPresets}
          placeholder={presetPlaceholder}
          disabled={disabled || rowAssignmentPresets.length === 0}
          rootClassName={BULK_SHIFT_TABLE_COMBO_ROOT_CLASS}
          triggerClassName={DASHBOARD_TABLE_COMBO_TRIGGER_CLASS}
          onChange={(nextId) => {
            const preset = assignmentPresets.find((item) => item.id === nextId);
            if (preset) {
              skipSyncRef.current = true;
              const nextStart = timeFieldValue(preset.start_time);
              const nextEnd = timeFieldValue(preset.end_time);
              onChange({
                shiftTypeId: nextId,
                startTime: nextStart,
                endTime: nextEnd,
                requestedStartTime: nextStart,
                requestedEndTime: nextEnd,
                employeeManuallySelected: false,
                shiftTypeManuallySelected: false,
                qualificationManuallySelected: false,
              });
            } else {
              onChange({
                shiftTypeId: nextId,
                employeeManuallySelected: false,
                shiftTypeManuallySelected: true,
                qualificationManuallySelected: false,
              });
            }
          }}
        />
      </td>
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <DashboardQualificationCombobox
          value={row.qualificationId}
          options={rowQualificationOptions}
          placeholder={qualificationPlaceholder}
          disabled={
            disabled ||
            row.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID ||
            rowQualificationOptions.length === 0
          }
          rootClassName={BULK_SHIFT_TABLE_COMBO_ROOT_CLASS}
          triggerClassName={DASHBOARD_TABLE_COMBO_TRIGGER_CLASS}
          onChange={(qualificationId) =>
            onChange({
              qualificationId,
              qualificationManuallySelected: true,
            })
          }
        />
      </td>
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <TimeInput
          className={BULK_SHIFT_TIME_INPUT_CLASS}
          value={row.startTime}
          disabled={disabled}
          onChange={(event) => handleTimeFieldChange("startTime", event.target.value)}
        />
      </td>
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <TimeInput
          className={BULK_SHIFT_TIME_INPUT_CLASS}
          value={row.endTime}
          disabled={disabled}
          onChange={(event) => handleTimeFieldChange("endTime", event.target.value)}
        />
      </td>
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <DashboardShiftEmployeeCombobox
          value={row.employeeId}
          onChange={(employeeId) => {
            const demand = resolveShiftAssignmentRequestWindow(row);
            const patch: Partial<BulkRow> = {
              employeeId,
              employeeManuallySelected: true,
              qualificationManuallySelected: false,
            };
            if (
              employeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID &&
              areDashboardShiftTimesComplete(demand.startTime, demand.endTime)
            ) {
              patch.startTime = demand.startTime;
              patch.endTime = demand.endTime;
            }
            onChange(patch);
          }}
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
      <td className="relative w-10 shrink-0 px-1 py-2 align-middle">
        {validationHint ? (
          <div
            className={cn(tooltipContentClassName, "pointer-events-none absolute bottom-full right-1 z-20 mb-1 max-w-[11rem] text-right")}
            role="tooltip"
          >
            {validationHint}
          </div>
        ) : null}
        <div className="flex h-9 items-center justify-center">
          <IconButton
            size="sm"
            onClick={onDelete}
            disabled={disabled}
            aria-label={t("dashboard.bulkShiftDeleteRow")}
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
  areaExistingAssignments,
  existingAreaShifts,
  locationDayAssignments,
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

  const templatesForArea = useMemo(
    () => areaShiftTemplatesForArea(dialog.areaId, areaShiftTemplates),
    [areaShiftTemplates, dialog.areaId]
  );
  const assignmentPresets = useMemo(
    () => dashboardAssignmentPresetsForArea(templatesForArea),
    [templatesForArea]
  );

  const formatStaffingTimeLabel = useCallback(
    (_weekdayLabel: string, startTime: string, endTime: string) =>
      t("dashboard.bulkShiftStaffingTimeRangeLabel", {
        start: startTime,
        end: endTime,
      }),
    [t]
  );

  const staffingWeekdayLabel = useCallback(
    (weekdayIndex: number) => weekdayLabelFromIndex(weekdayIndex, t),
    [t]
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

  const [rows, setRows] = useState<BulkRow[]>(() =>
    createInitialBulkModalRows(existingAreaShifts, {
      staffingRules,
      areaId: dialog.areaId,
      dateISO: dialog.date,
      serviceHours,
      assignmentPresets,
      qualifications,
      formatTimeLabel: formatStaffingTimeLabel,
      weekdayLabel: staffingWeekdayLabel,
    })
  );
  const [employees, setEmployees] = useState<DashboardShiftAssignEmployee[]>([]);
  const [profileQualificationIds, setProfileQualificationIds] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [countryCode, setCountryCode] = useState("DE");
  const [timeZone, setTimeZone] = useState(DEFAULT_ORGANIZATION_TIME_ZONE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState<BulkModalPrompt | null>(null);
  const [rowValidationHints, setRowValidationHints] = useState<
    Record<string, string>
  >({});

  const staffingEntries = useMemo(
    () =>
      computeBulkModalStaffingEntries(
        staffingRules,
        dialog.areaId,
        dialog.date,
        serviceHours,
        rows,
        assignmentPresets,
        qualifications,
        profileQualificationIds,
        formatStaffingTimeLabel,
        staffingWeekdayLabel
      ),
    [
      staffingRules,
      dialog.areaId,
      dialog.date,
      serviceHours,
      rows,
      assignmentPresets,
      qualifications,
      profileQualificationIds,
      formatStaffingTimeLabel,
      staffingWeekdayLabel,
    ]
  );

  const staffingTableRows = useMemo(
    () => buildBulkStaffingTableRows(staffingEntries),
    [staffingEntries]
  );

  const employeeNameById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.full_name])),
    [employees]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setPrompt(null);
      const result = await fetchDashboardBulkShiftContext(dialog.date);
      if (cancelled) return;
      if (!result.ok) {
        setPrompt({ kind: "alert", message: translateActionError(result.error, t) });
        setEmployees([]);
        setProfileQualificationIds(new Map());
        setCountryCode("DE");
        setTimeZone(DEFAULT_ORGANIZATION_TIME_ZONE);
      } else {
        setEmployees(result.employees);
        const map = new Map<string, Set<string>>();
        for (const [profileId, ids] of Object.entries(
          result.profileQualificationIds
        )) {
          map.set(profileId, new Set(ids));
        }
        setProfileQualificationIds(map);
        setCountryCode(result.countryCode);
        setTimeZone(result.timeZone);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [dialog.date]);

  const updateRow = useCallback((id: string, patch: Partial<BulkRow>) => {
    setRowValidationHints((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }, []);

  const deleteRow = useCallback(
    (id: string) => {
      setRowValidationHints((current) => {
        if (!current[id]) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });

      setRows((current) => {
        const index = current.findIndex((row) => row.id === id);
        if (index === -1) return current;

        if (current.length === 1) {
          return [{ ...createEmptyRow(), id: current[0]!.id }];
        }

        const next = [...current];
        next.splice(index, 1);

        return next.map((row, rowIndex) => {
          if (rowIndex < index) return row;
          const times = personalbedarfTimesForShiftType(
            row.shiftTypeId,
            assignmentPresets
          );
          if (!times) {
            return {
              ...row,
              employeeManuallySelected: false,
              qualificationManuallySelected: false,
            };
          }
          return {
            ...row,
            startTime: times.startTime,
            endTime: times.endTime,
            requestedStartTime: times.startTime,
            requestedEndTime: times.endTime,
            employeeManuallySelected: false,
            qualificationManuallySelected: false,
          };
        });
      });
    },
    [assignmentPresets]
  );

  const performAddRow = useCallback(() => {
    setRows((current) => {
      if (current.length >= MAX_ROWS) return current;
      return [
        ...current,
        createPresetBulkRow(
          staffingEntries,
          serviceHours,
          assignmentPresets,
          staffingRules,
          dialog.areaId,
          current
        ),
      ];
    });
  }, [
    staffingEntries,
    serviceHours,
    assignmentPresets,
    staffingRules,
    dialog.areaId,
  ]);

  const getEligibleEmployeesForNewRow = useCallback(
    (currentRows: BulkRow[]) => {
      const presetRow = createPresetBulkRow(
        staffingEntries,
        serviceHours,
        assignmentPresets,
        staffingRules,
        dialog.areaId,
        currentRows
      );
      return matchingEmployeesForBulkRow(
        { ...presetRow, id: PENDING_NEW_BULK_ROW_ID },
        {
          employees,
          weekday,
          dateISO: dialog.date,
          areaId: dialog.areaId,
          countryCode,
          timeZone,
          staffingRules,
          areaQualifications,
          profileQualificationIds,
          areaExistingAssignments,
          locationDayAssignments,
          allRows: currentRows,
        }
      );
    },
    [
      staffingEntries,
      serviceHours,
      assignmentPresets,
      staffingRules,
      dialog.areaId,
      dialog.date,
      employees,
      weekday,
      countryCode,
      timeZone,
      areaQualifications,
      profileQualificationIds,
      areaExistingAssignments,
      locationDayAssignments,
    ]
  );

  const addRow = useCallback(() => {
    const validation = validateBulkShiftRows(rows, t, { requireAllComplete: true });
    if (!validation.valid) {
      setPrompt({ kind: "alert", message: validation.summary! });
      return;
    }

    if (getEligibleEmployeesForNewRow(rows).length === 0) {
      setPrompt({
        kind: "alert",
        message: t("dashboard.bulkShiftNoEligibleEmployees"),
      });
      return;
    }

    if (isStaffingFullyCovered(staffingEntries)) {
      setPrompt({ kind: "confirm-add-row" });
      return;
    }

    performAddRow();
  }, [rows, t, staffingEntries, getEligibleEmployeesForNewRow, performAddRow]);

  const performSave = useCallback(async () => {
    const newRows = rows.filter((row) => !row.existingShiftId);
    const completeAssignments: DashboardAssignmentTimeWindow[] = newRows.flatMap(
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
      employeeNameById,
      timeZone
    );
    if (overlapEmployeeName) {
      setPrompt({
        kind: "alert",
        message: t("dashboard.bulkShiftValidationOverlap", {
          name: overlapEmployeeName,
        }),
      });
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
          !row.existingShiftId &&
          row.employeeId !== DASHBOARD_EMPTY_EMPLOYEE_ID &&
          row.qualificationId.length > 0 &&
          areDashboardShiftTimesComplete(row.startTime, row.endTime)
      );

    if (payloadRows.length === 0) {
      if (rows.some((row) => row.existingShiftId)) {
        onClose();
        return;
      }
      setPrompt({
        kind: "alert",
        message: t("dashboard.bulkShiftValidationNoCompleteRows"),
        blocking: true,
      });
      return;
    }

    setSaving(true);
    setPrompt(null);

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
      setPrompt({ kind: "alert", message: translateActionError(result.error, t) });
      return;
    }

    const failed = result.results.filter((r) => !r.ok);
    if (failed.length === 0 && result.undoAvailable) {
      onSaved?.();
      router.refresh();
      onClose();
      return;
    }

    if (failed.length === 0 && !result.undoAvailable) {
      setPrompt({
        kind: "alert",
        message: t("dashboard.bulkShiftValidationNoCompleteRows"),
        blocking: true,
      });
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
    setPrompt({
      kind: "alert",
      message: t("dashboard.bulkShiftPartialSuccess"),
    });
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
    timeZone,
    onClose,
    onSaved,
    router,
    t,
  ]);

  const handleOk = useCallback(async () => {
    const validation = validateBulkShiftRowsForOk(rows, t);
    if (!validation.valid) {
      setRowValidationHints(validation.rowHints);
      setPrompt({
        kind: "alert",
        message: validation.summary!,
        blocking: true,
      });
      return;
    }
    setRowValidationHints({});

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
        setPrompt({
          kind: "alert",
          message: t("dashboard.bulkShiftValidationOutsideServiceHours", {
            row: String(rowIndex + 1),
          }),
        });
        return;
      }
    }

    const complianceViolation = findBulkShiftDayComplianceViolation(
      dialog.date,
      countryCode,
      rows,
      locationDayAssignments,
      dialog.areaId,
      employeeNameById,
      t
    );
    if (complianceViolation) {
      setPrompt({
        kind: "alert",
        message: complianceViolation,
        blocking: true,
      });
      return;
    }

    if (staffingDemandExceeded(staffingEntries)) {
      setPrompt({ kind: "confirm-overstaff-save" });
      return;
    }

    await performSave();
  }, [
    rows,
    t,
    serviceHours,
    dialog.areaId,
    dialog.date,
    staffingEntries,
    performSave,
    countryCode,
    locationDayAssignments,
    employeeNameById,
  ]);

  const handlePromptConfirm = useCallback(() => {
    if (!prompt) return;
    if (prompt.kind === "confirm-add-row") {
      setPrompt(null);
      performAddRow();
      return;
    }
    if (prompt.kind === "confirm-overstaff-save") {
      void performSave();
    }
  }, [prompt, performAddRow, performSave]);

  const promptMessage =
    prompt?.kind === "alert"
      ? prompt.message
      : prompt?.kind === "confirm-add-row"
        ? t("dashboard.bulkShiftStaffingCoveredConfirm")
        : prompt?.kind === "confirm-overstaff-save"
          ? t("dashboard.bulkShiftStaffingExceededConfirm")
          : null;

  const promptIsConfirm =
    prompt?.kind === "confirm-add-row" ||
    prompt?.kind === "confirm-overstaff-save";

  const modalLocked = prompt?.kind === "alert" && prompt.blocking === true;

  return (
    <div
      className={cn(dashboardModalBackdropClass(), loading && "cursor-wait")}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !prompt) {
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
          <div className="min-w-0 flex-1">
            <h3 id="dashboard-bulk-shift-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("dashboard.bulkShiftTitle")}
            </h3>
            <p className="mt-0.5 font-semibold text-[#0f766e]">
              <span className="text-base">
                {locationName} / {areaName}
              </span>
              <span className="text-lg">
                {" "}
                – {dayHeader.weekday}, {dayHeader.label}
              </span>
            </p>
          </div>
          {staffingTableRows.length > 0 ? (
            <BulkShiftStaffingTable rows={staffingTableRows} locale={locale} />
          ) : null}
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={saving || modalLocked}
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
                    areaId={dialog.areaId}
                    employees={employees}
                    assignmentPresets={assignmentPresets}
                    areaQualifications={areaQualifications}
                    staffingRules={staffingRules}
                    serviceHours={serviceHours}
                    dateISO={dialog.date}
                    countryCode={countryCode}
                    timeZone={timeZone}
                    areaExistingAssignments={areaExistingAssignments}
                    locationDayAssignments={locationDayAssignments}
                    allRows={rows}
                    profileQualificationIds={profileQualificationIds}
                    disabled={loading || saving}
                    onChange={(patch) => updateRow(row.id, patch)}
                    onDelete={() => deleteRow(row.id)}
                    presetPlaceholder={presetPlaceholder}
                    qualificationPlaceholder={qualificationPlaceholder}
                    validationHint={rowValidationHints[row.id] ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <SettingsPrimaryActionButton
              label={t("dashboard.addShiftTitle")}
              icon={<PlusIcon />}
              disabled={loading || saving || rows.length >= MAX_ROWS || !!prompt}
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
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving || modalLocked}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleOk()}
            disabled={loading || saving || !!prompt}
          >
            {t("common.ok")}
          </Button>
        </div>

        {prompt && promptMessage ? (
          <div
            className={dashboardNestedModalOverlayClass()}
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !promptIsConfirm &&
                !modalLocked
              ) {
                setPrompt(null);
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
                {promptMessage}
              </p>
              <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0 sm:justify-end")}>
                {promptIsConfirm ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPrompt(null)}
                    >
                      {t("common.no")}
                    </Button>
                    <Button type="button" variant="primary" onClick={handlePromptConfirm}>
                      {t("common.yes")}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setPrompt(null)}
                  >
                    {t("common.ok")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
