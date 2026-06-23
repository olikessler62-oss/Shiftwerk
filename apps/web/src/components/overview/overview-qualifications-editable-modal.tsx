"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Qualification } from "@schichtwerk/types";
import { removeProfileQualification } from "@/app/actions/profile-qualifications";
import { fetchOverviewQualifications } from "@/app/actions/overview-qualifications-data";
import { DeleteConfirmModal } from "@/components/settings/delete-confirm-modal";
import { ProfileQualificationFormModal } from "@/components/settings/profile-qualification-form-modal";
import {
  SettingsActionBar,
  SettingsBulkDeleteActionButton,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsListRowCheckbox,
  SettingsListRowDeleteButton,
  SettingsOverviewListRowActions,
  SettingsPrimaryActionButton,
  applyCreatedListSelection,
  shouldIgnoreSettingsListRowActivation,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsListItemAttrs,
  settingsOverviewListRowActionsHeaderClass,
  settingsModalFooterClass,
  settingsScrollableTableListClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  OVERVIEW_ABSENCES_LIST_SCROLL_CLASS,
} from "@/components/settings/settings-list-ui";
import {
  Button,
  CloseIcon,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { OverviewSidePanel } from "./overview-side-panel";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  buildOverviewQualificationDisplayRows,
  buildOverviewQualificationEmployeeJumpOptions,
  countOverviewQualificationEmployees,
  firstOverviewQualificationRowIdForEmployee,
  overviewQualificationRowId,
  parseOverviewQualificationRowId,
  type OverviewProfileQualificationAssignment,
} from "@/lib/overview-qualifications-display";
import { useScrollToSettingsListItem } from "@/lib/settings-list-scroll";
import { useOverviewModalListScroll } from "@/lib/use-overview-modal-initial-scroll";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";
import { OverviewAvailabilitiesEmployeeJumpCombobox } from "./overview-availabilities-employee-jump-combobox";

type Props = {
  onClose: () => void;
  initialEmployeeId?: string | null;
};

type FormMode =
  | null
  | { type: "create" }
  | { type: "edit"; qualification: Qualification; profileId: string };

const MAX_NAME_DISPLAY = 25;

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function OverviewQualificationsEditableModal({
  onClose,
  initialEmployeeId = null,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<OverviewProfileQualificationAssignment[]>(
    []
  );
  const [allQualifications, setAllQualifications] = useState<Qualification[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const [jumpSelectedEmployeeId, setJumpSelectedEmployeeId] = useState(
    initialEmployeeId ?? ""
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const result = await fetchOverviewQualifications();
    if (!result.ok) {
      setErrorMessage(result.error);
      setLoading(false);
      return;
    }

    setProfiles(result.profiles);
    setAssignments(result.assignments);
    setAllQualifications(result.qualifications);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const anySubModalOpen = !!formMode || confirmRemove || confirmBulkRemove;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (formMode) {
        setFormMode(null);
        return;
      }
      if (confirmRemove) {
        setConfirmRemove(false);
        return;
      }
      if (confirmBulkRemove) {
        setConfirmBulkRemove(false);
        return;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmBulkRemove, confirmRemove, formMode]);

  const rows = useMemo(
    () =>
      buildOverviewQualificationDisplayRows({
        assignments,
        profiles,
      }),
    [assignments, profiles]
  );

  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const bulkSelection = useSettingsListBulkSelection(rowIds);

  const employeeCount = useMemo(
    () => countOverviewQualificationEmployees(rows),
    [rows]
  );
  const employeeJumpOptions = useMemo(
    () => buildOverviewQualificationEmployeeJumpOptions(profiles, rows),
    [profiles, rows]
  );
  const enableScroll = employeeCount >= 10;

  const resolveFirstRowIdForEmployee = useCallback(
    (employeeId: string) => firstOverviewQualificationRowIdForEmployee(rows, employeeId),
    [rows]
  );

  const handleEmployeePosition = useCallback(
    (employeeId: string, firstRowId: string | null) => {
      setJumpSelectedEmployeeId(employeeId);
      setSelectedAssignmentId(firstRowId);
      setConfirmRemove(false);
      setConfirmBulkRemove(false);
      setFormMode(null);
      setErrorMessage(null);
    },
    []
  );

  const { contentReady, waitingForContent, jumpToEmployee } = useOverviewModalListScroll({
    initialEmployeeId,
    loading,
    rows,
    resolveFirstRowId: resolveFirstRowIdForEmployee,
    onEmployeePosition: handleEmployeePosition,
  });

  useEffect(() => {
    if (!waitingForContent) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [waitingForContent]);

  useScrollToSettingsListItem(rows, scrollToItemId, () => setScrollToItemId(null), "top");

  useEffect(() => {
    if (!selectedAssignmentId) return;
    if (rows.some((row) => row.id === selectedAssignmentId)) return;
    setSelectedAssignmentId(null);
  }, [rows, selectedAssignmentId]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedAssignmentId) ?? null,
    [rows, selectedAssignmentId]
  );
  const tableSelectedEmployeeId = selectedRow?.employeeId ?? null;
  const createEmployeeId = jumpSelectedEmployeeId || tableSelectedEmployeeId || null;

  const assignedQualificationIdsForCreateEmployee = useMemo(() => {
    if (!createEmployeeId) return new Set<string>();
    return new Set(
      assignments
        .filter((assignment) => assignment.profile_id === createEmployeeId)
        .map((assignment) => assignment.qualification.id)
    );
  }, [assignments, createEmployeeId]);

  const unassignedQualificationsForCreate = useMemo(
    () =>
      allQualifications.filter(
        (qualification) => !assignedQualificationIdsForCreateEmployee.has(qualification.id)
      ),
    [allQualifications, assignedQualificationIdsForCreateEmployee]
  );

  const editAvailableQualifications = useMemo(() => {
    if (formMode?.type !== "edit") return [];
    const assignedForProfile = new Set(
      assignments
        .filter((assignment) => assignment.profile_id === formMode.profileId)
        .map((assignment) => assignment.qualification.id)
    );
    return allQualifications.filter(
      (qualification) =>
        qualification.id === formMode.qualification.id ||
        !assignedForProfile.has(qualification.id)
    );
  }, [allQualifications, assignments, formMode]);

  const mergeProfileQualifications = useCallback(
    (profileId: string, qualifications: Qualification[]) => {
      setAssignments((current) => [
        ...current.filter((assignment) => assignment.profile_id !== profileId),
        ...qualifications.map((qualification) => ({
          profile_id: profileId,
          qualification,
        })),
      ]);
      startTransition(() => {
        router.refresh();
      });
    },
    [router]
  );

  function handleSaved(
    profileId: string,
    list: Qualification[],
    assignedQualificationId: string,
    scrollToSelection = false
  ) {
    mergeProfileQualifications(profileId, list);
    setJumpSelectedEmployeeId(profileId);

    const mergedAssignments = [
      ...assignments.filter((assignment) => assignment.profile_id !== profileId),
      ...list.map((qualification) => ({ profile_id: profileId, qualification })),
    ];
    const firstRowId =
      firstOverviewQualificationRowIdForEmployee(
        buildOverviewQualificationDisplayRows({
          assignments: mergedAssignments,
          profiles,
        }),
        profileId
      ) ?? overviewQualificationRowId(profileId, assignedQualificationId);

    if (scrollToSelection && firstRowId) {
      applyCreatedListSelection(firstRowId, setSelectedAssignmentId, setScrollToItemId);
    } else {
      setSelectedAssignmentId(overviewQualificationRowId(profileId, assignedQualificationId));
    }
  }

  function handleRemove() {
    if (!selectedRow) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await removeProfileQualification({
        profileId: selectedRow.employeeId,
        qualificationId: selectedRow.qualification.id,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      mergeProfileQualifications(selectedRow.employeeId, result.qualifications ?? []);
      setConfirmRemove(false);
    });
  }

  function handleBulkRemove() {
    const selectedIds = rowIds.filter((id) => bulkSelection.isChecked(id));
    if (selectedIds.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      for (const rowId of selectedIds) {
        const parsed = parseOverviewQualificationRowId(rowId);
        if (!parsed) continue;
        const result = await removeProfileQualification({
          profileId: parsed.profileId,
          qualificationId: parsed.qualificationId,
        });
        if (!result.ok) {
          setErrorMessage(result.error);
          bulkSelection.clear();
          setConfirmBulkRemove(false);
          return;
        }
        mergeProfileQualifications(parsed.profileId, result.qualifications ?? []);
      }
      bulkSelection.clear();
      setConfirmBulkRemove(false);
    });
  }

  function handleJumpToEmployee(employeeId: string, firstRowId: string | null) {
    jumpToEmployee(employeeId, firstRowId);
  }

  const deleteConfirmLabel = selectedRow
    ? truncateLabel(selectedRow.qualification.name)
    : "";

  return (
    <>
      {!loading ? (
        <OverviewSidePanel
          title={t("overview.qualifications.title")}
          subtitle={t("overview.qualifications.inlineEditHint")}
          titleId="overview-qualifications-modal-title"
          onClose={onClose}
          closeDisabled={pending || waitingForContent || anySubModalOpen}
          dismissOnBackdrop={!anySubModalOpen && !waitingForContent && !pending}
          closeAriaLabel={t("common.close")}
          contentReady={contentReady}
          panelClassName={cn(anySubModalOpen && "pointer-events-none")}
          footer={
            <div className={settingsModalFooterClass()}>
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                <CloseIcon />
                {t("common.close")}
              </Button>
            </div>
          }
        >
          {errorMessage ? (
            <p className="mb-3 text-sm text-red-700">{errorMessage}</p>
          ) : null}

          <div className="flex flex-col rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
                <div className="relative z-30 flex shrink-0 items-center justify-between gap-3 overflow-visible border-b border-border bg-subtle px-3 py-2.5">
                  <h3 className="min-w-0 truncate text-sm font-medium text-foreground">
                    {t("overview.qualifications.listTitle")}
                  </h3>
                  <OverviewAvailabilitiesEmployeeJumpCombobox
                    options={employeeJumpOptions}
                    onJump={handleJumpToEmployee}
                    selectedEmployeeId={jumpSelectedEmployeeId}
                    disabled={pending || waitingForContent}
                    className="w-56 shrink-0"
                  />
                </div>

                <div className="min-h-0 overflow-hidden bg-background px-2 py-2">
                  {rows.length === 0 ? (
                    <SettingsEmptyState
                      message={t("overview.qualifications.emptyList")}
                      hint={t("overview.qualifications.emptyEditHint")}
                    />
                  ) : (
                    <div
                      className={cn(
                        settingsScrollableTableListClass(),
                        enableScroll && OVERVIEW_ABSENCES_LIST_SCROLL_CLASS
                      )}
                    >
                      <table className="w-full min-w-[32rem] border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th
                              className={settingsStickyIndicatorHeaderClass()}
                              aria-hidden
                            />
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.employee")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("profiles.columnQualification")}
                            </th>
                            <th
                              className={settingsOverviewListRowActionsHeaderClass()}
                              aria-hidden
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const isSelected = row.id === selectedAssignmentId;
                            return (
                              <tr
                                key={row.id}
                                {...settingsListItemAttrs(row.id)}
                                onClick={(event) => {
                                  if (shouldIgnoreSettingsListRowActivation(event)) {
                                    return;
                                  }
                                  setSelectedAssignmentId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setConfirmRemove(false);
                                  setConfirmBulkRemove(false);
                                  setFormMode(null);
                                  setErrorMessage(null);
                                }}
                                onDoubleClick={(event) => {
                                  event.preventDefault();
                                  window.getSelection()?.removeAllRanges();
                                  setSelectedAssignmentId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setFormMode({
                                    type: "edit",
                                    qualification: row.qualification,
                                    profileId: row.employeeId,
                                  });
                                  setConfirmRemove(false);
                                  setConfirmBulkRemove(false);
                                  setErrorMessage(null);
                                }}
                                className={cn(
                                  settingsDataRowClass(isSelected),
                                  "cursor-pointer"
                                )}
                              >
                                <td
                                  className={settingsIndicatorCellClass(isSelected)}
                                  aria-hidden
                                />
                                <td className={settingsDataCellClass(isSelected)}>
                                  {row.showEmployeeName ? (
                                    <span className="flex min-w-0 items-center gap-2">
                                      {row.employeeColor ? (
                                        <span
                                          className="size-3 shrink-0 rounded-full border border-border/60"
                                          style={{ backgroundColor: row.employeeColor }}
                                          aria-hidden
                                        />
                                      ) : null}
                                      <span className="truncate font-medium">
                                        {row.employeeName}
                                      </span>
                                    </span>
                                  ) : null}
                                </td>
                                <td
                                  className={settingsDataCellClass(isSelected, {
                                    className: "max-w-[24rem] truncate",
                                  })}
                                >
                                  {truncateLabel(row.qualification.name)}
                                </td>
                                <SettingsOverviewListRowActions
                                  isSelected={isSelected}
                                  checkbox={
                                    <SettingsListRowCheckbox
                                      checked={bulkSelection.isChecked(row.id)}
                                      disabled={pending}
                                      ariaLabel={t("common.selectRow")}
                                      className="mx-0"
                                      onChange={() => bulkSelection.toggle(row.id)}
                                    />
                                  }
                                  deleteButton={
                                    <SettingsListRowDeleteButton
                                      label={t("profiles.delete")}
                                      disabled={pending}
                                      onClick={() => {
                                        setSelectedAssignmentId(row.id);
                                        setJumpSelectedEmployeeId(row.employeeId);
                                        setFormMode(null);
                                        setConfirmRemove(true);
                                      }}
                                    />
                                  }
                                />
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <SettingsActionBar
                  primary={
                    <SettingsPrimaryActionButton
                      label={t("profiles.new")}
                      icon={<PlusIcon />}
                      disabled={
                        pending || !createEmployeeId || unassignedQualificationsForCreate.length === 0
                      }
                      onClick={() => {
                        setFormMode({ type: "create" });
                        setConfirmRemove(false);
                        setConfirmBulkRemove(false);
                        setErrorMessage(null);
                      }}
                    />
                  }
                  secondary={
                    <SettingsIconActionButton
                      label={t("profiles.edit")}
                      icon={<PencilIcon />}
                      disabled={pending || !selectedRow}
                      onClick={() => {
                        if (!selectedRow) return;
                        setFormMode({
                          type: "edit",
                          qualification: selectedRow.qualification,
                          profileId: selectedRow.employeeId,
                        });
                        setConfirmRemove(false);
                        setConfirmBulkRemove(false);
                      }}
                    />
                  }
                  destructive={
                    <SettingsBulkDeleteActionButton
                      label={t("common.deleteSelectedEntries")}
                      disabled={pending || !bulkSelection.canBulkDelete}
                      onClick={() => {
                        setConfirmRemove(false);
                        setFormMode(null);
                        setConfirmBulkRemove(true);
                      }}
                    />
                  }
                />
              </div>

              {createEmployeeId ? (
                <p className="mt-3 text-xs text-muted">
                  {t("overview.qualifications.selectedEmployeeHint", {
                    name:
                      profiles.find((profile) => profile.id === createEmployeeId)
                        ?.full_name ?? "—",
                  })}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  {t("overview.qualifications.selectEmployeeHint")}
                </p>
              )}
        </OverviewSidePanel>
      ) : null}

      {formMode?.type === "create" && createEmployeeId ? (
            <ProfileQualificationFormModal
              mode="create"
              profileId={createEmployeeId}
              availableQualifications={unassignedQualificationsForCreate}
              onClose={() => setFormMode(null)}
              onSaved={(list, assignedQualificationId) =>
                handleSaved(createEmployeeId, list, assignedQualificationId, true)
              }
            />
          ) : null}
          {formMode?.type === "edit" ? (
            <ProfileQualificationFormModal
              mode="edit"
              profileId={formMode.profileId}
              currentQualification={formMode.qualification}
              availableQualifications={editAvailableQualifications}
              onClose={() => setFormMode(null)}
              onSaved={(list, assignedQualificationId) =>
                handleSaved(formMode.profileId, list, assignedQualificationId)
              }
            />
          ) : null}
          {confirmRemove && selectedRow ? (
            <DeleteConfirmModal
              name={deleteConfirmLabel}
              pending={pending}
              onCancel={() => setConfirmRemove(false)}
              onConfirm={handleRemove}
            />
          ) : null}
          {confirmBulkRemove && bulkSelection.checkedCount > 0 ? (
            <DeleteConfirmModal
              name={t("common.deleteSelectedEntries")}
              count={bulkSelection.checkedCount}
              pending={pending}
              onCancel={() => setConfirmBulkRemove(false)}
              onConfirm={handleBulkRemove}
            />
          ) : null}
    </>
  );
}
