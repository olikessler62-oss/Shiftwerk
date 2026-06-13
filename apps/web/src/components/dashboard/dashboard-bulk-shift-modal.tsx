"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  settingsIndicatorCellClass,
  settingsResponsiveTableWrapClass,
  settingsStickyIndicatorHeaderClass,
} from "@/components/settings/settings-list-ui";
import {
  Button,
  Alert,
  CloseIcon,
  IconButton,
  PlusIcon,
  TimeInput,
  TrashIcon,
  BoltIcon,
  Tooltip,
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
  loadBulkShiftColumnPrefs,
  saveBulkShiftColumnPrefs,
  type BulkShiftColumnPrefs,
} from "@/lib/bulk-shift-column-prefs";
import { sortBulkShiftRowsByColumn } from "@/lib/bulk-shift-row-sort";
import { buildPrefilledBulkRow } from "@/lib/bulk-shift-row-prefill";
import {
  insertBulkShiftRowInList,
  isBulkShiftEmployeeSortActive,
} from "@/lib/bulk-shift-row-insert";
import {
  buildBulkStaffingTableRows,
  bulkStaffingTableRowsSupportSpeedActions,
  isBulkShiftStaffingSpeedModeActive,
  type BulkStaffingTableRow,
} from "@/lib/bulk-shift-staffing-table";
import type { ProfileShiftPreferenceEntry } from "@/app/actions/dashboard-shift-assign";
import { BulkShiftColumnHeader } from "@/components/dashboard/bulk-shift-column-header";
import {
  isStaffingFullyCovered,
  personalbedarfDemandTimesForEntry,
  personalbedarfTimesForServiceHour,
  staffingEntryForNewBulkRow,
  resolveCurrentBulkShiftRowId,
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
import {
  formatBulkShiftPartialSaveMessage,
  resolveBulkShiftPartialSaveOutcome,
} from "@/lib/bulk-shift-partial-save";
import {
  filterLocationDayAssignmentsForBulkModal,
  resolveBulkShiftDeletedIds,
  resolveRemainingAreaAssignments,
} from "@/lib/bulk-shift-deletions";
import {
  bulkShiftRowAttrs,
  resolveBulkShiftRowIdForShiftFocus,
  scheduleScrollBulkShiftRowIntoView,
} from "@/lib/bulk-shift-list-scroll";
import {
  listSaveableNewBulkShiftRows,
  listUnsavedBulkShiftRows,
  resolveBulkShiftSaveIntent,
} from "@/lib/bulk-shift-save";
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

function bulkStaffingStatusClass(met: boolean): string {
  return met ? "text-emerald-600" : "text-red-600";
}

function BulkShiftStaffingTable({
  rows,
  locale,
  showSpeedActions,
  onSpeedAdd,
  speedActionsDisabled,
}: {
  rows: BulkStaffingTableRow[];
  locale: string;
  showSpeedActions: boolean;
  onSpeedAdd?: (serviceHourId: string, qualificationId: string) => void;
  speedActionsDisabled?: boolean;
}) {
  const t = useTranslations();

  return (
    <div
      className={cn(
        "shrink-0 select-none rounded border border-border px-2 py-1.5",
        showSpeedActions && "min-w-[26rem]"
      )}
    >
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-left text-[10px] font-medium text-muted">
            {showSpeedActions ? (
              <th className="w-8 px-0.5 pb-1 font-medium" aria-hidden />
            ) : null}
            <th className="whitespace-nowrap px-1.5 pb-1 pr-3 font-medium">
              {t("dashboard.bulkShiftStaffingTableTime")}
            </th>
            <th className="whitespace-nowrap px-1.5 pb-1 pr-3 font-medium">
              {t("dashboard.bulkShiftStaffingTableQualification")}
            </th>
            <th className="whitespace-nowrap px-1.5 pb-1 pr-3 text-center font-medium">
              {t("dashboard.bulkShiftStaffingTableDemand")}
            </th>
            <th className="whitespace-nowrap px-1.5 pb-1 text-center font-medium">
              {t("dashboard.bulkShiftStaffingTableTotal")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const speedEligible =
              showSpeedActions && row.qualificationId != null;
            return (
            <tr key={row.key} className="leading-snug">
              {showSpeedActions ? (
                <td className="w-8 px-0.5 py-0.5 align-middle">
                  {speedEligible ? (
                    <Tooltip
                      content={
                        row.met
                          ? t("dashboard.bulkShiftStaffingSpeedTooltipCovered", {
                              job: row.qualificationName,
                              time: row.timeLabel,
                            })
                          : t("dashboard.bulkShiftStaffingSpeedTooltip", {
                              job: row.qualificationName,
                              time: row.timeLabel,
                            })
                      }
                      placement={{ side: "above", gapPx: 6 }}
                    >
                      <IconButton
                        size="sm"
                        disabled={row.met || speedActionsDisabled}
                        aria-label={t("dashboard.bulkShiftStaffingSpeedAdd", {
                          job: row.qualificationName,
                          time: row.timeLabel,
                        })}
                        className={cn(
                          "h-6 w-6 min-h-6 min-w-6 border-transparent bg-transparent",
                          row.met
                            ? "opacity-40"
                            : "text-primary hover:bg-primary/10"
                        )}
                        onClick={() =>
                          onSpeedAdd?.(row.serviceHourId, row.qualificationId!)
                        }
                      >
                        <BoltIcon className="h-3.5 w-3.5" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </td>
              ) : null}
              <td className="whitespace-nowrap px-1.5 py-0.5 pr-3 text-foreground">
                {row.timeLabel}
                {row.hasFormattedTimeRange && locale === "de" ? (
                  <span className="text-[10px] font-normal"> Uhr</span>
                ) : null}
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
                className={cn(
                  "whitespace-nowrap px-1.5 py-0.5 pr-3 text-center font-medium tabular-nums",
                  bulkStaffingStatusClass(row.met)
                )}
              >
                {row.assigned}/{row.required}
              </td>
              <td className="whitespace-nowrap px-1.5 py-0.5 text-center font-medium tabular-nums text-black">
                {row.totalAssigned}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const BULK_SHIFT_TABLE_CELL_CLASS =
  "min-w-0 overflow-hidden px-1 py-1.5 align-middle";
const BULK_SHIFT_ROW_CONTROL_HEIGHT_CLASS = "h-[30px]";
const BULK_SHIFT_TABLE_COMBO_ROOT_CLASS =
  `${BULK_SHIFT_ROW_CONTROL_HEIGHT_CLASS} w-full min-w-0`;
const BULK_SHIFT_TIME_INPUT_CLASS =
  "box-border h-[30px] min-h-[30px] max-h-[30px] w-full min-w-0 select-text py-0 leading-[30px] tabular-nums";
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
  | {
      kind: "alert";
      message: string;
      blocking?: boolean;
      refreshOnDismiss?: boolean;
    }
  | { kind: "confirm-add-row" };

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

function bulkRowPatchDiff(
  row: BulkRow,
  patch: Partial<BulkRow>
): Partial<BulkRow> {
  const changed: Partial<BulkRow> = {};
  for (const [key, value] of Object.entries(patch) as [
    keyof BulkRow,
    BulkRow[keyof BulkRow],
  ][]) {
    if (row[key] !== value) {
      (changed as Record<string, unknown>)[key as string] = value;
    }
  }
  return changed;
}

function joinStableIds(ids: readonly string[]): string {
  return ids.join("\0");
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

  const unsavedRows = listUnsavedBulkShiftRows(rows);
  if (
    unsavedRows.length > 0 &&
    listSaveableNewBulkShiftRows(rows).length === 0
  ) {
    return {
      valid: false,
      summary: translate("dashboard.bulkShiftValidationNoCompleteRows"),
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
  return sortBulkShiftRows(
    existingAreaShifts.map((shift) => ({
      ...createBulkRowFromExistingShift(shift, options),
      employeeName: "",
    }))
  );
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
  columnPrefill: BulkShiftColumnPrefs["prefill"];
  isCurrentRow?: boolean;
  onActivate?: () => void;
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
  columnPrefill,
  isCurrentRow = false,
  onActivate,
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
      row.id,
      row.startTime,
      row.endTime,
      row.requestedStartTime,
      row.requestedEndTime,
      row.demandServiceHourId,
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

  const matchingEmployeeIdsKey = useMemo(
    () => joinStableIds(matchingEmployees.map((employee) => employee.id)),
    [matchingEmployees]
  );

  const rowQualificationOptionIdsKey = useMemo(
    () => joinStableIds(rowQualificationOptions.map((option) => option.id)),
    [rowQualificationOptions]
  );

  const rowAssignmentPresetIdsKey = useMemo(
    () => joinStableIds(rowAssignmentPresets.map((preset) => preset.id)),
    [rowAssignmentPresets]
  );

  useEffect(() => {
    const isNewRow = !row.existingShiftId;
    const skipTypeFromTimesSync = skipSyncRef.current;
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
    }

    if (!isNewRow) return;

    if (!requestTimesComplete && row.demandServiceHourId) {
      const hourTimes = personalbedarfTimesForServiceHour(
        serviceHours,
        row.demandServiceHourId
      );
      if (
        hourTimes &&
        areDashboardShiftTimesComplete(hourTimes.startTime, hourTimes.endTime)
      ) {
        const restorePatch = bulkRowPatchDiff(row, {
          startTime: hourTimes.startTime,
          endTime: hourTimes.endTime,
          requestedStartTime: hourTimes.startTime,
          requestedEndTime: hourTimes.endTime,
        });
        if (Object.keys(restorePatch).length > 0) {
          onChange(restorePatch);
          return;
        }
      }
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
      const incompletePatch = bulkRowPatchDiff(row, patch);
      if (Object.keys(incompletePatch).length > 0) onChange(incompletePatch);
      return;
    }

    const patch: Partial<BulkRow> = {};
    if (
      !skipTypeFromTimesSync &&
      !row.shiftTypeManuallySelected &&
      columnPrefill.template
    ) {
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
      columnPrefill.template &&
      row.shiftTypeId &&
      !rowAssignmentPresets.some((preset) => preset.id === row.shiftTypeId)
    ) {
      patch.shiftTypeId = "";
    }

    let nextEmployeeId = row.employeeId;
    if (!row.employeeManuallySelected && columnPrefill.employee) {
      const preferred = pickEmployeeLongestWithoutShift(matchingEmployees);
      nextEmployeeId = preferred?.id ?? DASHBOARD_EMPTY_EMPLOYEE_ID;
      if (nextEmployeeId !== row.employeeId) {
        patch.employeeId = nextEmployeeId;
        if (columnPrefill.qualification) {
          patch.qualificationManuallySelected = false;
        }
      }
    }

    const effectiveEmployeeId = patch.employeeId ?? row.employeeId;

    if (!row.qualificationManuallySelected && columnPrefill.qualification) {
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
      profileQualificationIds.size > 0 &&
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

    const changedPatch = bulkRowPatchDiff(row, patch);
    if (Object.keys(changedPatch).length > 0) onChange(changedPatch);
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
    row.existingShiftId,
    row.demandServiceHourId,
    assignmentPresets,
    areaQualifications,
    timesComplete,
    requestTimesComplete,
    requestWindow.startTime,
    requestWindow.endTime,
    matchingEmployeeIdsKey,
    profileQualificationIds,
    rowQualificationOptionIdsKey,
    rowAssignmentPresetIdsKey,
    columnPrefill.template,
    columnPrefill.employee,
    columnPrefill.qualification,
    serviceHours,
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
    const isNewRow = !row.existingShiftId;
    const patch: Partial<BulkRow> = {
      [field]: value,
      employeeManuallySelected: isNewRow ? !columnPrefill.employee : true,
      shiftTypeManuallySelected: isNewRow ? !columnPrefill.template : true,
      qualificationManuallySelected: isNewRow ? !columnPrefill.qualification : true,
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
    <tr
      {...bulkShiftRowAttrs(row.id)}
      className={cn(
        "border-b border-border/60",
        isCurrentRow && "[&>td]:bg-primary/10"
      )}
      onMouseDown={(event) => {
        if (disabled || event.button !== 0) return;
        onActivate?.();
      }}
      onFocusCapture={() => {
        if (!disabled) onActivate?.();
      }}
    >
      <td
        className={settingsIndicatorCellClass(isCurrentRow)}
        aria-current={isCurrentRow ? "true" : undefined}
      >
        {isCurrentRow ? (
          <span className="sr-only">{t("dashboard.bulkShiftCurrentRow")}</span>
        ) : null}
      </td>
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
            const isNewRow = !row.existingShiftId;
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
                employeeManuallySelected: isNewRow ? !columnPrefill.employee : true,
                shiftTypeManuallySelected: false,
                qualificationManuallySelected: isNewRow
                  ? !columnPrefill.qualification
                  : true,
              });
            } else {
              onChange({
                shiftTypeId: nextId,
                employeeManuallySelected: isNewRow ? !columnPrefill.employee : true,
                shiftTypeManuallySelected: true,
                qualificationManuallySelected: isNewRow
                  ? !columnPrefill.qualification
                  : true,
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
            const isNewRow = !row.existingShiftId;
            const patch: Partial<BulkRow> = {
              employeeId,
              employeeManuallySelected: true,
              qualificationManuallySelected: isNewRow
                ? !columnPrefill.qualification
                : row.qualificationManuallySelected,
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
      <td className="w-10 shrink-0 px-1 py-1.5 align-middle">
        <div
          className={cn(
            "flex items-center justify-center",
            BULK_SHIFT_ROW_CONTROL_HEIGHT_CLASS
          )}
        >
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
  const [profileShiftPreferences, setProfileShiftPreferences] = useState<
    Record<string, ProfileShiftPreferenceEntry[]>
  >({});
  const [columnPrefs, setColumnPrefs] = useState<BulkShiftColumnPrefs>(() =>
    loadBulkShiftColumnPrefs()
  );
  const [countryCode, setCountryCode] = useState("DE");
  const [timeZone, setTimeZone] = useState(DEFAULT_ORGANIZATION_TIME_ZONE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState<BulkModalPrompt | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(() =>
    resolveBulkShiftRowIdForShiftFocus([], dialog.focusShiftId)
  );
  const pendingFocusShiftIdRef = useRef(dialog.focusShiftId);

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

  const staffingSpeedActionsActive = useMemo(
    () =>
      isBulkShiftStaffingSpeedModeActive(columnPrefs.prefill) &&
      bulkStaffingTableRowsSupportSpeedActions(staffingTableRows),
    [columnPrefs.prefill, staffingTableRows]
  );

  useEffect(() => {
    setActiveRowId((current) => {
      if (current && rows.some((row) => row.id === current)) return current;
      const focusRowId = resolveBulkShiftRowIdForShiftFocus(
        rows,
        dialog.focusShiftId
      );
      if (focusRowId) return focusRowId;
      return resolveCurrentBulkShiftRowId(rows, staffingEntries);
    });
  }, [rows, staffingEntries, dialog.focusShiftId]);

  useLayoutEffect(() => {
    const focusShiftId = pendingFocusShiftIdRef.current;
    if (!focusShiftId || loading) return;

    const rowId = resolveBulkShiftRowIdForShiftFocus(rows, focusShiftId);
    if (!rowId) return;

    pendingFocusShiftIdRef.current = undefined;
    setActiveRowId(rowId);
    scheduleScrollBulkShiftRowIntoView(scrollContainerRef, rowId);
  }, [rows, loading, dialog.focusShiftId]);

  const employeeNameById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.full_name])),
    [employees]
  );

  const effectiveAreaExistingAssignments = useMemo(
    () => resolveRemainingAreaAssignments(existingAreaShifts, rows),
    [existingAreaShifts, rows]
  );

  const effectiveLocationDayAssignments = useMemo(
    () =>
      filterLocationDayAssignmentsForBulkModal(
        locationDayAssignments,
        existingAreaShifts,
        rows,
        dialog.areaId
      ),
    [locationDayAssignments, existingAreaShifts, rows, dialog.areaId]
  );

  const deletedExistingShiftIds = useMemo(
    () => resolveBulkShiftDeletedIds(existingAreaShifts, rows),
    [existingAreaShifts, rows]
  );

  const presetNameById = useMemo(
    () => new Map(assignmentPresets.map((preset) => [preset.id, preset.name])),
    [assignmentPresets]
  );

  const qualificationNameById = useMemo(
    () => new Map(qualifications.map((qualification) => [qualification.id, qualification.name])),
    [qualifications]
  );

  const rowsById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);

  const displayRows = useMemo(() => {
    if (!columnPrefs.sort.column || !columnPrefs.sort.direction) return rows;
    return sortBulkShiftRowsByColumn(
      rows.map((row) => ({
        ...row,
        shiftTypeName: presetNameById.get(row.shiftTypeId) ?? "",
        qualificationName: qualificationNameById.get(row.qualificationId) ?? "",
        employeeName: employeeNameById.get(row.employeeId) ?? "",
      })),
      columnPrefs.sort.column,
      columnPrefs.sort.direction
    );
  }, [
    rows,
    columnPrefs.sort.column,
    columnPrefs.sort.direction,
    presetNameById,
    qualificationNameById,
    employeeNameById,
  ]);

  const handleColumnPrefsChange = useCallback((next: BulkShiftColumnPrefs) => {
    setColumnPrefs(next);
    saveBulkShiftColumnPrefs(next);
  }, []);

  const columnHeaderLabels = useMemo(
    () => ({
      template: t("dashboard.bulkShiftTemplate"),
      qualification: t("dashboard.bulkShiftQualification"),
      startTime: t("dashboard.bulkShiftFrom"),
      endTime: t("dashboard.bulkShiftTo"),
      employee: t("dashboard.bulkShiftEmployee"),
    }),
    [t]
  );

  const sortLabelForColumn = useCallback(
    (column: keyof typeof columnHeaderLabels) =>
      t("dashboard.bulkShiftSortColumn", { column: columnHeaderLabels[column] }),
    [columnHeaderLabels, t]
  );

  const prefillLabelForColumn = useCallback(
    (column: keyof typeof columnHeaderLabels) =>
      t("dashboard.bulkShiftPrefillColumn", { column: columnHeaderLabels[column] }),
    [columnHeaderLabels, t]
  );

  const prefillActiveLabelForColumn = useCallback(
    (column: keyof typeof columnHeaderLabels) =>
      t("dashboard.bulkShiftPrefillActive", { column: columnHeaderLabels[column] }),
    [columnHeaderLabels, t]
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
        setProfileShiftPreferences({});
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
        setProfileShiftPreferences(result.profileShiftPreferences);
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
    setActiveRowId(id);
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }, []);

  const deleteRow = useCallback((id: string) => {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === id);
      if (index === -1) return current;

      const next = [...current];
      next.splice(index, 1);
      return next;
    });
  }, []);

  const appendPrefilledBulkRow = useCallback(
    (targetDemand?: { serviceHourId: string; qualificationId: string }) => {
      if (rows.length >= MAX_ROWS) {
        setPrompt({
          kind: "alert",
          message: t("dashboard.bulkShiftMaxRows", { max: MAX_ROWS }),
        });
        return;
      }

      const previewRow = buildPrefilledBulkRow({
        existingRows: rows,
        prefill: columnPrefs.prefill,
        staffingEntries,
        serviceHours,
        assignmentPresets,
        staffingRules,
        areaId: dialog.areaId,
        weekday,
        dateISO: dialog.date,
        countryCode,
        timeZone,
        employees,
        profileQualificationIds,
        profileShiftPreferences,
        areaQualifications: areaStaffingQualificationOptions(
          staffingRules,
          dialog.areaId,
          qualifications
        ),
        areaExistingAssignments: effectiveAreaExistingAssignments,
        locationDayAssignments: effectiveLocationDayAssignments,
        emptyEmployeeId: DASHBOARD_EMPTY_EMPLOYEE_ID,
        createEmptyRow,
        targetDemand,
      });

      if (
        columnPrefs.prefill.employee &&
        previewRow.employeeId === DASHBOARD_EMPTY_EMPLOYEE_ID
      ) {
        setPrompt({
          kind: "alert",
          message: t("dashboard.bulkShiftNoEligibleEmployees"),
        });
        return;
      }

      let scrollRowId: string | undefined;
      setRows((current) => {
        if (current.length >= MAX_ROWS) return current;
        const newRow = buildPrefilledBulkRow({
          existingRows: current,
          prefill: columnPrefs.prefill,
          staffingEntries,
          serviceHours,
          assignmentPresets,
          staffingRules,
          areaId: dialog.areaId,
          weekday,
          dateISO: dialog.date,
          countryCode,
          timeZone,
          employees,
          profileQualificationIds,
          profileShiftPreferences,
          areaQualifications: areaStaffingQualificationOptions(
            staffingRules,
            dialog.areaId,
            qualifications
          ),
          areaExistingAssignments: effectiveAreaExistingAssignments,
          locationDayAssignments: effectiveLocationDayAssignments,
          emptyEmployeeId: DASHBOARD_EMPTY_EMPLOYEE_ID,
          createEmptyRow,
          targetDemand,
        });
        scrollRowId = newRow.id;
        return insertBulkShiftRowInList(
          current,
          newRow,
          isBulkShiftEmployeeSortActive(
            columnPrefs.sort.column,
            columnPrefs.sort.direction
          )
        );
      });
      if (scrollRowId) {
        setActiveRowId(scrollRowId);
        scheduleScrollBulkShiftRowIntoView(scrollContainerRef, scrollRowId);
      }
    },
    [
      rows,
      t,
      columnPrefs.prefill,
      columnPrefs.sort.column,
      columnPrefs.sort.direction,
      staffingEntries,
      serviceHours,
      assignmentPresets,
      staffingRules,
      dialog.areaId,
      dialog.date,
      weekday,
      countryCode,
      timeZone,
      employees,
      profileQualificationIds,
      profileShiftPreferences,
      effectiveAreaExistingAssignments,
      effectiveLocationDayAssignments,
      qualifications,
    ]
  );

  const performAddRow = useCallback(() => {
    appendPrefilledBulkRow();
  }, [appendPrefilledBulkRow]);

  const performStaffingSpeedAdd = useCallback(
    (serviceHourId: string, qualificationId: string) => {
      appendPrefilledBulkRow({ serviceHourId, qualificationId });
    },
    [appendPrefilledBulkRow]
  );

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
          areaExistingAssignments: effectiveAreaExistingAssignments,
          locationDayAssignments: effectiveLocationDayAssignments,
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
      effectiveAreaExistingAssignments,
      effectiveLocationDayAssignments,
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

  const performSave = useCallback(
    async (rowsSnapshot: BulkRow[]) => {
      const hasDeletes = deletedExistingShiftIds.length > 0;
      const saveIntent = resolveBulkShiftSaveIntent(rowsSnapshot, hasDeletes);

      if (saveIntent.kind === "close-without-changes") {
        onClose();
        return;
      }

      if (saveIntent.kind === "reject-unsaved-incomplete") {
        setPrompt({
          kind: "alert",
          message: t("dashboard.bulkShiftValidationNoCompleteRows"),
          blocking: true,
        });
        return;
      }

      const saveableRows = saveIntent.saveableRows as BulkRow[];
      const newRows = listUnsavedBulkShiftRows(rowsSnapshot);
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
        effectiveAreaExistingAssignments,
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

      const payloadRows = sortBulkShiftRows(
        saveableRows.map((row) => ({
          ...row,
          employeeName:
            employees.find((e) => e.id === row.employeeId)?.full_name ?? "",
        }))
      ).map((row, payloadIndex) => ({ row, payloadIndex }));

      setSaving(true);
      setPrompt(null);

      const result = await assignShiftBatch({
        shiftDate: dialog.date,
        locationId,
        locationAreaId: dialog.areaId,
        deleteShiftIds: deletedExistingShiftIds,
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
      const expectedSaveCount = payloadRows.length;

      if (
        expectedSaveCount > 0 &&
        result.savedRowCount === 0 &&
        failed.length === 0
      ) {
        setPrompt({
          kind: "alert",
          message: t("dashboard.bulkShiftValidationNoCompleteRows"),
          blocking: true,
        });
        return;
      }

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

      const failedResults = failed.flatMap((entry) =>
        entry.ok ? [] : [{ rowIndex: entry.rowIndex, error: entry.error }]
      );

      const partialSaveOutcome = resolveBulkShiftPartialSaveOutcome({
        currentRows: rowsSnapshot,
        payloadRows,
        failedResults,
        resolveEmployeeName: (employeeId) =>
          employeeNameById.get(employeeId) ?? employeeId,
        createEmptyRow,
      });

      const saveFailures = partialSaveOutcome.failures.map((failure) => ({
        ...failure,
        error: translateActionError(failure.error, t),
      }));

      setRows(partialSaveOutcome.remainingRows as BulkRow[]);
      setPrompt({
        kind: "alert",
        message: formatBulkShiftPartialSaveMessage(saveFailures, t),
        refreshOnDismiss: result.undoAvailable,
      });
    },
    [
      employees,
      dialog.date,
      dialog.areaId,
      locationId,
      effectiveAreaExistingAssignments,
      deletedExistingShiftIds,
      employeeNameById,
      timeZone,
      onClose,
      onSaved,
      router,
      t,
    ]
  );

  const handleOk = useCallback(async () => {
    const validation = validateBulkShiftRowsForOk(rows, t);
    if (!validation.valid) {
      setPrompt({
        kind: "alert",
        message: validation.summary!,
        blocking: true,
      });
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
      effectiveLocationDayAssignments,
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

    await performSave(rows);
  }, [
    rows,
    t,
    serviceHours,
    dialog.areaId,
    dialog.date,
    performSave,
    countryCode,
    effectiveLocationDayAssignments,
    employeeNameById,
  ]);

  const dismissPrompt = useCallback(() => {
    if (!prompt) return;
    const refreshOnDismiss =
      prompt.kind === "alert" && prompt.refreshOnDismiss === true;
    setPrompt(null);
    if (refreshOnDismiss) {
      onSaved?.();
      router.refresh();
    }
  }, [prompt, onSaved, router]);

  const handlePromptConfirm = useCallback(() => {
    if (!prompt) return;
    if (prompt.kind === "confirm-add-row") {
      setPrompt(null);
      performAddRow();
    }
  }, [prompt, performAddRow]);

  const promptMessage =
    prompt?.kind === "alert"
      ? prompt.message
      : prompt?.kind === "confirm-add-row"
        ? t("dashboard.bulkShiftStaffingCoveredConfirm")
        : null;

  const promptIsConfirm = prompt?.kind === "confirm-add-row";

  const modalLocked = prompt?.kind === "alert" && prompt.blocking === true;

  const modalBusy = loading || saving;

  return (
    <div
      className={cn(dashboardModalBackdropClass(), modalBusy && "cursor-wait")}
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
          "select-none [&_input]:select-text",
          modalBusy && "cursor-wait",
          modalBusy && "[&_*]:!cursor-wait"
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
            <BulkShiftStaffingTable
              rows={staffingTableRows}
              locale={locale}
              showSpeedActions={staffingSpeedActionsActive}
              onSpeedAdd={performStaffingSpeedAdd}
              speedActionsDisabled={loading || saving}
            />
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
          <div
            ref={scrollContainerRef}
            className={cn(BULK_SHIFT_LIST_SCROLL_CLASS, settingsResponsiveTableWrapClass())}
          >
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-1" />
                <col style={{ width: BULK_SHIFT_COL_TEMPLATE }} />
                <col style={{ width: BULK_SHIFT_COL_QUALIFICATION }} />
                <col style={{ width: BULK_SHIFT_COL_TIME }} />
                <col style={{ width: BULK_SHIFT_COL_TIME }} />
                <col style={{ width: BULK_SHIFT_COL_EMPLOYEE }} />
                <col style={{ width: "2.5rem" }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="text-left text-xs text-muted">
                  <th className={settingsStickyIndicatorHeaderClass()} aria-hidden />
                  <th className="min-w-0 px-1 py-1.5">
                    <BulkShiftColumnHeader
                      label={presetColumnLabel}
                      sortColumn="template"
                      prefillColumn="template"
                      prefs={columnPrefs}
                      onPrefsChange={handleColumnPrefsChange}
                      sortColumnLabel={sortLabelForColumn("template")}
                      sortAscLabel={t("dashboard.bulkShiftSortAsc")}
                      sortDescLabel={t("dashboard.bulkShiftSortDesc")}
                      prefillLabel={prefillLabelForColumn("template")}
                      prefillActiveLabel={prefillActiveLabelForColumn("template")}
                    />
                  </th>
                  <th className="min-w-0 px-1 py-1.5">
                    <BulkShiftColumnHeader
                      label={t("dashboard.bulkShiftQualification")}
                      sortColumn="qualification"
                      prefillColumn="qualification"
                      prefs={columnPrefs}
                      onPrefsChange={handleColumnPrefsChange}
                      sortColumnLabel={sortLabelForColumn("qualification")}
                      sortAscLabel={t("dashboard.bulkShiftSortAsc")}
                      sortDescLabel={t("dashboard.bulkShiftSortDesc")}
                      prefillLabel={prefillLabelForColumn("qualification")}
                      prefillActiveLabel={prefillActiveLabelForColumn("qualification")}
                    />
                  </th>
                  <th className="px-1 py-1.5">
                    <BulkShiftColumnHeader
                      label={t("dashboard.bulkShiftFrom")}
                      sortColumn="startTime"
                      prefs={columnPrefs}
                      onPrefsChange={handleColumnPrefsChange}
                      sortColumnLabel={sortLabelForColumn("startTime")}
                      sortAscLabel={t("dashboard.bulkShiftSortAsc")}
                      sortDescLabel={t("dashboard.bulkShiftSortDesc")}
                      prefillLabel=""
                      prefillActiveLabel=""
                    />
                  </th>
                  <th className="px-1 py-1.5">
                    <BulkShiftColumnHeader
                      label={t("dashboard.bulkShiftTo")}
                      sortColumn="endTime"
                      prefs={columnPrefs}
                      onPrefsChange={handleColumnPrefsChange}
                      sortColumnLabel={sortLabelForColumn("endTime")}
                      sortAscLabel={t("dashboard.bulkShiftSortAsc")}
                      sortDescLabel={t("dashboard.bulkShiftSortDesc")}
                      prefillLabel=""
                      prefillActiveLabel=""
                    />
                  </th>
                  <th className="min-w-0 px-1 py-1.5">
                    <BulkShiftColumnHeader
                      label={t("dashboard.bulkShiftEmployee")}
                      sortColumn="employee"
                      prefillColumn="employee"
                      prefs={columnPrefs}
                      onPrefsChange={handleColumnPrefsChange}
                      sortColumnLabel={sortLabelForColumn("employee")}
                      sortAscLabel={t("dashboard.bulkShiftSortAsc")}
                      sortDescLabel={t("dashboard.bulkShiftSortDesc")}
                      prefillLabel={prefillLabelForColumn("employee")}
                      prefillActiveLabel={prefillActiveLabelForColumn("employee")}
                    />
                  </th>
                  <th className="px-1 py-1.5" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {displayRows.map((displayRow) => {
                  const row = rowsById.get(displayRow.id) ?? displayRow;
                  return (
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
                    areaExistingAssignments={effectiveAreaExistingAssignments}
                    locationDayAssignments={effectiveLocationDayAssignments}
                    allRows={rows}
                    profileQualificationIds={profileQualificationIds}
                    disabled={loading || saving}
                    onChange={(patch) => updateRow(row.id, patch)}
                    onDelete={() => deleteRow(row.id)}
                    presetPlaceholder={presetPlaceholder}
                    qualificationPlaceholder={qualificationPlaceholder}
                    columnPrefill={columnPrefs.prefill}
                    isCurrentRow={row.id === activeRowId}
                    onActivate={() => setActiveRowId(row.id)}
                  />
                  );
                })}
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
                dismissPrompt();
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
                className="whitespace-pre-line text-sm text-foreground"
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
                    onClick={dismissPrompt}
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
