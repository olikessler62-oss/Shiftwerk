"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AbsenceRange } from "@schichtwerk/database";
import type { AbsenceRequest, AbsenceType, Profile, RequestStatus } from "@schichtwerk/types";
import {
  closeOpenAbsence,
  deleteAbsence,
  reviewAbsenceRequest,
} from "@/app/actions/absences";
import { fetchOverviewAbsences } from "@/app/actions/overview-absences-data";
import {
  AbsenceFormModal,
  absenceDraftFromRequest,
  absenceRangesFromRequests,
  emptyAbsenceDraft,
} from "@/components/settings/absence-form-modal";
import { DeleteConfirmModal } from "@/components/settings/delete-confirm-modal";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsBulkDeleteActionButton,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsListRowCheckbox,
  SettingsListRowDeleteButton,
  SettingsOverviewListRowActions,
  SettingsPrimaryActionButton,
  applyCreatedListSelection,
  areaCalendarModalBackdropClass,
  shouldIgnoreSettingsListRowActivation,
  settingsConfirmDialogClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsListItemAttrs,
  settingsOverviewListRowActionsHeaderClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsModalRootClass,
  settingsNestedModalOverlayClass,
  settingsScrollableTableListClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  OVERVIEW_ABSENCES_LIST_SCROLL_CLASS,
} from "@/components/settings/settings-list-ui";
import {
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  Input,
  LabelMuted,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import {
  buildOverviewAbsenceDisplayRows,
  buildOverviewAbsenceEmployeeJumpOptions,
  countOverviewAbsenceEmployees,
  firstOverviewAbsenceRowIdForEmployee,
} from "@/lib/overview-absences-display";
import { resolveShiftGuardActionError } from "@/lib/shift-guard-action-error";
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
  | { type: "edit"; absence: AbsenceRequest };

const OVERLAP_STATUSES: RequestStatus[] = ["approved", "pending"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function canEditAbsence(item: AbsenceRequest): boolean {
  return (
    item.status !== "pending" &&
    item.status !== "rejected" &&
    item.status !== "cancelled"
  );
}

function formatEndDateLabel(
  row: { endDate: string | null; isOpenEnded: boolean },
  dateFormatter: Intl.DateTimeFormat,
  openLabel: string
): string {
  if (row.isOpenEnded && !row.endDate) return openLabel;
  if (!row.endDate) return "—";
  return dateFormatter.format(new Date(`${row.endDate}T12:00:00`));
}

export function OverviewAbsencesEditableModal({
  onClose,
  initialEmployeeId = null,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [absences, setAbsences] = useState<AbsenceRequest[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAbsenceId, setSelectedAbsenceId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [closeSickOpen, setCloseSickOpen] = useState(false);
  const [closeSickDate, setCloseSickDate] = useState(todayISO());
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const [jumpSelectedEmployeeId, setJumpSelectedEmployeeId] = useState(
    initialEmployeeId ?? ""
  );
  const modalRootRef = useRef<HTMLDivElement>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(toIntlLocale(locale), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const result = await fetchOverviewAbsences();
    if (!result.ok) {
      setErrorMessage(result.error);
      setLoading(false);
      return;
    }

    setProfiles(result.profiles);
    setAbsences(result.absences);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const anySubModalOpen =
    !!formMode || confirmRemove || confirmBulkRemove || closeSickOpen;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (formMode) {
        setFormMode(null);
        return;
      }
      if (closeSickOpen) {
        setCloseSickOpen(false);
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
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeSickOpen, confirmBulkRemove, confirmRemove, formMode, onClose]);

  const absencesById = useMemo(
    () => new Map(absences.map((absence) => [absence.id, absence])),
    [absences]
  );

  const rows = useMemo(
    () =>
      buildOverviewAbsenceDisplayRows({
        absences,
        profiles,
        todayISO: todayISO(),
      }),
    [absences, profiles]
  );

  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const bulkSelection = useSettingsListBulkSelection(rowIds);

  const employeeCount = useMemo(() => countOverviewAbsenceEmployees(rows), [rows]);
  const employeeJumpOptions = useMemo(
    () => buildOverviewAbsenceEmployeeJumpOptions(profiles, rows),
    [profiles, rows]
  );
  const enableScroll = employeeCount >= 10;

  const resolveFirstRowIdForEmployee = useCallback(
    (employeeId: string) => firstOverviewAbsenceRowIdForEmployee(rows, employeeId),
    [rows]
  );

  const handleEmployeePosition = useCallback(
    (employeeId: string, firstRowId: string | null) => {
      setJumpSelectedEmployeeId(employeeId);
      setSelectedAbsenceId(firstRowId);
      setConfirmRemove(false);
      setConfirmBulkRemove(false);
      setCloseSickOpen(false);
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
    if (!selectedAbsenceId) return;
    if (rows.some((row) => row.id === selectedAbsenceId)) return;
    setSelectedAbsenceId(null);
  }, [rows, selectedAbsenceId]);

  const selectedAbsence = selectedAbsenceId
    ? (absencesById.get(selectedAbsenceId) ?? null)
    : null;
  const tableSelectedEmployeeId = selectedAbsence?.employee_id ?? null;
  const createEmployeeId =
    jumpSelectedEmployeeId || tableSelectedEmployeeId || null;

  const existingRanges = useMemo((): AbsenceRange[] => {
    return absenceRangesFromRequests(
      absences.filter((entry) => OVERLAP_STATUSES.includes(entry.status))
    );
  }, [absences]);

  const canEditSelected = selectedAbsence ? canEditAbsence(selectedAbsence) : false;
  const canReviewSelected = selectedAbsence?.status === "pending";
  const canCloseSickSelected =
    selectedAbsence?.status === "approved" && selectedAbsence.is_open_ended;

  function refreshList() {
    startTransition(() => {
      router.refresh();
    });
  }

  function handleFormSaved(createdId?: string) {
    const profileId = createEmployeeId;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await fetchOverviewAbsences();
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      setProfiles(result.profiles);
      setAbsences(result.absences);
      if (profileId) {
        setJumpSelectedEmployeeId(profileId);
        const displayRows = buildOverviewAbsenceDisplayRows({
          absences: result.absences,
          profiles: result.profiles,
          todayISO: todayISO(),
        });
        const firstRowId =
          firstOverviewAbsenceRowIdForEmployee(displayRows, profileId) ??
          (createdId && displayRows.some((row) => row.id === createdId)
            ? createdId
            : null);
        if (firstRowId) {
          applyCreatedListSelection(firstRowId, setSelectedAbsenceId, setScrollToItemId);
        } else {
          setSelectedAbsenceId(null);
        }
      } else if (createdId) {
        setSelectedAbsenceId(createdId);
        setScrollToItemId(createdId);
      }
      setFormMode(null);
      refreshList();
    });
  }

  function handleRemove() {
    if (!selectedAbsence) return;
    const profileId = selectedAbsence.employee_id;
    const deletedId = selectedAbsence.id;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteAbsence(deletedId);
      if (!result.ok) {
        setErrorMessage(resolveShiftGuardActionError(result.error, t));
        return;
      }
      const remaining = absences.filter((entry) => entry.id !== deletedId);
      const displayRows = buildOverviewAbsenceDisplayRows({
        absences: remaining,
        profiles,
        todayISO: todayISO(),
      });
      setAbsences(remaining);
      setJumpSelectedEmployeeId(profileId);
      setSelectedAbsenceId(firstOverviewAbsenceRowIdForEmployee(displayRows, profileId));
      setConfirmRemove(false);
      refreshList();
    });
  }

  function handleBulkRemove() {
    const ids = rowIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      let nextAbsences = absences;
      for (const id of ids) {
        const result = await deleteAbsence(id);
        if (!result.ok) {
          setErrorMessage(resolveShiftGuardActionError(result.error, t));
          bulkSelection.clear();
          setConfirmBulkRemove(false);
          setAbsences(nextAbsences);
          refreshList();
          return;
        }
        nextAbsences = nextAbsences.filter((entry) => entry.id !== id);
      }
      const displayRows = buildOverviewAbsenceDisplayRows({
        absences: nextAbsences,
        profiles,
        todayISO: todayISO(),
      });
      setAbsences(nextAbsences);
      setSelectedAbsenceId((current) =>
        current && displayRows.some((row) => row.id === current) ? current : null
      );
      const bulkDeletedProfileIds = new Set(
        ids
          .map((id) => absences.find((entry) => entry.id === id)?.employee_id)
          .filter((id): id is string => !!id)
      );
      for (const employeeId of bulkDeletedProfileIds) {
        const hasVisibleRows = displayRows.some((row) => row.employeeId === employeeId);
        if (!hasVisibleRows) {
          setJumpSelectedEmployeeId(employeeId);
          break;
        }
      }
      bulkSelection.clear();
      setConfirmBulkRemove(false);
      refreshList();
    });
  }

  function handleReview(approve: boolean) {
    if (!selectedAbsence || selectedAbsence.status !== "pending") return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await reviewAbsenceRequest(selectedAbsence.id, approve);
      if (!result.ok) {
        setErrorMessage(
          result.error === "OVERLAP"
            ? t("settings.absences.validation.overlap")
            : result.error
        );
        return;
      }
      void loadData();
      refreshList();
    });
  }

  function handleCloseSick() {
    if (!selectedAbsence) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await closeOpenAbsence(selectedAbsence.id, closeSickDate);
      if (!result.ok) {
        setErrorMessage(
          result.error === "END_BEFORE_START"
            ? t("settings.absences.validation.endBeforeStart")
            : result.error
        );
        return;
      }
      setCloseSickOpen(false);
      void loadData();
      refreshList();
    });
  }

  function handleJumpToEmployee(employeeId: string, firstRowId: string | null) {
    jumpToEmployee(employeeId, firstRowId);
  }

  function typeLabel(type: AbsenceType): string {
    switch (type) {
      case "vacation":
        return t("settings.absences.typeVacation");
      case "sick":
        return t("settings.absences.typeSick");
      case "other":
        return t("settings.absences.typeOther");
    }
  }

  function statusLabel(status: RequestStatus): string {
    switch (status) {
      case "pending":
        return t("settings.absences.statusPending");
      case "approved":
        return t("settings.absences.statusApproved");
      case "rejected":
        return t("settings.absences.statusRejected");
      case "cancelled":
        return t("settings.absences.statusCancelled");
    }
  }

  return (
    <div
      className={cn(
        areaCalendarModalBackdropClass(),
        (waitingForContent || pending) && "cursor-wait"
      )}
      role="presentation"
      aria-busy={waitingForContent || pending}
      onMouseDown={(event) => {
        if (waitingForContent || anySubModalOpen) return;
        if (modalRootRef.current?.contains(event.target as Node)) return;
        onClose();
      }}
    >
      {!loading ? (
        <div
          ref={modalRootRef}
          className={cn(settingsModalRootClass("4xl"), !contentReady && "invisible pointer-events-none")}
          aria-hidden={!contentReady}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="overview-absences-editable-modal-title"
            aria-hidden={anySubModalOpen}
            className={cn(
              settingsModalDialogClass(),
              anySubModalOpen ? "pointer-events-none" : ""
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between gap-3 border-b border-border",
                settingsModalHeaderPaddingClass()
              )}
            >
              <div className="min-w-0">
                <h2
                  id="overview-absences-editable-modal-title"
                  className={SETTINGS_MODAL_TITLE_CLASS}
                >
                  {t("overview.absences.title")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {t("overview.absences.inlineEditHint")}
                </p>
              </div>
              <IconButton
                size="sm"
                onClick={onClose}
                aria-label={t("common.close")}
                className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
              >
                <CloseIcon className="h-[18px] w-[18px]" />
              </IconButton>
            </div>

            <div className={cn(settingsModalBodyPaddingClass(), "bg-background")}>
              {errorMessage ? (
                <p className="mb-3 text-sm text-red-700">{errorMessage}</p>
              ) : null}

              <div className="flex flex-col rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
                <div className="relative z-30 flex shrink-0 items-center justify-between gap-3 overflow-visible border-b border-border bg-subtle px-3 py-2.5">
                  <h3 className="min-w-0 truncate text-sm font-medium text-foreground">
                    {t("overview.absences.listTitle")}
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
                      message={t("overview.absences.emptyList")}
                      hint={t("overview.absences.emptyEditHint")}
                    />
                  ) : (
                    <div
                      className={cn(
                        settingsScrollableTableListClass(),
                        enableScroll && OVERVIEW_ABSENCES_LIST_SCROLL_CLASS
                      )}
                    >
                      <table className="w-full min-w-[36rem] border-collapse">
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
                              {t("settings.absences.type")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("overview.absences.period")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("overview.absences.time")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.status")}
                            </th>
                            <th
                              className={settingsOverviewListRowActionsHeaderClass()}
                              aria-hidden
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const isSelected = row.id === selectedAbsenceId;
                            return (
                              <tr
                                key={row.id}
                                {...settingsListItemAttrs(row.id)}
                                onClick={(event) => {
                                  if (shouldIgnoreSettingsListRowActivation(event)) {
                                    return;
                                  }
                                  setSelectedAbsenceId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setConfirmRemove(false);
                                  setConfirmBulkRemove(false);
                                  setCloseSickOpen(false);
                                  setFormMode(null);
                                  setErrorMessage(null);
                                }}
                                onDoubleClick={(event) => {
                                  event.preventDefault();
                                  window.getSelection()?.removeAllRanges();
                                  const absence = absencesById.get(row.id);
                                  if (!absence || !canEditAbsence(absence)) return;
                                  setSelectedAbsenceId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setFormMode({ type: "edit", absence });
                                  setConfirmRemove(false);
                                  setConfirmBulkRemove(false);
                                  setCloseSickOpen(false);
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
                                <td className={settingsDataCellClass(isSelected)}>
                                  {typeLabel(row.type)}
                                </td>
                                <td className={settingsDataCellClass(isSelected)}>
                                  {dateFormatter.format(
                                    new Date(`${row.startDate}T12:00:00`)
                                  )}
                                  {" – "}
                                  {formatEndDateLabel(
                                    row,
                                    dateFormatter,
                                    t("settings.absences.openEnded")
                                  )}
                                </td>
                                <td className={settingsDataCellClass(isSelected)}>
                                  {t("overview.absences.fullDay")}
                                </td>
                                <td className={settingsDataCellClass(isSelected)}>
                                  {statusLabel(row.status)}
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
                                        setSelectedAbsenceId(row.id);
                                        setJumpSelectedEmployeeId(row.employeeId);
                                        setFormMode(null);
                                        setConfirmBulkRemove(false);
                                        setCloseSickOpen(false);
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
                      disabled={pending || !createEmployeeId}
                      onClick={() => {
                        setFormMode({ type: "create" });
                        setConfirmRemove(false);
                        setConfirmBulkRemove(false);
                        setCloseSickOpen(false);
                        setErrorMessage(null);
                      }}
                    />
                  }
                  secondary={
                    <>
                      {canReviewSelected ? (
                        <>
                          <SettingsIconActionButton
                            label={t("settings.absences.approve")}
                            icon={<CheckIcon />}
                            disabled={pending}
                            onClick={() => handleReview(true)}
                          />
                          <SettingsIconActionButton
                            label={t("settings.absences.reject")}
                            icon={<CloseIcon />}
                            disabled={pending}
                            onClick={() => handleReview(false)}
                          />
                        </>
                      ) : null}
                      {canCloseSickSelected ? (
                        <SettingsIconActionButton
                          label={t("settings.absences.healthyAgain")}
                          icon={<CheckIcon />}
                          disabled={pending}
                          onClick={() => {
                            setCloseSickDate(todayISO());
                            setCloseSickOpen(true);
                          }}
                        />
                      ) : null}
                      <SettingsIconActionButton
                        label={t("profiles.edit")}
                        icon={<PencilIcon />}
                        disabled={pending || !canEditSelected}
                        onClick={() => {
                          if (!selectedAbsence || !canEditSelected) return;
                          setFormMode({ type: "edit", absence: selectedAbsence });
                          setConfirmRemove(false);
                          setConfirmBulkRemove(false);
                          setCloseSickOpen(false);
                        }}
                      />
                    </>
                  }
                  destructive={
                    <SettingsBulkDeleteActionButton
                      label={t("common.deleteSelectedEntries")}
                      disabled={pending || !bulkSelection.canBulkDelete}
                      onClick={() => {
                        setConfirmRemove(false);
                        setFormMode(null);
                        setCloseSickOpen(false);
                        setConfirmBulkRemove(true);
                      }}
                    />
                  }
                />
              </div>

              {createEmployeeId ? (
                <p className="mt-3 text-xs text-muted">
                  {t("overview.absences.selectedEmployeeHint", {
                    name:
                      profiles.find((profile) => profile.id === createEmployeeId)
                        ?.full_name ?? "—",
                  })}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  {t("overview.absences.selectEmployeeHint")}
                </p>
              )}
            </div>

            <div className={settingsModalFooterClass()}>
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                <CloseIcon />
                {t("common.close")}
              </Button>
            </div>
          </div>

          {formMode?.type === "create" && createEmployeeId ? (
            <AbsenceFormModal
              mode="create"
              initialDraft={emptyAbsenceDraft(createEmployeeId)}
              profiles={profiles}
              existingRanges={existingRanges}
              lockEmployeeId
              onClose={() => setFormMode(null)}
              onSaved={handleFormSaved}
            />
          ) : null}
          {formMode?.type === "edit" ? (
            <AbsenceFormModal
              mode="edit"
              absenceId={formMode.absence.id}
              initialDraft={absenceDraftFromRequest(formMode.absence)}
              profiles={profiles}
              existingRanges={existingRanges}
              onClose={() => setFormMode(null)}
              onSaved={handleFormSaved}
            />
          ) : null}
          {confirmRemove && selectedAbsence ? (
            <DeleteConfirmModal
              name={`${profiles.find((profile) => profile.id === selectedAbsence.employee_id)?.full_name ?? "—"} (${dateFormatter.format(new Date(`${selectedAbsence.start_date}T12:00:00`))} – ${formatEndDateLabel(
                {
                  endDate: selectedAbsence.end_date,
                  isOpenEnded: selectedAbsence.is_open_ended,
                },
                dateFormatter,
                t("settings.absences.openEnded")
              )})`}
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
          {closeSickOpen && selectedAbsence ? (
            <div
              className={settingsNestedModalOverlayClass()}
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !pending) {
                  setCloseSickOpen(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="overview-close-sick-title"
                className={settingsConfirmDialogClass()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <h4
                  id="overview-close-sick-title"
                  className="text-base font-semibold text-foreground"
                >
                  {t("settings.absences.healthyAgainTitle")}
                </h4>
                <p className="mt-2 text-sm text-muted">
                  {t("settings.absences.healthyAgainMessage")}
                </p>
                <div className="mt-4">
                  <LabelMuted>{t("settings.absences.endDate")}</LabelMuted>
                  <Input
                    type="date"
                    value={closeSickDate}
                    min={selectedAbsence.start_date}
                    onChange={(event) => setCloseSickDate(event.target.value)}
                    disabled={pending}
                  />
                </div>
                <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCloseSickOpen(false)}
                    disabled={pending}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleCloseSick}
                    disabled={pending}
                  >
                    {t("settings.absences.healthyAgainConfirm")}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
