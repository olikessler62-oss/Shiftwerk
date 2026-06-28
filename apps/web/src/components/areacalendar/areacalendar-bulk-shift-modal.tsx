"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchAreaCalendarBulkShiftContext,
  type AreaCalendarEmployeeAvailabilityEntry,
  type AreaCalendarShiftAssignEmployee,
} from "@/app/actions/areacalendar-shift-assign";
import { assignShiftBatch } from "@/app/actions/shifts";
import {
  AREA_CALENDAR_EMPTY_EMPLOYEE_ID,
  DASHBOARD_TABLE_COMBO_TRIGGER_CLASS,
  AreaCalendarQualificationCombobox,
  AreaCalendarShiftEmployeeCombobox,
  AreaCalendarShiftTypeCombobox,
  DASHBOARD_COMBO_EMPTY_LABEL,
  type AreaCalendarAddShiftDialogState,
  type AreaCalendarBulkShiftDialogState,
} from "@/components/areacalendar/areacalendar-add-shift-modal";
import { PlanningSidePanel, PlanningSidePanelNestedAlertPortal, PLANNING_SIDE_PANEL_FOOTER_CLASS } from "@/components/planning/planning-side-panel";
import {
  SettingsPrimaryActionButton,
  areaCalendarAlertDialogClass,
  areaCalendarNestedModalOverlayClass,
  PLANNING_SIDE_PANEL_SUBTITLE_CLASS,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  SettingsConfirmDialogCloseHeader,
  settingsIndicatorCellClass,
  settingsResponsiveTableWrapClass,
  settingsStickyIndicatorHeaderClass,
} from "@/components/settings/settings-list-ui";
import {
  Button,
  Alert,
  Checkbox,
  IconButton,
  PlusIcon,
  TimeInput,
  TrashIcon,
  BoltIcon,
  Tooltip,
} from "@/components/ui";
import {
  areAreaCalendarShiftTimesComplete,
  dedupeAreaCalendarAssignmentWindows,
  filterBulkShiftAssignEmployeesForRow,
  filterBulkShiftAssignEmployeesWithoutTimeWindow,
  profileAvailabilitiesForWeekday,
  profileAvailabilityWeekdayFromAreaCalendarDate,
  resolveShiftAssignmentRequestWindow,
} from "@/lib/available-employees-for-shift";
import {
  areaShiftTemplatesForArea,
  areaCalendarAssignmentPresetsForArea,
  filterAssignmentPresetsMatchingTimes,
  prefillBulkRowWithEarliestAssignmentPreset,
  resolvePresetShiftTemplateForDemandTimes,
  areaShiftTemplateIdForAssign,
  type AreaCalendarAssignmentPreset,
} from "@/lib/areacalendar-assignment-presets";
import { validateAreaCalendarShiftServiceHours } from "@/lib/service-hours-shift-validation";
import {
  presetQualificationForServiceHour,
  areaStaffingQualificationOptions,
  employeeAreaQualificationOptions,
  employeeProfileQualificationOptions,
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
import { buildPrefilledBulkRow, pickEmployeeForBulkPrefill } from "@/lib/bulk-shift-row-prefill";
import { isEmployeeWishFulfilled } from "@/lib/profile-shift-preference-matching";
import {
  filterEmployeesWithinWeeklyHoursForShift,
  weeklyHoursAssignContextForBulkShiftRow,
  type ShiftAssignWeekShiftRef,
} from "@/lib/shift-weekly-hours-validation-client";
import {
  insertBulkShiftRowInList,
  isBulkShiftEmployeeSortActive,
  partitionBulkShiftRows,
} from "@/lib/bulk-shift-row-insert";
import {
  buildBulkStaffingTableRows,
  bulkStaffingTableRowsSupportSpeedActions,
  isBulkShiftStaffingSpeedModeActive,
  type BulkStaffingTableRow,
} from "@/lib/bulk-shift-staffing-table";
import type { ProfileShiftPreferenceEntry } from "@/app/actions/areacalendar-shift-assign";
import { BulkShiftColumnHeader } from "@/components/areacalendar/bulk-shift-column-header";
import {
  isStaffingFullyCovered,
  personalbedarfDemandTimesForEntry,
  personalbedarfTimesForServiceHour,
  resolveNextOpenStaffingDemand,
  resolveCurrentBulkShiftRowId,
} from "@/lib/bulk-shift-staffing";
import {
  computeBulkStaffingHeaderEntries,
  type StaffingAssignmentRef,
} from "@/lib/bulk-staffing-header";
import {
  buildEmployeeWeeklyHoursTooltipLabels,
  formatDayHeader,
  weeklyAssignedMinutesByEmployeeId,
} from "@/lib/planning-utils";
import { hasRemainingAssignableWeekDates } from "@/lib/shift-assign-rest-of-week";
import {
  findServiceHourIdForShift,
  isAreaOpenOnDate,
  weekdayLabelFromIndex,
  type AreaServiceHourRef,
  type TagAreaHeaderStaffingEntry,
} from "@/lib/location-staffing-client";
import {
  findEmployeeWithOverlappingAreaCalendarAssignments,
  type AreaCalendarAssignmentTimeWindow,
} from "@/lib/shift-overlap";
import { cn } from "@/lib/cn";
import { translateActionError } from "@/lib/translate-action-error";
import {
  shiftAssignAlertPromptForError,
  shiftAssignAlertPromptHasBlockingFailure,
} from "@/lib/shift-assign-blocking-errors";
import { shiftCardAllowsBulkRowDelete } from "@/lib/shift-card-context-menu-actions";
import { useSimulatedProposedOnAssignRequest } from "@/lib/shift-confirmation-simulation-context";
import {
  resolveBulkShiftPartialSaveOutcome,
  type BulkShiftPartialSaveFailure,
} from "@/lib/bulk-shift-partial-save";
import { BulkShiftPartialSaveAlertContent } from "@/components/areacalendar/bulk-shift-partial-save-alert";
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
  listCompleteBulkShiftRowsForAssign,
  listSaveableNewBulkShiftRows,
  listUnsavedBulkShiftRows,
  resolveBulkShiftSaveIntent,
  shouldIncludeShiftInBulkEditExistingRows,
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
  return met ? "text-neutral-600" : "text-red-600";
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
        "w-full min-w-0 select-none rounded border border-border px-2 py-1.5",
        showSpeedActions && "sm:min-w-[30rem]"
      )}
    >
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-left text-[10px] font-medium text-muted">
            {showSpeedActions ? (
              <th className="w-8 px-0.5 pb-1 font-medium" aria-hidden />
            ) : null}
            <th className="whitespace-nowrap px-1.5 pb-1 pr-3 font-medium">
              {t("areaCalendar.bulkShiftStaffingTableShift")}
            </th>
            <th className="whitespace-nowrap px-1.5 pb-1 pr-3 font-medium">
              {t("areaCalendar.bulkShiftStaffingTableTime")}
            </th>
            <th className="whitespace-nowrap px-1.5 pb-1 pr-3 font-medium">
              {t("areaCalendar.bulkShiftStaffingTableQualification")}
            </th>
            <th className="whitespace-nowrap px-1.5 pb-1 pr-3 text-center font-medium">
              {t("areaCalendar.bulkShiftStaffingTableDemand")}
            </th>
            <th className="whitespace-nowrap px-1.5 pb-1 text-center font-medium">
              {t("areaCalendar.bulkShiftStaffingTableTotal")}
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
                          ? t("areaCalendar.bulkShiftStaffingSpeedTooltipCovered", {
                              job: row.qualificationName,
                              time: row.timeLabel,
                            })
                          : t("areaCalendar.bulkShiftStaffingSpeedTooltip", {
                              job: row.qualificationName,
                              time: row.timeLabel,
                            })
                      }
                      placement={{ side: "above", gapPx: 6 }}
                    >
                      <IconButton
                        size="sm"
                        disabled={row.met || speedActionsDisabled}
                        aria-label={t("areaCalendar.bulkShiftStaffingSpeedAdd", {
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
                {row.shiftLabel || "—"}
              </td>
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

export type { AreaCalendarBulkShiftDialogState } from "./areacalendar-add-shift-modal";

export type BulkModalExistingShift = {
  id: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  areaShiftTemplateId: string | null;
  confirmationStatus?: import("@schichtwerk/types").ShiftConfirmationStatus;
  requestedAt?: string | null;
};

type BulkModalPrompt =
  | {
      kind: "alert";
      message: string;
      blocking?: boolean;
      partialSaveFailures?: readonly BulkShiftPartialSaveFailure[];
    }
  | { kind: "confirm-add-row" }
  | { kind: "confirm-outside-service-hours" };

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
  dialog: AreaCalendarBulkShiftDialogState;
  locationId: string;
  locationName: string;
  showLocationName?: boolean;
  areas: LocationArea[];
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  staffingRules: LocationAreaStaffing[];
  serviceHours: AreaServiceHourRef[];
  qualifications: Qualification[];
  existingAreaShifts: BulkModalExistingShift[];
  areaExistingAssignments: AreaCalendarAssignmentTimeWindow[];
  locationDayAssignments: LocationDayAssignment[];
  weekDates: readonly string[];
  weekShifts: readonly ShiftAssignWeekShiftRef[];
  onClose: () => void;
  onSaved?: () => void;
};

function createEmptyRow(): BulkRow {
  return {
    id: crypto.randomUUID(),
    employeeId: AREA_CALENDAR_EMPTY_EMPLOYEE_ID,
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

function joinProfileQualificationIdsKey(
  profileQualificationIds: ReadonlyMap<string, ReadonlySet<string>>
): string {
  const parts: string[] = [];
  profileQualificationIds.forEach((qualificationIds, profileId) => {
    parts.push(`${profileId}:${joinStableIds([...qualificationIds].sort())}`);
  });
  return parts.sort().join("\0");
}

/** Verhindert Auto-Sync-Kaskaden auf fehlgeschlagenen, bereits gesendeten Zeilen. */
function freezeSubmittedBulkRowsAfterPartialSave(
  rows: readonly BulkRow[],
  submittedRowIds: ReadonlySet<string>
): BulkRow[] {
  return rows.map((row) => {
    if (!submittedRowIds.has(row.id)) return row;
    return {
      ...row,
      employeeManuallySelected:
        row.employeeId !== AREA_CALENDAR_EMPTY_EMPLOYEE_ID
          ? true
          : row.employeeManuallySelected,
      shiftTypeManuallySelected: row.shiftTypeId
        ? true
        : row.shiftTypeManuallySelected,
      qualificationManuallySelected: row.qualificationId
        ? true
        : row.qualificationManuallySelected,
    };
  });
}

type BulkRowValidationState = "empty" | "complete" | "incomplete";

function getBulkRowValidationState(row: BulkRow): BulkRowValidationState {
  const hasEmployee = row.employeeId !== AREA_CALENDAR_EMPTY_EMPLOYEE_ID;
  const timesComplete = areAreaCalendarShiftTimesComplete(
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

  const hasEmployee = row.employeeId !== AREA_CALENDAR_EMPTY_EMPLOYEE_ID;
  const timesComplete = areAreaCalendarShiftTimesComplete(
    row.startTime,
    row.endTime
  );
  const hasQualification = row.qualificationId.length > 0;

  if (!hasEmployee && timesComplete) {
    return translate("areaCalendar.bulkShiftValidationEmployeeRequired");
  }
  if (hasEmployee && !timesComplete) {
    return translate("areaCalendar.bulkShiftValidationTimesRequired");
  }
  if (hasEmployee && timesComplete && !hasQualification) {
    return translate("areaCalendar.bulkShiftValidationQualificationRequired");
  }
  return translate("areaCalendar.bulkShiftValidationEmployeeOrTimesRequired");
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
          ? translate("areaCalendar.bulkShiftValidationNoCompleteRows")
          : translate("areaCalendar.bulkShiftValidationIncomplete"),
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
      summary: translate("areaCalendar.bulkShiftValidationNoCompleteRows"),
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
      summary: translate("areaCalendar.bulkShiftValidationIncomplete"),
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
  areaExistingAssignments: AreaCalendarAssignmentTimeWindow[],
  rows: BulkRow[],
  excludeRowId: string
): AreaCalendarAssignmentTimeWindow[] {
  const fromRows = rows.flatMap((row) => {
    if (row.id === excludeRowId) return [];
    if (row.employeeId === AREA_CALENDAR_EMPTY_EMPLOYEE_ID) return [];
    if (!areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)) return [];
    return [
      {
        employeeId: row.employeeId,
        startTime: row.startTime,
        endTime: row.endTime,
      },
    ];
  });
  return dedupeAreaCalendarAssignmentWindows([...areaExistingAssignments, ...fromRows]);
}

function otherAreaAssignmentsForBulkRow(
  locationDayAssignments: LocationDayAssignment[],
  areaId: string
): AreaCalendarAssignmentTimeWindow[] {
  return locationDayAssignments
    .filter(
      (assignment) =>
        assignment.locationAreaId !== areaId &&
        areAreaCalendarShiftTimesComplete(assignment.startTime, assignment.endTime)
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
    | "employeeId"
    | "existingShiftId"
    | "startTime"
    | "endTime"
    | "requestedStartTime"
    | "requestedEndTime"
    | "demandServiceHourId"
  >,
  options: {
    employees: AreaCalendarShiftAssignEmployee[];
    weekday: number;
    dateISO: string;
    areaId: string;
    countryCode: string;
    timeZone: string;
    staffingRules: LocationAreaStaffing[];
    areaQualifications: StaffingQualificationOption[];
    profileQualificationIds: Map<string, Set<string>>;
    areaExistingAssignments: AreaCalendarAssignmentTimeWindow[];
    locationDayAssignments: LocationDayAssignment[];
    allRows: BulkRow[];
    weekShifts: readonly ShiftAssignWeekShiftRef[];
    withoutServiceHours?: boolean;
  }
): AreaCalendarShiftAssignEmployee[] {
  const requestWindow = resolveShiftAssignmentRequestWindow(row);
  const requestTimesComplete = areAreaCalendarShiftTimesComplete(
    requestWindow.startTime,
    requestWindow.endTime
  );
  if (options.withoutServiceHours && !requestTimesComplete) {
    return filterBulkShiftAssignEmployeesWithoutTimeWindow(
      options.employees,
      options.weekday
    );
  }
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

  const assignContextForEmployee = weeklyHoursAssignContextForBulkShiftRow({
    row,
    allRows: options.allRows,
    shiftDate: options.dateISO,
    emptyEmployeeId: AREA_CALENDAR_EMPTY_EMPLOYEE_ID,
  });
  const withinWeeklyHours = filterEmployeesWithinWeeklyHoursForShift(byWindow, {
    weekShifts: options.weekShifts,
    shiftDate: options.dateISO,
    startTime,
    endTime,
    timeZone: options.timeZone,
    assignContextForEmployee,
  });

  if (options.withoutServiceHours) {
    return withinWeeklyHours;
  }
  const demandQualificationIds = staffingQualificationIdsForServiceHour(
    options.staffingRules,
    options.areaId,
    row.demandServiceHourId
  );
  if (demandQualificationIds.size > 0) {
    return filterEmployeesWithAnyQualificationInSet(
      withinWeeklyHours,
      demandQualificationIds,
      options.profileQualificationIds
    );
  }
  return filterEmployeesWithAnyAreaQualification(
    withinWeeklyHours,
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
  assignmentPresets: AreaCalendarAssignmentPreset[],
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
    if (row.employeeId === AREA_CALENDAR_EMPTY_EMPLOYEE_ID) return [];
    if (!areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)) return [];
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
    assignmentPresets: AreaCalendarAssignmentPreset[];
    staffingRules: LocationAreaStaffing[];
    areaId: string;
    dateISO: string;
    withoutServiceHours?: boolean;
  }
): BulkRow {
  const startTime = timeFieldValue(shift.startTime);
  const endTime = timeFieldValue(shift.endTime);
  const serviceHourId = options.withoutServiceHours
    ? null
    : findServiceHourIdForShift(
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
    qualificationId: options.withoutServiceHours
      ? ""
      : presetQualificationForServiceHour(
          options.staffingRules,
          options.areaId,
          serviceHourId
        ),
    shiftTypeId,
    startTime,
    endTime,
    requestedStartTime: startTime,
    requestedEndTime: endTime,
    demandServiceHourId: options.withoutServiceHours
      ? undefined
      : serviceHourId ?? undefined,
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
    assignmentPresets: AreaCalendarAssignmentPreset[];
    qualifications: Qualification[];
    formatTimeLabel: (
      weekdayLabel: string,
      startTime: string,
      endTime: string
    ) => string;
    weekdayLabel: (weekday: number) => string;
    withoutServiceHours?: boolean;
  }
): BulkRow[] {
  const editableExistingShifts = existingAreaShifts.filter((shift) =>
    shouldIncludeShiftInBulkEditExistingRows(shift)
  );

  return sortBulkShiftRows(
    editableExistingShifts.map((shift) => ({
      ...createBulkRowFromExistingShift(shift, options),
      employeeName: "",
    }))
  );
}

function createPresetBulkRow(
  staffingEntries: TagAreaHeaderStaffingEntry[],
  serviceHours: AreaServiceHourRef[],
  assignmentPresets: AreaCalendarAssignmentPreset[],
  staffingRules: LocationAreaStaffing[],
  areaId: string,
  existingRows: BulkRow[] = [],
  withoutServiceHours = false
): BulkRow {
  if (withoutServiceHours) {
    const row: BulkRow = {
      ...createEmptyRow(),
      employeeManuallySelected: false,
      shiftTypeManuallySelected: false,
      qualificationManuallySelected: false,
    };
    prefillBulkRowWithEarliestAssignmentPreset(row, assignmentPresets);
    return row;
  }
  const openDemand = resolveNextOpenStaffingDemand(
    staffingEntries,
    serviceHours,
    existingRows,
    {
      staffingRules,
      areaId,
    }
  );
  const targetEntry = openDemand
    ? (staffingEntries.find(
        (entry) => entry.serviceHourId === openDemand.serviceHourId
      ) ?? null)
    : null;
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
  const demandTimesComplete = areAreaCalendarShiftTimesComplete(startTime, endTime);
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
    qualificationId:
      openDemand?.qualificationId ||
      presetQualificationForServiceHour(
        staffingRules,
        areaId,
        demand?.serviceHourId || targetEntry?.serviceHourId
      ),
    employeeManuallySelected: false,
    shiftTypeManuallySelected: false,
    qualificationManuallySelected: false,
  };
}

type BulkShiftRowEditorProps = {
  row: BulkRow;
  weekday: number;
  areaId: string;
  locationId: string;
  employees: AreaCalendarShiftAssignEmployee[];
  assignmentPresets: AreaCalendarAssignmentPreset[];
  areaQualifications: StaffingQualificationOption[];
  staffingRules: LocationAreaStaffing[];
  serviceHours: AreaServiceHourRef[];
  qualifications: Qualification[];
  dateISO: string;
  countryCode: string;
  timeZone: string;
  areaExistingAssignments: AreaCalendarAssignmentTimeWindow[];
  locationDayAssignments: LocationDayAssignment[];
  allRows: BulkRow[];
  weekShifts: readonly ShiftAssignWeekShiftRef[];
  weeklyHoursLineByEmployeeId?: ReadonlyMap<string, string>;
  profileQualificationIds: Map<string, Set<string>>;
  profileShiftPreferences: Record<string, ProfileShiftPreferenceEntry[]>;
  withoutServiceHours?: boolean;
  onChange: (patch: Partial<BulkRow>) => void;
  onSyncChange: (patch: Partial<BulkRow>) => void;
  onDelete: () => void;
  showDeleteButton?: boolean;
  disabled?: boolean;
  presetPlaceholder: string;
  qualificationPlaceholder: string;
  columnPrefill: BulkShiftColumnPrefs["prefill"];
  isCurrentRow?: boolean;
  onActivate?: () => void;
};

function BulkShiftSectionHeader({ label }: { label: string }) {
  return (
    <tr className="border-y border-border bg-subtle/70">
      <td
        colSpan={7}
        className="px-3 py-2 text-xs font-semibold tracking-wide text-foreground"
      >
        {label}
      </td>
    </tr>
  );
}

function sortBulkShiftDisplayRows(
  rows: BulkRow[],
  columnPrefs: BulkShiftColumnPrefs,
  presetNameById: ReadonlyMap<string, string>,
  qualificationNameById: ReadonlyMap<string, string>,
  employeeNameById: ReadonlyMap<string, string>
): BulkRow[] {
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
}

function BulkShiftRowEditor({
  row,
  weekday,
  areaId,
  locationId,
  employees,
  assignmentPresets,
  areaQualifications,
  staffingRules,
  serviceHours,
  qualifications,
  dateISO,
  countryCode,
  timeZone,
  areaExistingAssignments,
  locationDayAssignments,
  allRows,
  weekShifts,
  weeklyHoursLineByEmployeeId,
  profileQualificationIds,
  profileShiftPreferences,
  withoutServiceHours = false,
  onChange,
  onSyncChange,
  onDelete,
  showDeleteButton = true,
  disabled = false,
  presetPlaceholder,
  qualificationPlaceholder,
  columnPrefill,
  isCurrentRow = false,
  onActivate,
}: BulkShiftRowEditorProps) {
  const t = useTranslations();
  const qualificationNameById = useMemo(
    () =>
      new Map(
        qualifications.map((qualification) => [qualification.id, qualification.name])
      ),
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
  const skipSyncRef = useRef(false);
  const timesComplete = areAreaCalendarShiftTimesComplete(row.startTime, row.endTime);
  const requestWindow = resolveShiftAssignmentRequestWindow(row);
  const requestTimesComplete = areAreaCalendarShiftTimesComplete(
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
        weekShifts,
        withoutServiceHours,
      }),
    [
      row.id,
      row.employeeId,
      row.existingShiftId,
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
      weekShifts,
      withoutServiceHours,
    ]
  );

  const rowQualificationOptions = useMemo(
    () =>
      withoutServiceHours
        ? employeeProfileQualificationOptions(
            row.employeeId,
            qualifications,
            profileQualificationIds,
            AREA_CALENDAR_EMPTY_EMPLOYEE_ID
          )
        : employeeAreaQualificationOptions(
            row.employeeId,
            areaQualifications,
            profileQualificationIds,
            AREA_CALENDAR_EMPTY_EMPLOYEE_ID
          ),
    [
      withoutServiceHours,
      row.employeeId,
      qualifications,
      areaQualifications,
      profileQualificationIds,
    ]
  );

  const rowAssignmentPresets = useMemo(() => {
    if (withoutServiceHours) {
      return assignmentPresets;
    }
    if (!requestTimesComplete) return [];
    return filterAssignmentPresetsMatchingTimes(
      requestWindow.startTime,
      requestWindow.endTime,
      assignmentPresets
    );
  }, [
    assignmentPresets,
    withoutServiceHours,
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

  const areaQualificationIdsKey = useMemo(
    () => joinStableIds(areaQualifications.map((option) => option.id)),
    [areaQualifications]
  );
  const assignmentPresetsSyncKey = useMemo(
    () =>
      assignmentPresets
        .map((preset) => `${preset.id}:${preset.start_time}:${preset.end_time}`)
        .join("\0"),
    [assignmentPresets]
  );
  const serviceHoursSyncKey = useMemo(
    () =>
      serviceHours
        .map((hour) => `${hour.id}:${hour.start_time}:${hour.end_time}`)
        .join("\0"),
    [serviceHours]
  );
  const profileQualificationIdsKey = useMemo(
    () => joinProfileQualificationIdsKey(profileQualificationIds),
    [profileQualificationIds]
  );
  const profileShiftPreferencesKey = useMemo(
    () => JSON.stringify(profileShiftPreferences),
    [profileShiftPreferences]
  );

  useEffect(() => {
    const isNewRow = !row.existingShiftId;
    const skipTypeFromTimesSync = skipSyncRef.current;
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
    }

    if (!isNewRow) return;

    if (
      !withoutServiceHours &&
      !requestTimesComplete &&
      row.demandServiceHourId
    ) {
      const hourTimes = personalbedarfTimesForServiceHour(
        serviceHours,
        row.demandServiceHourId
      );
      if (
        hourTimes &&
        areAreaCalendarShiftTimesComplete(hourTimes.startTime, hourTimes.endTime)
      ) {
        const restorePatch = bulkRowPatchDiff(row, {
          startTime: hourTimes.startTime,
          endTime: hourTimes.endTime,
          requestedStartTime: hourTimes.startTime,
          requestedEndTime: hourTimes.endTime,
        });
        if (Object.keys(restorePatch).length > 0) {
          onSyncChange(restorePatch);
          return;
        }
      }
    }

    if (!requestTimesComplete) {
      if (withoutServiceHours && !row.shiftTypeManuallySelected && !row.shiftTypeId) {
        const earliestPatch: Partial<BulkRow> = {};
        const draft = { ...row, ...earliestPatch };
        if (prefillBulkRowWithEarliestAssignmentPreset(draft, assignmentPresets)) {
          onSyncChange(
            bulkRowPatchDiff(row, {
              shiftTypeId: draft.shiftTypeId,
              startTime: draft.startTime,
              endTime: draft.endTime,
              requestedStartTime: draft.requestedStartTime,
              requestedEndTime: draft.requestedEndTime,
            })
          );
          return;
        }
      }

      const patch: Partial<BulkRow> = {};
      if (!withoutServiceHours && row.shiftTypeId) patch.shiftTypeId = "";
      if (
        !row.employeeManuallySelected &&
        row.employeeId !== AREA_CALENDAR_EMPTY_EMPLOYEE_ID
      ) {
        patch.employeeId = AREA_CALENDAR_EMPTY_EMPLOYEE_ID;
      }
      if (row.qualificationId) patch.qualificationId = "";
      const incompletePatch = bulkRowPatchDiff(row, patch);
      if (Object.keys(incompletePatch).length > 0) onSyncChange(incompletePatch);
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
      const { employee: preferred } = pickEmployeeForBulkPrefill(
        matchingEmployees,
        {
          weekday,
          demandStart: requestWindow.startTime,
          demandEnd: requestWindow.endTime,
          areaId,
          locationId,
          qualificationId: row.qualificationId || null,
        },
        profileShiftPreferences
      );
      nextEmployeeId = preferred?.id ?? AREA_CALENDAR_EMPTY_EMPLOYEE_ID;
      if (nextEmployeeId !== row.employeeId) {
        patch.employeeId = nextEmployeeId;
        if (columnPrefill.qualification) {
          patch.qualificationManuallySelected = false;
        }
      }
    }

    const effectiveEmployeeId = patch.employeeId ?? row.employeeId;
    const effectiveQualificationOptions = withoutServiceHours
      ? employeeProfileQualificationOptions(
          effectiveEmployeeId,
          qualifications,
          profileQualificationIds,
          AREA_CALENDAR_EMPTY_EMPLOYEE_ID
        )
      : employeeAreaQualificationOptions(
          effectiveEmployeeId,
          areaQualifications,
          profileQualificationIds,
          AREA_CALENDAR_EMPTY_EMPLOYEE_ID
        );
    const effectiveQualificationOptionsForPrefill = withoutServiceHours
      ? effectiveQualificationOptions
      : areaQualifications;

    if (!row.qualificationManuallySelected && columnPrefill.qualification) {
      const nextQualificationId = resolvePresetQualificationForEmployee(
        effectiveEmployeeId,
        effectiveQualificationOptionsForPrefill,
        profileQualificationIds,
        AREA_CALENDAR_EMPTY_EMPLOYEE_ID,
        row.qualificationId
      );
      if (nextQualificationId !== row.qualificationId) {
        patch.qualificationId = nextQualificationId;
      }
    } else if (
      profileQualificationIds.size > 0 &&
      row.qualificationId &&
      effectiveEmployeeId !== AREA_CALENDAR_EMPTY_EMPLOYEE_ID &&
      !effectiveQualificationOptions.some(
        (option) => option.id === row.qualificationId
      )
    ) {
      patch.qualificationId = "";
      patch.qualificationManuallySelected = false;
    }

    if (
      patch.employeeId !== undefined &&
      patch.employeeId !== AREA_CALENDAR_EMPTY_EMPLOYEE_ID &&
      requestTimesComplete
    ) {
      if (row.startTime !== requestWindow.startTime) {
        patch.startTime = requestWindow.startTime;
      }
      if (row.endTime !== requestWindow.endTime) {
        patch.endTime = requestWindow.endTime;
      }
      if (row.requestedStartTime !== requestWindow.startTime) {
        patch.requestedStartTime = requestWindow.startTime;
      }
      if (row.requestedEndTime !== requestWindow.endTime) {
        patch.requestedEndTime = requestWindow.endTime;
      }
    }

    const changedPatch = bulkRowPatchDiff(row, patch);
    if (Object.keys(changedPatch).length > 0) onSyncChange(changedPatch);
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
    areaQualificationIdsKey,
    assignmentPresetsSyncKey,
    withoutServiceHours,
    timesComplete,
    requestTimesComplete,
    requestWindow.startTime,
    requestWindow.endTime,
    matchingEmployeeIdsKey,
    rowQualificationOptionIdsKey,
    rowAssignmentPresetIdsKey,
    columnPrefill.template,
    columnPrefill.employee,
    columnPrefill.qualification,
    profileQualificationIdsKey,
    profileShiftPreferencesKey,
    serviceHoursSyncKey,
    qualifications,
  ]);

  const selectedEmployee = useMemo(
    () =>
      row.employeeId === AREA_CALENDAR_EMPTY_EMPLOYEE_ID
        ? null
        : employees.find((e) => e.id === row.employeeId) ?? null,
    [row.employeeId, employees]
  );

  const wishFulfilled = useMemo(() => {
    if (
      row.employeeId === AREA_CALENDAR_EMPTY_EMPLOYEE_ID ||
      !requestTimesComplete
    ) {
      return true;
    }
    return isEmployeeWishFulfilled(
      row.employeeId,
      {
        weekday,
        demandStart: requestWindow.startTime,
        demandEnd: requestWindow.endTime,
        areaId,
        locationId,
        qualificationId: row.qualificationId || null,
      },
      profileShiftPreferences
    );
  }, [
    row.employeeId,
    row.qualificationId,
    requestTimesComplete,
    requestWindow.startTime,
    requestWindow.endTime,
    weekday,
    areaId,
    locationId,
    profileShiftPreferences,
  ]);

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

  const handleApplyAvailability = (entry: AreaCalendarEmployeeAvailabilityEntry) => {
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
          <span className="sr-only">{t("areaCalendar.bulkShiftCurrentRow")}</span>
        ) : null}
      </td>
      <td className={BULK_SHIFT_TABLE_CELL_CLASS}>
        <AreaCalendarShiftTypeCombobox
          value={row.shiftTypeId}
          presets={rowAssignmentPresets}
          placeholder={presetPlaceholder}
          disabled={disabled || rowAssignmentPresets.length === 0}
          rootClassName={BULK_SHIFT_TABLE_COMBO_ROOT_CLASS}
          triggerClassName={DASHBOARD_TABLE_COMBO_TRIGGER_CLASS}
          showColorSwatch={false}
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
        <AreaCalendarQualificationCombobox
          value={row.qualificationId}
          options={rowQualificationOptions}
          placeholder={qualificationPlaceholder}
          disabled={
            disabled ||
            row.employeeId === AREA_CALENDAR_EMPTY_EMPLOYEE_ID ||
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
      <td
        className={BULK_SHIFT_TABLE_CELL_CLASS}
        title={
          !wishFulfilled ? t("profiles.shiftPreferenceWishNotFulfilled") : undefined
        }
      >
        <AreaCalendarShiftEmployeeCombobox
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
              employeeId !== AREA_CALENDAR_EMPTY_EMPLOYEE_ID &&
              areAreaCalendarShiftTimesComplete(demand.startTime, demand.endTime)
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
          emptyLabel={t("areaCalendar.noEmployeeSelected")}
          disabled={disabled}
          onApplyAvailability={handleApplyAvailability}
          rootClassName={BULK_SHIFT_TABLE_COMBO_ROOT_CLASS}
          triggerClassName={DASHBOARD_TABLE_COMBO_TRIGGER_CLASS}
          weekdayLabelStyle="long"
          profileQualificationIds={profileQualificationIds}
          qualificationNameById={qualificationNameById}
          qualificationSortOrder={qualificationSortOrder}
          weeklyHoursLineByEmployeeId={weeklyHoursLineByEmployeeId}
        />
      </td>
      <td className="w-10 shrink-0 px-1 py-1.5 align-middle">
        <div
          className={cn(
            "flex items-center justify-center",
            BULK_SHIFT_ROW_CONTROL_HEIGHT_CLASS
          )}
        >
          {showDeleteButton ? (
            <IconButton
              size="sm"
              onClick={onDelete}
              disabled={disabled}
              aria-label={t("areaCalendar.bulkShiftDeleteRow")}
              className="h-8 w-8 shrink-0 border-transparent bg-transparent hover:bg-subtle"
            >
              <TrashIcon className="h-[18px] w-[18px]" />
            </IconButton>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function AreaCalendarBulkShiftModal({
  dialog,
  locationId,
  locationName,
  showLocationName = true,
  areas,
  areaShiftTemplates,
  staffingRules,
  serviceHours,
  qualifications,
  areaExistingAssignments,
  existingAreaShifts,
  locationDayAssignments,
  weekDates,
  weekShifts,
  onClose,
  onSaved,
}: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = useTranslations();
  const { simulatedProposedOnAssign, relaxAppRegistrationGate } =
    useSimulatedProposedOnAssignRequest();
  const intlLocale = toIntlLocale(locale);
  const weekday = profileAvailabilityWeekdayFromAreaCalendarDate(dialog.date);

  const areaName = areas.find((area) => area.id === dialog.areaId)?.name ?? "";
  const dayHeader = formatDayHeader(dialog.date, intlLocale, "long");
  const withoutServiceHours =
    dialog.withoutServiceHours ??
    !isAreaOpenOnDate(serviceHours, dialog.areaId, dialog.date);

  const templatesForArea = useMemo(
    () => areaShiftTemplatesForArea(dialog.areaId, areaShiftTemplates),
    [areaShiftTemplates, dialog.areaId]
  );
  const assignmentPresets = useMemo(
    () => areaCalendarAssignmentPresetsForArea(templatesForArea),
    [templatesForArea]
  );

  const formatStaffingTimeLabel = useCallback(
    (_weekdayLabel: string, startTime: string, endTime: string) =>
      t("areaCalendar.bulkShiftStaffingTimeRangeLabel", {
        start: startTime,
        end: endTime,
      }),
    [t]
  );

  const staffingWeekdayLabel = useCallback(
    (weekdayIndex: number) => weekdayLabelFromIndex(weekdayIndex, t),
    [t]
  );

  const presetColumnLabel = t("areaCalendar.bulkShiftTemplate");
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
      withoutServiceHours,
    })
  );
  const [employees, setEmployees] = useState<AreaCalendarShiftAssignEmployee[]>([]);
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
  const [assignRestOfWeekDays, setAssignRestOfWeekDays] = useState(false);
  const [prompt, setPrompt] = useState<BulkModalPrompt | null>(null);
  const showAssignRestOfWeekDaysOption = hasRemainingAssignableWeekDates(
    dialog.date,
    weekDates
  );
  const weeklyHoursLineByEmployeeId = useMemo(() => {
    const assignedMinutes = weeklyAssignedMinutesByEmployeeId(
      weekShifts,
      weekDates
    );
    return buildEmployeeWeeklyHoursTooltipLabels(
      employees,
      assignedMinutes,
      locale
    );
  }, [employees, weekShifts, weekDates, locale]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(() =>
    resolveBulkShiftRowIdForShiftFocus([], dialog.focusShiftId)
  );
  const pendingFocusShiftIdRef = useRef(dialog.focusShiftId);
  const pendingFocusRowIdRef = useRef<string | null>(null);
  const autoPrefillAppendedForScopeRef = useRef<string | null>(null);
  const dialogScopeKey = `${dialog.areaId}:${dialog.date}:${withoutServiceHours ? "nsh" : "sh"}`;

  const staffingEntries = useMemo(
    () =>
      withoutServiceHours
        ? []
        : computeBulkModalStaffingEntries(
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
      withoutServiceHours,
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
    () =>
      withoutServiceHours ? [] : buildBulkStaffingTableRows(staffingEntries),
    [staffingEntries, withoutServiceHours]
  );

  const staffingEntriesRowFocusKey = useMemo(
    () =>
      resolveCurrentBulkShiftRowId(rows, staffingEntries, serviceHours, {
        staffingRules,
        areaId: dialog.areaId,
      }) ?? "",
    [rows, staffingEntries, serviceHours, staffingRules, dialog.areaId]
  );

  const staffingSpeedActionsActive = useMemo(
    () =>
      isBulkShiftStaffingSpeedModeActive(columnPrefs.prefill) &&
      bulkStaffingTableRowsSupportSpeedActions(staffingTableRows),
    [columnPrefs.prefill, staffingTableRows]
  );

  useEffect(() => {
    if (pendingFocusRowIdRef.current) return;
    setActiveRowId((current) => {
      const pendingFocus = pendingFocusRowIdRef.current;
      if (pendingFocus && rows.some((row) => row.id === pendingFocus)) {
        return pendingFocus;
      }
      if (current && rows.some((row) => row.id === current)) return current;
      const focusRowId = resolveBulkShiftRowIdForShiftFocus(
        rows,
        dialog.focusShiftId
      );
      if (focusRowId) return focusRowId;
      return staffingEntriesRowFocusKey || null;
    });
  }, [rows, staffingEntriesRowFocusKey, dialog.focusShiftId]);

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

  const existingShiftById = useMemo(
    () => new Map(existingAreaShifts.map((shift) => [shift.id, shift])),
    [existingAreaShifts]
  );

  const canDeleteBulkRow = useCallback(
    (row: BulkRow) => {
      if (!row.existingShiftId) return true;
      const existing = existingShiftById.get(row.existingShiftId);
      if (!existing) return true;
      return shiftCardAllowsBulkRowDelete(
        existing.confirmationStatus,
        existing.requestedAt
      );
    },
    [existingShiftById]
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

  const { newRows, existingRows } = useMemo(
    () => partitionBulkShiftRows(rows),
    [rows]
  );

  const displayNewRows = useMemo(
    () =>
      sortBulkShiftDisplayRows(
        newRows,
        columnPrefs,
        presetNameById,
        qualificationNameById,
        employeeNameById
      ),
    [
      newRows,
      columnPrefs,
      presetNameById,
      qualificationNameById,
      employeeNameById,
    ]
  );

  const displayExistingRows = useMemo(
    () =>
      sortBulkShiftDisplayRows(
        existingRows,
        columnPrefs,
        presetNameById,
        qualificationNameById,
        employeeNameById
      ),
    [
      existingRows,
      columnPrefs,
      presetNameById,
      qualificationNameById,
      employeeNameById,
    ]
  );

  useLayoutEffect(() => {
    const rowId = pendingFocusRowIdRef.current;
    if (!rowId || loading) return;
    if (!rows.some((row) => row.id === rowId)) return;

    setActiveRowId(rowId);
    scheduleScrollBulkShiftRowIntoView(scrollContainerRef, rowId, () => {
      if (pendingFocusRowIdRef.current === rowId) {
        pendingFocusRowIdRef.current = null;
      }
    });
  }, [rows, loading, displayNewRows.length, displayExistingRows.length]);

  const handleColumnPrefsChange = useCallback((next: BulkShiftColumnPrefs) => {
    setColumnPrefs(next);
    saveBulkShiftColumnPrefs(next);
  }, []);

  const columnHeaderLabels = useMemo(
    () => ({
      template: t("areaCalendar.bulkShiftTemplate"),
      qualification: t("areaCalendar.bulkShiftQualification"),
      startTime: t("areaCalendar.bulkShiftFrom"),
      endTime: t("areaCalendar.bulkShiftTo"),
      employee: t("areaCalendar.bulkShiftEmployee"),
    }),
    [t]
  );

  const sortLabelForColumn = useCallback(
    (column: keyof typeof columnHeaderLabels) =>
      t("areaCalendar.bulkShiftSortColumn", { column: columnHeaderLabels[column] }),
    [columnHeaderLabels, t]
  );

  const prefillLabelForColumn = useCallback(
    (column: keyof typeof columnHeaderLabels) =>
      t("areaCalendar.bulkShiftPrefillColumn", { column: columnHeaderLabels[column] }),
    [columnHeaderLabels, t]
  );

  const prefillActiveLabelForColumn = useCallback(
    (column: keyof typeof columnHeaderLabels) =>
      t("areaCalendar.bulkShiftPrefillActive", { column: columnHeaderLabels[column] }),
    [columnHeaderLabels, t]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setPrompt(null);
      const result = await fetchAreaCalendarBulkShiftContext(dialog.date, {
        simulatedProposedOnAssign,
        relaxAppRegistrationGate,
      });
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
  }, [dialog.date, relaxAppRegistrationGate, simulatedProposedOnAssign, t]);

  const applyRowSyncPatch = useCallback((id: string, patch: Partial<BulkRow>) => {
    setRows((current) => {
      const row = current.find((entry) => entry.id === id);
      if (!row) return current;
      const changedPatch = bulkRowPatchDiff(row, patch);
      if (Object.keys(changedPatch).length === 0) return current;
      return current.map((entry) =>
        entry.id === id ? { ...entry, ...changedPatch } : entry
      );
    });
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<BulkRow>) => {
    setActiveRowId(id);
    applyRowSyncPatch(id, patch);
  }, [applyRowSyncPatch]);

  const deleteRow = useCallback((id: string) => {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === id);
      if (index === -1) return current;

      const next = [...current];
      next.splice(index, 1);
      return next;
    });
  }, []);

  const renderBulkShiftRow = useCallback(
    (displayRow: BulkRow) => {
      const row = rowsById.get(displayRow.id) ?? displayRow;
      return (
        <BulkShiftRowEditor
          key={row.id}
          row={row}
          weekday={weekday}
          areaId={dialog.areaId}
          locationId={locationId}
          employees={employees}
          assignmentPresets={assignmentPresets}
          areaQualifications={areaQualifications}
          staffingRules={staffingRules}
          serviceHours={serviceHours}
          qualifications={qualifications}
          dateISO={dialog.date}
          countryCode={countryCode}
          timeZone={timeZone}
          areaExistingAssignments={effectiveAreaExistingAssignments}
          locationDayAssignments={effectiveLocationDayAssignments}
          allRows={rows}
          weekShifts={weekShifts}
          weeklyHoursLineByEmployeeId={weeklyHoursLineByEmployeeId}
          profileQualificationIds={profileQualificationIds}
          profileShiftPreferences={profileShiftPreferences}
          withoutServiceHours={withoutServiceHours}
          disabled={loading || saving}
          onChange={(patch) => updateRow(row.id, patch)}
          onSyncChange={(patch) => applyRowSyncPatch(row.id, patch)}
          onDelete={() => deleteRow(row.id)}
          showDeleteButton={canDeleteBulkRow(row)}
          presetPlaceholder={presetPlaceholder}
          qualificationPlaceholder={qualificationPlaceholder}
          columnPrefill={columnPrefs.prefill}
          isCurrentRow={row.id === activeRowId}
          onActivate={() => setActiveRowId(row.id)}
        />
      );
    },
    [
      rowsById,
      weekday,
      dialog.areaId,
      locationId,
      dialog.date,
      employees,
      assignmentPresets,
      areaQualifications,
      staffingRules,
      serviceHours,
      qualifications,
      countryCode,
      timeZone,
      effectiveAreaExistingAssignments,
      effectiveLocationDayAssignments,
      rows,
      weekShifts,
      weeklyHoursLineByEmployeeId,
      profileQualificationIds,
      profileShiftPreferences,
      withoutServiceHours,
      loading,
      saving,
      updateRow,
      applyRowSyncPatch,
      deleteRow,
      canDeleteBulkRow,
      presetPlaceholder,
      qualificationPlaceholder,
      columnPrefs.prefill,
      activeRowId,
    ]
  );

  const appendPrefilledBulkRow = useCallback(
    (targetDemand?: { serviceHourId: string; qualificationId: string }) => {
      if (rows.length >= MAX_ROWS) {
        setPrompt({
          kind: "alert",
          message: t("areaCalendar.bulkShiftMaxRows", { max: MAX_ROWS }),
        });
        return;
      }

      const resolvedDemand =
        targetDemand ??
        resolveNextOpenStaffingDemand(
          staffingEntries,
          serviceHours,
          rows,
          {
            staffingRules,
            areaId: dialog.areaId,
          }
        ) ??
        undefined;

      const buildRowForExisting = (existingRows: BulkRow[]) =>
        buildPrefilledBulkRow({
          existingRows,
          prefill: columnPrefs.prefill,
          staffingEntries,
          serviceHours,
          assignmentPresets,
          staffingRules,
          areaId: dialog.areaId,
          locationId,
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
          weekShifts,
          emptyEmployeeId: AREA_CALENDAR_EMPTY_EMPLOYEE_ID,
          createEmptyRow,
          targetDemand: resolvedDemand,
          withoutServiceHours,
          presetEmployeeId:
            rows.some((row) => !row.existingShiftId)
              ? undefined
              : dialog.presetEmployeeId,
        });

      const previewRow = buildRowForExisting(rows);

      if (
        !withoutServiceHours &&
        columnPrefs.prefill.employee &&
        previewRow.employeeId === AREA_CALENDAR_EMPTY_EMPLOYEE_ID
      ) {
        setPrompt({
          kind: "alert",
          message: t("areaCalendar.bulkShiftNoEligibleEmployees"),
        });
        return;
      }

      const focusRowId = previewRow.id;
      pendingFocusRowIdRef.current = focusRowId;
      setActiveRowId(focusRowId);

      setRows((current) => {
        if (current.length >= MAX_ROWS) return current;
        const newRow =
          current === rows
            ? previewRow
            : { ...buildRowForExisting(current), id: focusRowId };
        return insertBulkShiftRowInList(
          current,
          newRow,
          isBulkShiftEmployeeSortActive(
            columnPrefs.sort.column,
            columnPrefs.sort.direction
          )
        );
      });
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
      withoutServiceHours,
    ]
  );

  const performAddRow = useCallback(() => {
    appendPrefilledBulkRow();
  }, [appendPrefilledBulkRow]);

  useEffect(() => {
    if (loading || saving) return;
    if (autoPrefillAppendedForScopeRef.current === dialogScopeKey) return;

    const hasUnsavedRow = rows.some((row) => !row.existingShiftId);
    if (hasUnsavedRow) {
      autoPrefillAppendedForScopeRef.current = dialogScopeKey;
      return;
    }

    const needsPrefilledRow = withoutServiceHours
      ? rows.length === 0
      : resolveNextOpenStaffingDemand(
          staffingEntries,
          serviceHours,
          rows,
          {
            staffingRules,
            areaId: dialog.areaId,
          }
        ) !== null;

    if (!needsPrefilledRow) {
      autoPrefillAppendedForScopeRef.current = dialogScopeKey;
      return;
    }

    autoPrefillAppendedForScopeRef.current = dialogScopeKey;
    appendPrefilledBulkRow();
  }, [
    loading,
    saving,
    dialogScopeKey,
    rows,
    staffingEntries,
    withoutServiceHours,
    appendPrefilledBulkRow,
  ]);

  const performStaffingSpeedAdd = useCallback(
    (serviceHourId: string, qualificationId: string) => {
      appendPrefilledBulkRow({ serviceHourId, qualificationId });
    },
    [appendPrefilledBulkRow]
  );

  const getEligibleEmployeesForNewRow = useCallback(
    (currentRows: BulkRow[]) => {
      if (withoutServiceHours) {
        return filterBulkShiftAssignEmployeesWithoutTimeWindow(employees, weekday);
      }
      const presetRow = createPresetBulkRow(
        staffingEntries,
        serviceHours,
        assignmentPresets,
        staffingRules,
        dialog.areaId,
        currentRows,
        withoutServiceHours
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
          weekShifts,
          withoutServiceHours,
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
      weekShifts,
      withoutServiceHours,
    ]
  );

  const addRow = useCallback(() => {
    const validation = validateBulkShiftRows(rows, t, { requireAllComplete: true });
    if (!validation.valid) {
      setPrompt({ kind: "alert", message: validation.summary! });
      return;
    }

    if (!withoutServiceHours && getEligibleEmployeesForNewRow(rows).length === 0) {
      setPrompt({
        kind: "alert",
        message: t("areaCalendar.bulkShiftNoEligibleEmployees"),
      });
      return;
    }

    if (!withoutServiceHours && isStaffingFullyCovered(staffingEntries)) {
      setPrompt({ kind: "confirm-add-row" });
      return;
    }

    performAddRow();
  }, [
    rows,
    t,
    withoutServiceHours,
    staffingEntries,
    getEligibleEmployeesForNewRow,
    performAddRow,
  ]);

  const performSave = useCallback(
    async (
      rowsSnapshot: BulkRow[],
      options?: { withoutServiceHours?: boolean }
    ) => {
      const saveWithoutServiceHours =
        options?.withoutServiceHours ?? withoutServiceHours;
      const hasDeletes = deletedExistingShiftIds.length > 0;
      const completeAssignRows = listCompleteBulkShiftRowsForAssign(
        rowsSnapshot,
        saveWithoutServiceHours
      );
      const canExtendRestOfWeek =
        assignRestOfWeekDays && completeAssignRows.length > 0;
      const saveIntent = resolveBulkShiftSaveIntent(
        rowsSnapshot,
        hasDeletes,
        { withoutServiceHours: saveWithoutServiceHours }
      );

      if (
        saveIntent.kind === "close-without-changes" &&
        !hasDeletes &&
        !canExtendRestOfWeek
      ) {
        onClose();
        return;
      }

      if (saveIntent.kind === "reject-unsaved-incomplete" && !canExtendRestOfWeek) {
        setPrompt({
          kind: "alert",
          message: t("areaCalendar.bulkShiftValidationNoCompleteRows"),
          blocking: true,
        });
        return;
      }

      const saveableRows =
        saveIntent.kind === "persist" ? (saveIntent.saveableRows as BulkRow[]) : [];
      const rowsForBatch = canExtendRestOfWeek
        ? (completeAssignRows as BulkRow[])
        : saveableRows;

      if (rowsForBatch.length === 0 && !hasDeletes) {
        setPrompt({
          kind: "alert",
          message: t("areaCalendar.bulkShiftValidationNoCompleteRows"),
          blocking: true,
        });
        return;
      }

      const completeAssignments: AreaCalendarAssignmentTimeWindow[] = rowsForBatch.flatMap(
        (row) => {
          if (row.employeeId === AREA_CALENDAR_EMPTY_EMPLOYEE_ID) return [];
          if (!areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)) return [];
          return [
            {
              employeeId: row.employeeId,
              startTime: row.startTime,
              endTime: row.endTime,
            },
          ];
        }
      );

      const overlapEmployeeName = findEmployeeWithOverlappingAreaCalendarAssignments(
        dialog.date,
        completeAssignments,
        effectiveAreaExistingAssignments,
        employeeNameById,
        timeZone
      );
      if (overlapEmployeeName) {
        setPrompt({
          kind: "alert",
          message: t("areaCalendar.bulkShiftValidationOverlap", {
            name: overlapEmployeeName,
          }),
        });
        return;
      }

      const payloadRows = sortBulkShiftRows(
        rowsForBatch.map((row) => ({
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
        withoutServiceHours: saveWithoutServiceHours,
        rows: payloadRows.map(({ row }) => ({
          employeeId: row.employeeId,
          startTime: row.startTime,
          endTime: row.endTime,
          areaShiftTemplateId: areaShiftTemplateIdForAssign(row.shiftTypeId),
          existingShiftId: row.existingShiftId,
        })),
        simulatedProposedOnAssign,
        relaxAppRegistrationGate,
        assignToRemainingWeekDays: assignRestOfWeekDays,
        weekDates,
      });
      setSaving(false);

      if (!result.ok) {
        setPrompt(
          shiftAssignAlertPromptForError(result.error, (error) =>
            translateActionError(error, t)
          )
        );
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
          message: t("areaCalendar.bulkShiftValidationNoCompleteRows"),
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
          message: t("areaCalendar.bulkShiftValidationNoCompleteRows"),
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

      const submittedRowIds = new Set(payloadRows.map(({ row }) => row.id));
      const remainingRows = freezeSubmittedBulkRowsAfterPartialSave(
        partialSaveOutcome.remainingRows as BulkRow[],
        submittedRowIds
      );

      if (result.undoAvailable) {
        onSaved?.();
      }

      setRows(remainingRows);
      setPrompt({
        kind: "alert",
        message: t("areaCalendar.bulkShiftPartialSuccess"),
        partialSaveFailures: saveFailures,
        blocking: shiftAssignAlertPromptHasBlockingFailure(
          saveFailures.map((failure) => failure.error)
        ),
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
      withoutServiceHours,
      assignRestOfWeekDays,
      weekDates,
      simulatedProposedOnAssign,
      relaxAppRegistrationGate,
      onClose,
      onSaved,
      router,
      t,
    ]
  );

  const finalizeBulkSave = useCallback(
    async (options?: { withoutServiceHours?: boolean }) => {
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

      await performSave(rows, options);
    },
    [
      dialog.date,
      dialog.areaId,
      countryCode,
      rows,
      effectiveLocationDayAssignments,
      employeeNameById,
      t,
      performSave,
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
      if (row.employeeId === AREA_CALENDAR_EMPTY_EMPLOYEE_ID) continue;
      if (!areAreaCalendarShiftTimesComplete(row.startTime, row.endTime)) continue;

      if (!withoutServiceHours) {
        const serviceHoursCheck = validateAreaCalendarShiftServiceHours(
          serviceHours,
          dialog.areaId,
          dialog.date,
          row.startTime,
          row.endTime
        );
        if (!serviceHoursCheck.ok) {
          setPrompt({ kind: "confirm-outside-service-hours" });
          return;
        }
      }
    }

    await finalizeBulkSave();
  }, [
    rows,
    t,
    withoutServiceHours,
    serviceHours,
    dialog.areaId,
    dialog.date,
    finalizeBulkSave,
  ]);

  const dismissPrompt = useCallback(() => {
    setPrompt(null);
  }, []);

  const handlePromptConfirm = useCallback(() => {
    if (!prompt) return;
    if (prompt.kind === "confirm-add-row") {
      setPrompt(null);
      performAddRow();
      return;
    }
    if (prompt.kind === "confirm-outside-service-hours") {
      setPrompt(null);
      void finalizeBulkSave({ withoutServiceHours: true });
    }
  }, [prompt, performAddRow, finalizeBulkSave]);

  const promptMessage =
    prompt?.kind === "alert"
      ? prompt.message
      : prompt?.kind === "confirm-add-row"
        ? t("areaCalendar.bulkShiftStaffingCoveredConfirm")
        : prompt?.kind === "confirm-outside-service-hours"
          ? t("areaCalendar.bulkShiftOutsideServiceHoursConfirm")
          : null;

  const promptIsConfirm =
    prompt?.kind === "confirm-add-row" ||
    prompt?.kind === "confirm-outside-service-hours";

  const modalLocked = prompt?.kind === "alert" && prompt.blocking === true;

  const modalBusy = loading || saving;

  return (
    <>
      <PlanningSidePanel
        size="wide"
        title={
          dialog.focusShiftId
            ? t("areaCalendar.editShift")
            : t("areaCalendar.bulkShiftTitle")
        }
        subtitleNode={
          <p
            className={cn(
              PLANNING_SIDE_PANEL_SUBTITLE_CLASS,
              "font-semibold text-[#0f766e]"
            )}
          >
            <span className="block truncate sm:inline">
              {showLocationName ? `${locationName} / ${areaName}` : areaName}
            </span>
            <span className="block sm:ml-1 sm:inline">
              – {dayHeader.weekday}, {dayHeader.label}
            </span>
          </p>
        }
        titleId="areacalendar-bulk-shift-title"
        onClose={onClose}
        closeDisabled={saving || modalLocked}
        closeAriaLabel={t("common.close")}
        dismissOnBackdrop={!saving && !prompt}
        headerAside={
          staffingTableRows.length > 0 ? (
            <BulkShiftStaffingTable
              rows={staffingTableRows}
              locale={locale}
              showSpeedActions={staffingSpeedActionsActive}
              onSpeedAdd={performStaffingSpeedAdd}
              speedActionsDisabled={loading || saving}
            />
          ) : undefined
        }
        panelClassName={cn(
          "select-none [&_input]:select-text",
          modalBusy && "cursor-wait [&_*]:!cursor-wait"
        )}
        bodyClassName={settingsModalBodyPaddingClass()}
        footer={
          <div className={PLANNING_SIDE_PANEL_FOOTER_CLASS}>
            {showAssignRestOfWeekDaysOption ? (
              <label className="flex min-w-0 cursor-pointer items-start gap-2 text-sm text-foreground">
                <Checkbox
                  checked={assignRestOfWeekDays}
                  disabled={saving || modalLocked}
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
            <div className="flex shrink-0 gap-2">
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
          </div>
        }
      >
          {assignmentPresets.length === 0 ? (
            <Alert variant="info" className="mb-4">
              {t("areaCalendar.noShiftTemplatesForArea")}
            </Alert>
          ) : null}
          <div
            ref={scrollContainerRef}
            className={settingsResponsiveTableWrapClass()}
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
                      sortAscLabel={t("areaCalendar.bulkShiftSortAsc")}
                      sortDescLabel={t("areaCalendar.bulkShiftSortDesc")}
                      prefillLabel={prefillLabelForColumn("template")}
                      prefillActiveLabel={prefillActiveLabelForColumn("template")}
                    />
                  </th>
                  <th className="min-w-0 px-1 py-1.5">
                    <BulkShiftColumnHeader
                      label={t("areaCalendar.bulkShiftQualification")}
                      sortColumn="qualification"
                      prefillColumn={withoutServiceHours ? undefined : "qualification"}
                      prefs={columnPrefs}
                      onPrefsChange={handleColumnPrefsChange}
                      sortColumnLabel={sortLabelForColumn("qualification")}
                      sortAscLabel={t("areaCalendar.bulkShiftSortAsc")}
                      sortDescLabel={t("areaCalendar.bulkShiftSortDesc")}
                      prefillLabel={prefillLabelForColumn("qualification")}
                      prefillActiveLabel={prefillActiveLabelForColumn("qualification")}
                    />
                  </th>
                  <th className="px-1 py-1.5">
                    <BulkShiftColumnHeader
                      label={t("areaCalendar.bulkShiftFrom")}
                      sortColumn="startTime"
                      prefs={columnPrefs}
                      onPrefsChange={handleColumnPrefsChange}
                      sortColumnLabel={sortLabelForColumn("startTime")}
                      sortAscLabel={t("areaCalendar.bulkShiftSortAsc")}
                      sortDescLabel={t("areaCalendar.bulkShiftSortDesc")}
                      prefillLabel=""
                      prefillActiveLabel=""
                    />
                  </th>
                  <th className="px-1 py-1.5">
                    <BulkShiftColumnHeader
                      label={t("areaCalendar.bulkShiftTo")}
                      sortColumn="endTime"
                      prefs={columnPrefs}
                      onPrefsChange={handleColumnPrefsChange}
                      sortColumnLabel={sortLabelForColumn("endTime")}
                      sortAscLabel={t("areaCalendar.bulkShiftSortAsc")}
                      sortDescLabel={t("areaCalendar.bulkShiftSortDesc")}
                      prefillLabel=""
                      prefillActiveLabel=""
                    />
                  </th>
                  <th className="min-w-0 px-1 py-1.5">
                    <BulkShiftColumnHeader
                      label={t("areaCalendar.bulkShiftEmployee")}
                      sortColumn="employee"
                      prefillColumn={withoutServiceHours ? undefined : "employee"}
                      prefs={columnPrefs}
                      onPrefsChange={handleColumnPrefsChange}
                      sortColumnLabel={sortLabelForColumn("employee")}
                      sortAscLabel={t("areaCalendar.bulkShiftSortAsc")}
                      sortDescLabel={t("areaCalendar.bulkShiftSortDesc")}
                      prefillLabel={prefillLabelForColumn("employee")}
                      prefillActiveLabel={prefillActiveLabelForColumn("employee")}
                    />
                  </th>
                  <th className="px-1 py-1.5" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {displayNewRows.length > 0 ? (
                  <>
                    <BulkShiftSectionHeader
                      label={t("areaCalendar.bulkShiftNewAssignmentsSection")}
                    />
                    {displayNewRows.map((displayRow) => renderBulkShiftRow(displayRow))}
                  </>
                ) : null}
                {displayExistingRows.length > 0 ? (
                  <>
                    <BulkShiftSectionHeader
                      label={t("areaCalendar.bulkShiftExistingShiftsSection")}
                    />
                    {displayExistingRows.map((displayRow) =>
                      renderBulkShiftRow(displayRow)
                    )}
                  </>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <SettingsPrimaryActionButton
              label={t("areaCalendar.addShiftTitle")}
              icon={<PlusIcon />}
              disabled={loading || saving || rows.length >= MAX_ROWS || !!prompt}
              onClick={addRow}
            />
            {rows.length >= MAX_ROWS ? (
              <span className="text-xs text-muted">
                {t("areaCalendar.bulkShiftMaxRows", { max: String(MAX_ROWS) })}
              </span>
            ) : null}
          </div>
      </PlanningSidePanel>

      {prompt && promptMessage ? (
        <PlanningSidePanelNestedAlertPortal>
        <div
          className={areaCalendarNestedModalOverlayClass()}
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
            aria-labelledby="areacalendar-bulk-shift-validation-message"
            className={cn(areaCalendarAlertDialogClass(), "overflow-hidden p-0")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <SettingsConfirmDialogCloseHeader
              onClose={dismissPrompt}
              closeDisabled={modalLocked}
              closeAriaLabel={t("common.close")}
            />
            <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5">
            {prompt.kind === "alert" &&
            prompt.partialSaveFailures &&
            prompt.partialSaveFailures.length > 0 ? (
              <BulkShiftPartialSaveAlertContent
                failures={prompt.partialSaveFailures}
                intro={t("areaCalendar.bulkShiftPartialSuccess")}
                messageId="areacalendar-bulk-shift-validation-message"
                translateEntry={(failure) =>
                  t("areaCalendar.bulkShiftPartialSuccessEntry", {
                    name: failure.name,
                    start: failure.startTime.slice(0, 5),
                    end: failure.endTime.slice(0, 5),
                    error: failure.error,
                  })
                }
              />
            ) : (
              <p
                id="areacalendar-bulk-shift-validation-message"
                className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line text-sm text-foreground"
              >
                {promptMessage}
              </p>
            )}
            <div
              className={settingsModalFooterClass(
                "mt-5 shrink-0 border-0 px-0 pb-0 pt-0 sm:justify-end"
              )}
            >
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
        </div>
        </PlanningSidePanelNestedAlertPortal>
      ) : null}
    </>
  );
}
