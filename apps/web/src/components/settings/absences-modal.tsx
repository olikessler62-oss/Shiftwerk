"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AbsenceRange } from "@schichtwerk/database";
import type { AbsenceRequest, AbsenceType, Profile, RequestStatus } from "@schichtwerk/types";
import {
  closeOpenAbsence,
  deleteAbsence,
  fetchOrganizationAbsences,
  reviewAbsenceRequest,
} from "@/app/actions/absences";
import {
  applyCreatedListSelection,
  SETTINGS_ABSENCES_LIST_SCROLL_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsListRowDeleteButton,
  SettingsListRowCheckbox,
  SettingsBulkDeleteActionButton,
  settingsConfirmDialogClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsListItemAttrs,
  settingsModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsModalRootClass,
  settingsNestedModalOverlayClass,
  settingsPanelHeaderClass,
  settingsScrollableTableListClass,
  settingsListRowDeleteCellClass,
  settingsListRowDeleteHeaderClass,
  settingsListRowCheckboxCellClass,
  settingsListRowCheckboxHeaderClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  useScrollToSettingsListItem,
} from "./settings-list-ui";
import {
  AbsenceFormModal,
  absenceDraftFromRequest,
  absenceRangesFromRequests,
  emptyAbsenceDraft,
} from "./absence-form-modal";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  Input,
  LabelMuted,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";

type Props = {
  profiles: Profile[];
  onClose: () => void;
};

type FormMode =
  | null
  | { type: "create" }
  | { type: "edit"; absence: AbsenceRequest };

type StatusFilter = "all" | "pending";

const NOTES_MAX = 40;
const OVERLAP_STATUSES: RequestStatus[] = ["approved", "pending"];

function truncateNotes(value: string | null): string {
  if (!value) return "";
  if (value.length <= NOTES_MAX) return value;
  return `${value.slice(0, NOTES_MAX - 1)}…`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatEndDateLabel(
  item: AbsenceRequest,
  dateFormatter: Intl.DateTimeFormat,
  openLabel: string
): string {
  if (item.is_open_ended && !item.end_date) return openLabel;
  if (!item.end_date) return "—";
  return dateFormatter.format(new Date(`${item.end_date}T12:00:00`));
}

export function AbsencesModal({ profiles, onClose }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<AbsenceRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [closeSickOpen, setCloseSickOpen] = useState(false);
  const [closeSickDate, setCloseSickDate] = useState(todayISO());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(toIntlLocale(locale), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale]
  );

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const filteredList = useMemo(() => {
    if (statusFilter === "pending") {
      return list.filter((entry) => entry.status === "pending");
    }
    return list;
  }, [list, statusFilter]);

  const filteredAbsenceIds = useMemo(
    () => filteredList.map((entry) => entry.id),
    [filteredList]
  );
  const bulkSelection = useSettingsListBulkSelection(filteredAbsenceIds);

  const existingRanges = useMemo((): AbsenceRange[] => {
    return absenceRangesFromRequests(
      list.filter((entry) => OVERLAP_STATUSES.includes(entry.status))
    );
  }, [list]);

  const selected = filteredList.find((entry) => entry.id === selectedId);

  const clearScrollTarget = useCallback(() => setScrollToItemId(null), []);
  useScrollToSettingsListItem(filteredList, scrollToItemId, clearScrollTarget);

  const loadAbsences = useCallback(async () => {
    setLoading(true);
    const result = await fetchOrganizationAbsences();
    if (!result.ok) {
      setErrorMessage(result.error);
      setLoading(false);
      return;
    }
    setList(result.absences);
    setSelectedId((current) => {
      if (current && result.absences.some((entry) => entry.id === current)) {
        return current;
      }
      return result.absences[0]?.id ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAbsences();
  }, [loadAbsences]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [loading]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (loading) {
        onClose();
        return;
      }
      if (formMode) {
        setFormMode(null);
        return;
      }
      if (closeSickOpen) {
        setCloseSickOpen(false);
        return;
      }
      if (confirmDelete) {
        setConfirmDelete(false);
        return;
      }
      if (confirmBulkDelete) {
        setConfirmBulkDelete(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeSickOpen, confirmBulkDelete, confirmDelete, formMode, loading, onClose]);

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

  function statusBadgeClass(status: RequestStatus): string {
    switch (status) {
      case "pending":
        return "text-amber-700";
      case "approved":
        return "text-emerald-700";
      case "rejected":
        return "text-red-700";
      default:
        return "text-muted";
    }
  }

  function refreshList() {
    router.refresh();
  }

  function handleFormSaved(createdId?: string) {
    applyCreatedListSelection(createdId, setSelectedId, setScrollToItemId);
    void loadAbsences();
    refreshList();
  }

  function openCreate() {
    setFormMode({ type: "create" });
    setConfirmDelete(false);
    setCloseSickOpen(false);
    setErrorMessage(null);
  }

  function openEdit(absence: AbsenceRequest) {
    if (absence.status === "pending") return;
    setFormMode({ type: "edit", absence });
    setConfirmDelete(false);
    setCloseSickOpen(false);
    setErrorMessage(null);
  }

  function handleDelete() {
    if (!selected) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteAbsence(selected.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        setConfirmDelete(false);
        return;
      }
      setList((prev) => {
        const remaining = prev.filter((entry) => entry.id !== selected.id);
        setSelectedId(remaining[0]?.id ?? null);
        return remaining;
      });
      setConfirmDelete(false);
      refreshList();
    });
  }

  function handleBulkDelete() {
    const ids = filteredAbsenceIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      for (const id of ids) {
        const result = await deleteAbsence(id);
        if (!result.ok) {
          setErrorMessage(result.error);
          bulkSelection.clear();
          setConfirmBulkDelete(false);
          void loadAbsences();
          refreshList();
          return;
        }
      }
      setList((prev) => {
        const remaining = prev.filter((entry) => !ids.includes(entry.id));
        setSelectedId((current) =>
          current && remaining.some((entry) => entry.id === current)
            ? current
            : (remaining[0]?.id ?? null)
        );
        return remaining;
      });
      bulkSelection.clear();
      setConfirmBulkDelete(false);
      refreshList();
    });
  }

  function handleReview(approve: boolean) {
    if (!selected || selected.status !== "pending") return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await reviewAbsenceRequest(selected.id, approve);
      if (!result.ok) {
        setErrorMessage(
          result.error === "OVERLAP"
            ? t("settings.absences.validation.overlap")
            : result.error
        );
        return;
      }
      void loadAbsences();
      refreshList();
    });
  }

  function handleCloseSick() {
    if (!selected) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await closeOpenAbsence(selected.id, closeSickDate);
      if (!result.ok) {
        setErrorMessage(
          result.error === "END_BEFORE_START"
            ? t("settings.absences.validation.endBeforeStart")
            : result.error
        );
        return;
      }
      setCloseSickOpen(false);
      void loadAbsences();
      refreshList();
    });
  }

  const canEditSelected =
    selected &&
    selected.status !== "pending" &&
    selected.status !== "rejected" &&
    selected.status !== "cancelled";
  const canReviewSelected = selected?.status === "pending";
  const canCloseSickSelected =
    selected?.status === "approved" && selected.is_open_ended;

  return (
    <div
      className={cn(settingsModalBackdropClass(), loading && "cursor-wait")}
      role="presentation"
      aria-busy={loading}
      onMouseDown={(e) => {
        if (
          e.target === e.currentTarget &&
          !formMode &&
          !confirmDelete &&
          !confirmBulkDelete &&
          !closeSickOpen
        ) {
          onClose();
        }
      }}
    >
      {!loading ? (
        <div
          className={settingsModalRootClass("4xl")}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="absences-modal-title"
            aria-hidden={!!formMode}
            className={cn(
              settingsModalDialogClass(),
              formMode ? "pointer-events-none" : ""
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between border-b border-border",
                settingsModalHeaderPaddingClass()
              )}
            >
              <h2 id="absences-modal-title" className={SETTINGS_MODAL_TITLE_CLASS}>
                {t("settings.absences.title")}
              </h2>
              <IconButton
                size="sm"
                onClick={onClose}
                aria-label={t("common.close")}
                className="border-transparent bg-transparent hover:bg-subtle"
              >
                <CloseIcon className="h-[18px] w-[18px]" />
              </IconButton>
            </div>

            {errorMessage && (
              <div className="mx-6 mt-4 shrink-0">
                <Alert variant="error">{errorMessage}</Alert>
              </div>
            )}

            <div className={cn(settingsModalBodyPaddingClass(), "bg-background")}>
              <div className="mb-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={statusFilter === "all" ? "primary" : "outline"}
                  onClick={() => setStatusFilter("all")}
                >
                  {t("settings.absences.filterAll")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={statusFilter === "pending" ? "primary" : "outline"}
                  onClick={() => setStatusFilter("pending")}
                >
                  {t("settings.absences.filterPending")}
                </Button>
              </div>

              <div className="flex flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
                <h3 className={settingsPanelHeaderClass()}>
                  {t("settings.absences.column")}
                </h3>

                <div className="space-y-1 bg-background px-2 py-2">
                  {filteredList.length === 0 ? (
                    <SettingsEmptyState
                      message={t("settings.absences.emptyList")}
                      hint={t("common.emptyHintCreate")}
                    />
                  ) : (
                    <div
                      className={cn(
                        settingsScrollableTableListClass(),
                        SETTINGS_ABSENCES_LIST_SCROLL_CLASS
                      )}
                    >
                      <table className="w-full min-w-[36rem] border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th
                              className={settingsStickyIndicatorHeaderClass("w-3")}
                              aria-hidden
                            />
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.employee")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.type")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.status")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.startDate")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.endDate")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.notes")}
                            </th>
                            <th
                              className={settingsListRowCheckboxHeaderClass()}
                              aria-hidden
                            />
                            <th
                              className={settingsListRowDeleteHeaderClass()}
                              aria-hidden
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {filteredList.map((item) => {
                            const profile = profileById.get(item.employee_id);
                            const isSelected = item.id === selectedId;
                            return (
                              <tr
                                key={item.id}
                                {...settingsListItemAttrs(item.id)}
                                onClick={() => {
                                  setSelectedId(item.id);
                                  setConfirmDelete(false);
                                  setConfirmBulkDelete(false);
                                  setCloseSickOpen(false);
                                  setErrorMessage(null);
                                }}
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                  window.getSelection()?.removeAllRanges();
                                  openEdit(item);
                                }}
                                className={settingsDataRowClass(isSelected)}
                              >
                                <td
                                  className={settingsIndicatorCellClass(isSelected)}
                                  aria-hidden
                                />
                                <td className={settingsDataCellClass(isSelected)}>
                                  <span className="flex min-w-0 items-center gap-2">
                                    {profile?.color ? (
                                      <span
                                        className="size-3 shrink-0 rounded-full border border-border/60"
                                        style={{ backgroundColor: profile.color }}
                                        aria-hidden
                                      />
                                    ) : null}
                                    <span className="truncate font-medium">
                                      {profile?.full_name ?? "—"}
                                    </span>
                                  </span>
                                </td>
                                <td className={settingsDataCellClass(isSelected)}>
                                  {typeLabel(item.type)}
                                </td>
                                <td
                                  className={settingsDataCellClass(isSelected, {
                                    className: cn(
                                      "text-xs font-medium",
                                      statusBadgeClass(item.status)
                                    ),
                                  })}
                                >
                                  {statusLabel(item.status)}
                                </td>
                                <td className={settingsDataCellClass(isSelected)}>
                                  {dateFormatter.format(
                                    new Date(`${item.start_date}T12:00:00`)
                                  )}
                                </td>
                                <td className={settingsDataCellClass(isSelected)}>
                                  {formatEndDateLabel(
                                    item,
                                    dateFormatter,
                                    t("settings.absences.openEnded")
                                  )}
                                </td>
                                <td
                                  className={settingsDataCellClass(isSelected, {
                                    className: "max-w-[10rem] truncate text-muted",
                                  })}
                                >
                                  <Tooltip
                                    content={item.notes}
                                    className="block max-w-full truncate"
                                  >
                                    {truncateNotes(item.notes)}
                                  </Tooltip>
                                </td>
                                <td className={settingsListRowCheckboxCellClass(isSelected)}>
                                  <SettingsListRowCheckbox
                                    checked={bulkSelection.isChecked(item.id)}
                                    disabled={pending}
                                    ariaLabel={t("common.selectRow")}
                                    onChange={() => bulkSelection.toggle(item.id)}
                                  />
                                </td>
                                <td className={settingsListRowDeleteCellClass(isSelected)}>
                                  <SettingsListRowDeleteButton
                                    label={t("settings.absences.delete")}
                                    disabled={pending}
                                    showTooltip={false}
                                    onClick={() => {
                                      setSelectedId(item.id);
                                      setConfirmBulkDelete(false);
                                      setConfirmDelete(true);
                                      setErrorMessage(null);
                                    }}
                                  />
                                </td>
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
                      label={t("settings.absences.new")}
                      icon={<PlusIcon />}
                      disabled={pending}
                      onClick={openCreate}
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
                        label={t("settings.absences.edit")}
                        icon={<PencilIcon />}
                        disabled={pending || !canEditSelected}
                        onClick={() => {
                          if (!selected || !canEditSelected) return;
                          openEdit(selected);
                        }}
                      />
                    </>
                  }
                  destructive={
                    <SettingsBulkDeleteActionButton
                      label={t("common.deleteSelectedEntries")}
                      disabled={pending || !bulkSelection.canBulkDelete}
                      onClick={() => {
                        setConfirmDelete(false);
                        setFormMode(null);
                        setCloseSickOpen(false);
                        setConfirmBulkDelete(true);
                      }}
                    />
                  }
                />
              </div>
            </div>

            <div className={settingsModalFooterClass()}>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={pending}
              >
                <CloseIcon />
                {t("common.close")}
              </Button>
            </div>
          </div>

          {formMode && (
            <AbsenceFormModal
              mode={formMode.type}
              absenceId={formMode.type === "edit" ? formMode.absence.id : undefined}
              initialDraft={
                formMode.type === "create"
                  ? emptyAbsenceDraft()
                  : absenceDraftFromRequest(formMode.absence)
              }
              profiles={profiles}
              existingRanges={existingRanges}
              onClose={() => setFormMode(null)}
              onSaved={handleFormSaved}
            />
          )}

          {confirmDelete && selected && (
            <DeleteConfirmModal
              name={`${profileById.get(selected.employee_id)?.full_name ?? "—"} (${dateFormatter.format(new Date(`${selected.start_date}T12:00:00`))} – ${formatEndDateLabel(selected, dateFormatter, t("settings.absences.openEnded"))})`}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={handleDelete}
              pending={pending}
            />
          )}
          {confirmBulkDelete && bulkSelection.checkedCount > 0 && (
            <DeleteConfirmModal
              name={t("common.deleteSelectedEntries")}
              count={bulkSelection.checkedCount}
              onCancel={() => setConfirmBulkDelete(false)}
              onConfirm={handleBulkDelete}
              pending={pending}
            />
          )}

          {closeSickOpen && selected && (
            <div
              className={settingsNestedModalOverlayClass()}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget && !pending) {
                  setCloseSickOpen(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="close-sick-title"
                className={settingsConfirmDialogClass()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h4
                  id="close-sick-title"
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
                    min={selected.start_date}
                    onChange={(e) => setCloseSickDate(e.target.value)}
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
          )}
        </div>
      ) : null}
    </div>
  );
}
