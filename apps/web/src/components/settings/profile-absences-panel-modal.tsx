"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AbsenceRange } from "@schichtwerk/database";
import type { AbsenceRequest, AbsenceType, Profile, RequestStatus } from "@schichtwerk/types";
import {
  closeOpenAbsence,
  deleteAbsence,
  fetchProfileAbsences,
  reviewAbsenceRequest,
} from "@/app/actions/absences";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { filterOverviewAbsences } from "@/lib/overview-absences-display";
import { resolveShiftGuardActionError } from "@/lib/shift-guard-action-error";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";
import {
  AbsenceFormModal,
  absenceDraftFromRequest,
  absenceRangesFromRequests,
  emptyAbsenceDraft,
} from "./absence-form-modal";
import { DeleteConfirmModal } from "./delete-confirm-modal";
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
  shouldIgnoreSettingsListRowActivation,
  settingsConfirmDialogClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsEmbeddedDetailPanelBodyClass,
  settingsEmbeddedDetailPanelInnerClass,
  settingsEmbeddedDetailPanelShellClass,
  settingsListItemAttrs,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalOverlayClass,
  settingsOverviewListRowActionsHeaderClass,
  settingsProfileEmbeddedListScrollClass,
  settingsScrollableTableListClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  useScrollToSettingsListItem,
  OVERVIEW_ABSENCES_LIST_SCROLL_CLASS,
} from "./settings-list-ui";
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

const OVERLAP_STATUSES: RequestStatus[] = ["approved", "pending"];

type FormMode =
  | null
  | { type: "create" }
  | { type: "edit"; absence: AbsenceRequest };

type Props = {
  profile: Profile;
  profiles: Profile[];
  onClose: () => void;
  onCacheUpdate?: (profileId: string, absences: AbsenceRequest[]) => void;
  /** In Slide-in-Profile: Inhalt ohne Sub-Modal-Overlay. */
  embedded?: boolean;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function sortVisibleAbsences(absences: readonly AbsenceRequest[]): AbsenceRequest[] {
  return [...absences].sort((a, b) => {
    const byStart = a.start_date.localeCompare(b.start_date);
    if (byStart !== 0) return byStart;
    return a.id.localeCompare(b.id);
  });
}

function firstVisibleAbsenceId(absences: readonly AbsenceRequest[]): string | null {
  return sortVisibleAbsences(filterOverviewAbsences(absences, todayISO()))[0]?.id ?? null;
}

function formatEndDateLabel(
  item: Pick<AbsenceRequest, "end_date" | "is_open_ended">,
  dateFormatter: Intl.DateTimeFormat,
  openLabel: string
): string {
  if (item.is_open_ended && !item.end_date) return openLabel;
  if (!item.end_date) return "—";
  return dateFormatter.format(new Date(`${item.end_date}T12:00:00`));
}

function canEditAbsence(item: AbsenceRequest): boolean {
  return (
    item.status !== "pending" &&
    item.status !== "rejected" &&
    item.status !== "cancelled"
  );
}

export function ProfileAbsencesPanelModal({
  profile,
  profiles,
  onClose,
  onCacheUpdate,
  embedded = false,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<AbsenceRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
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

  const loadAbsences = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const result = await fetchProfileAbsences(profile.id);
    if (!result.ok) {
      setErrorMessage(result.error);
      setLoading(false);
      return;
    }
    setList(result.absences);
    onCacheUpdate?.(profile.id, result.absences);
    setLoading(false);
  }, [profile.id, onCacheUpdate]);

  useEffect(() => {
    void loadAbsences();
  }, [loadAbsences]);

  useEffect(() => {
    if (embedded) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [embedded]);

  const absencesById = useMemo(
    () => new Map(list.map((absence) => [absence.id, absence])),
    [list]
  );

  const visibleAbsences = useMemo(
    () => sortVisibleAbsences(filterOverviewAbsences(list, todayISO())),
    [list]
  );

  const rowIds = useMemo(() => visibleAbsences.map((item) => item.id), [visibleAbsences]);
  const bulkSelection = useSettingsListBulkSelection(rowIds);
  const enableScroll = visibleAbsences.length >= 10;

  useScrollToSettingsListItem(
    visibleAbsences,
    scrollToItemId,
    () => setScrollToItemId(null),
    "top"
  );

  useEffect(() => {
    if (!selectedId) return;
    if (visibleAbsences.some((item) => item.id === selectedId)) return;
    setSelectedId(null);
  }, [selectedId, visibleAbsences]);

  const selected = selectedId ? (absencesById.get(selectedId) ?? null) : null;

  const existingRanges = useMemo((): AbsenceRange[] => {
    return absenceRangesFromRequests(
      list.filter((entry) => OVERLAP_STATUSES.includes(entry.status))
    );
  }, [list]);

  const canEditSelected = selected ? canEditAbsence(selected) : false;
  const canReviewSelected = selected?.status === "pending";
  const canRejectSelected = canReviewSelected && selected?.type !== "sick";
  const canCloseSickSelected =
    selected?.status === "approved" && selected.is_open_ended;

  const anyNestedOpen = Boolean(
    formMode || confirmRemove || confirmBulkRemove || closeSickOpen
  );

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

  function refreshList() {
    startTransition(() => {
      router.refresh();
    });
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

  function handleFormSaved(createdId?: string) {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await fetchProfileAbsences(profile.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      setList(result.absences);
      onCacheUpdate?.(profile.id, result.absences);
      const visible = sortVisibleAbsences(
        filterOverviewAbsences(result.absences, todayISO())
      );
      const firstRowId =
        (createdId && visible.some((item) => item.id === createdId)
          ? createdId
          : null) ?? visible[0]?.id ?? null;
      if (firstRowId) {
        applyCreatedListSelection(firstRowId, setSelectedId, setScrollToItemId);
      } else {
        setSelectedId(null);
      }
      setFormMode(null);
      refreshList();
    });
  }

  function handleRemove() {
    if (!selected) return;
    const deletedId = selected.id;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteAbsence(deletedId);
      if (!result.ok) {
        setErrorMessage(resolveShiftGuardActionError(result.error, t));
        return;
      }
      const remaining = list.filter((entry) => entry.id !== deletedId);
      setList(remaining);
      onCacheUpdate?.(profile.id, remaining);
      setSelectedId(firstVisibleAbsenceId(remaining));
      setConfirmRemove(false);
      refreshList();
    });
  }

  function handleBulkRemove() {
    const ids = rowIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      let nextList = list;
      for (const id of ids) {
        const result = await deleteAbsence(id);
        if (!result.ok) {
          setErrorMessage(resolveShiftGuardActionError(result.error, t));
          bulkSelection.clear();
          setConfirmBulkRemove(false);
          setList(nextList);
          refreshList();
          return;
        }
        nextList = nextList.filter((entry) => entry.id !== id);
      }
      setList(nextList);
      onCacheUpdate?.(profile.id, nextList);
      setSelectedId((current) =>
        current && filterOverviewAbsences(nextList, todayISO()).some((item) => item.id === current)
          ? current
          : firstVisibleAbsenceId(nextList)
      );
      bulkSelection.clear();
      setConfirmBulkRemove(false);
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
            : result.error === "SICK_CANNOT_REJECT"
              ? t("settings.absences.validation.sickCannotReject")
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

  if (embedded && loading) {
    return (
      <div className="flex shrink-0 items-center justify-center py-8 text-sm text-muted">
        {t("common.loading")}
      </div>
    );
  }

  const panelContent = (
    <>
        {!embedded ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <div className="min-w-0">
            <h3 id="profile-absences-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("profiles.panelAbsencesOf", { name: profile.full_name })}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {t("overview.absences.inlineEditHint")}
            </p>
          </div>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={pending}
            aria-label={t("common.close")}
            className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>
        ) : null}

        <div
          className={
            embedded
              ? settingsEmbeddedDetailPanelBodyClass()
              : "min-h-0 flex-1 overflow-y-auto bg-background px-4 py-3"
          }
        >
          {errorMessage ? (
            <div className="mb-3 shrink-0">
              <Alert variant="error">{errorMessage}</Alert>
            </div>
          ) : null}

          <div className="flex flex-col rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
            <div className="flex shrink-0 items-center border-b border-border bg-subtle px-3 py-2.5">
              <h4 className="min-w-0 truncate text-sm font-medium text-foreground">
                {t("overview.absences.listTitle")}
              </h4>
            </div>

            <div className="min-h-0 overflow-hidden bg-background px-2 py-2">
              {visibleAbsences.length === 0 ? (
                <SettingsEmptyState
                  message={t("overview.absences.emptyList")}
                  hint={t("overview.absences.emptyEditHint")}
                />
              ) : (
                <div
                  className={cn(
                    settingsScrollableTableListClass(),
                    embedded
                      ? settingsProfileEmbeddedListScrollClass(visibleAbsences.length)
                      : enableScroll && OVERVIEW_ABSENCES_LIST_SCROLL_CLASS
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
                      {visibleAbsences.map((item) => {
                        const isSelected = item.id === selectedId;
                        return (
                          <tr
                            key={item.id}
                            {...settingsListItemAttrs(item.id)}
                            onClick={(event) => {
                              if (shouldIgnoreSettingsListRowActivation(event)) {
                                return;
                              }
                              setSelectedId(item.id);
                              setConfirmRemove(false);
                              setConfirmBulkRemove(false);
                              setCloseSickOpen(false);
                              setFormMode(null);
                              setErrorMessage(null);
                            }}
                            onDoubleClick={(event) => {
                              event.preventDefault();
                              window.getSelection()?.removeAllRanges();
                              if (!canEditAbsence(item)) return;
                              setSelectedId(item.id);
                              setFormMode({ type: "edit", absence: item });
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
                              {typeLabel(item.type)}
                            </td>
                            <td className={settingsDataCellClass(isSelected)}>
                              {dateFormatter.format(
                                new Date(`${item.start_date}T12:00:00`)
                              )}
                              {" – "}
                              {formatEndDateLabel(
                                item,
                                dateFormatter,
                                t("settings.absences.openEnded")
                              )}
                            </td>
                            <td className={settingsDataCellClass(isSelected)}>
                              {t("overview.absences.fullDay")}
                            </td>
                            <td className={settingsDataCellClass(isSelected)}>
                              {statusLabel(item.status)}
                            </td>
                            <SettingsOverviewListRowActions
                              isSelected={isSelected}
                              checkbox={
                                <SettingsListRowCheckbox
                                  checked={bulkSelection.isChecked(item.id)}
                                  disabled={pending}
                                  ariaLabel={t("common.selectRow")}
                                  className="mx-0"
                                  onChange={() => bulkSelection.toggle(item.id)}
                                />
                              }
                              deleteButton={
                                <SettingsListRowDeleteButton
                                  label={t("profiles.delete")}
                                  disabled={pending}
                                  onClick={() => {
                                    setSelectedId(item.id);
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
                  disabled={pending}
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
                      {canRejectSelected ? (
                        <SettingsIconActionButton
                          label={t("settings.absences.reject")}
                          icon={<CloseIcon />}
                          disabled={pending}
                          onClick={() => handleReview(false)}
                        />
                      ) : null}
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
                      if (!selected || !canEditSelected) return;
                      setFormMode({ type: "edit", absence: selected });
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
        </div>

        <div className={settingsModalFooterClass()}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            <CloseIcon />
            {embedded ? t("profiles.title") : t("common.close")}
          </Button>
        </div>
    </>
  );

  const panelOverlays = (
    <>
      {formMode?.type === "create" ? (
        <AbsenceFormModal
          mode="create"
          initialDraft={emptyAbsenceDraft(profile.id)}
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

      {confirmRemove && selected ? (
        <DeleteConfirmModal
          name={`${profile.full_name} (${dateFormatter.format(new Date(`${selected.start_date}T12:00:00`))} – ${formatEndDateLabel(
            selected,
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

      {closeSickOpen && selected ? (
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
            aria-labelledby="profile-close-sick-title"
            className={settingsConfirmDialogClass()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h4
              id="profile-close-sick-title"
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
    </>
  );

  if (embedded) {
    return (
      <div
        className={cn(
          settingsEmbeddedDetailPanelShellClass(),
          (loading || pending) && "cursor-wait [&_*]:cursor-wait"
        )}
        aria-busy={loading || pending}
      >
        <div
          className={cn(
            settingsEmbeddedDetailPanelInnerClass(),
            anyNestedOpen && "pointer-events-none"
          )}
        >
          {panelContent}
        </div>
        {panelOverlays}
      </div>
    );
  }

  return (
    <div
      className={cn(settingsSubModalOverlayClass(), (loading || pending) && "cursor-wait")}
      role="presentation"
      aria-busy={loading || pending}
      onMouseDown={(event) => {
        if (loading || anyNestedOpen) return;
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {!loading ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-absences-title"
          aria-hidden={anyNestedOpen}
          className={cn(
            settingsSubModalDialogClass("4xl"),
            anyNestedOpen ? "pointer-events-none" : ""
          )}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {panelContent}
        </div>
      ) : null}
      {panelOverlays}
    </div>
  );
}
