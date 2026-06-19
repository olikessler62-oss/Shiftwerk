"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile, ProfileRecurringAvailability } from "@schichtwerk/types";
import { isOvernightAvailability } from "@schichtwerk/database";
import { deleteProfileRecurringAvailability } from "@/app/actions/profile-availability";
import { resolveShiftGuardActionError } from "@/lib/shift-guard-action-error";
import { fetchOverviewAvailabilities } from "@/app/actions/overview-availabilities";
import { DeleteConfirmModal } from "@/components/settings/delete-confirm-modal";
import { ProfileAvailabilityFormModal } from "@/components/settings/profile-availability-form-modal";
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
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsListItemAttrs,
  settingsOverviewListRowActionsHeaderClass,
  areaCalendarModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsModalRootClass,
  settingsScrollableTableListClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  OVERVIEW_ABSENCES_LIST_SCROLL_CLASS,
} from "@/components/settings/settings-list-ui";
import {
  Button,
  CloseIcon,
  IconButton,
  ListIcon,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  buildOverviewAvailabilityDisplayRows,
  buildOverviewAvailabilityEmployeeJumpOptions,
  countOverviewAvailabilityEmployees,
  firstOverviewAvailabilityRowIdForEmployee,
} from "@/lib/overview-availabilities-display";
import { useScrollToSettingsListItem } from "@/lib/settings-list-scroll";
import { useOverviewModalListScroll } from "@/lib/use-overview-modal-initial-scroll";
import { OverviewAvailabilitiesEmployeeJumpCombobox } from "./overview-availabilities-employee-jump-combobox";
import {
  formatAvailabilityTimeRange,
  formatProfileAvailabilitySummaryLabel,
  weekdayLabel,
} from "@/lib/profile-availability-label";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";

type Props = {
  onClose: () => void;
  initialEmployeeId?: string | null;
};

type AvailabilityFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; availability: ProfileRecurringAvailability }
  | { type: "bulk-edit"; availability: ProfileRecurringAvailability };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OverviewAvailabilitiesEditableModal({
  onClose,
  initialEmployeeId = null,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [availability, setAvailability] = useState<ProfileRecurringAvailability[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<string | null>(
    null
  );
  const [formMode, setFormMode] = useState<AvailabilityFormMode>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const [jumpSelectedEmployeeId, setJumpSelectedEmployeeId] = useState(
    initialEmployeeId ?? ""
  );
  const modalRootRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const result = await fetchOverviewAvailabilities();
    if (!result.ok) {
      setErrorMessage(resolveShiftGuardActionError(result.error, t));
      setLoading(false);
      return;
    }

    setProfiles(result.profiles);
    setAvailability(result.availability);
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
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmBulkRemove, confirmRemove, formMode, onClose]);

  const availabilityById = useMemo(
    () => new Map(availability.map((slot) => [slot.id, slot])),
    [availability]
  );

  const rows = useMemo(
    () =>
      buildOverviewAvailabilityDisplayRows({
        availability,
        profiles,
        todayISO: todayISO(),
      }),
    [availability, profiles]
  );

  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const bulkSelection = useSettingsListBulkSelection(rowIds);

  const employeeCount = useMemo(
    () => countOverviewAvailabilityEmployees(rows),
    [rows]
  );
  const employeeJumpOptions = useMemo(
    () => buildOverviewAvailabilityEmployeeJumpOptions(profiles, rows),
    [profiles, rows]
  );
  const enableScroll = employeeCount >= 10;

  const resolveFirstRowIdForEmployee = useCallback(
    (employeeId: string) =>
      firstOverviewAvailabilityRowIdForEmployee(rows, employeeId),
    [rows]
  );

  const handleEmployeePosition = useCallback(
    (employeeId: string, firstRowId: string | null) => {
      setJumpSelectedEmployeeId(employeeId);
      setSelectedAvailabilityId(firstRowId);
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
    if (!selectedAvailabilityId) return;
    if (rows.some((row) => row.id === selectedAvailabilityId)) return;
    setSelectedAvailabilityId(null);
  }, [rows, selectedAvailabilityId]);

  const selectedAvailability = selectedAvailabilityId
    ? (availabilityById.get(selectedAvailabilityId) ?? null)
    : null;
  const tableSelectedEmployeeId = selectedAvailability?.profile_id ?? null;
  const createEmployeeId =
    jumpSelectedEmployeeId || tableSelectedEmployeeId || null;
  const selectedEmployeeAvailability = useMemo(
    () =>
      createEmployeeId
        ? availability.filter((slot) => slot.profile_id === createEmployeeId)
        : [],
    [availability, createEmployeeId]
  );

  const mergeProfileAvailability = useCallback(
    (profileId: string, list: ProfileRecurringAvailability[]) => {
      setAvailability((current) => [
        ...current.filter((slot) => slot.profile_id !== profileId),
        ...list,
      ]);
      startTransition(() => {
        router.refresh();
      });
    },
    [router]
  );

  function handleSaved(
    list: ProfileRecurringAvailability[],
    selectedId: string,
    scrollToSelection = false
  ) {
    const profileId = list[0]?.profile_id ?? createEmployeeId;
    if (!profileId) return;
    mergeProfileAvailability(profileId, list);
    setJumpSelectedEmployeeId(profileId);

    const mergedAvailability = [
      ...availability.filter((slot) => slot.profile_id !== profileId),
      ...list,
    ];
    const firstRowId =
      firstOverviewAvailabilityRowIdForEmployee(
        buildOverviewAvailabilityDisplayRows({
          availability: mergedAvailability,
          profiles,
          todayISO: todayISO(),
        }),
        profileId
      ) ?? selectedId;

    if (scrollToSelection && firstRowId) {
      applyCreatedListSelection(
        firstRowId,
        setSelectedAvailabilityId,
        setScrollToItemId
      );
    } else if (selectedId) {
      setSelectedAvailabilityId(selectedId);
    }
    setFormMode(null);
  }

  function handleRemove() {
    if (!selectedAvailability) return;
    const profileId = selectedAvailability.profile_id;
    const deletedId = selectedAvailability.id;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteProfileRecurringAvailability({
        profileId,
        availabilityId: deletedId,
      });
      if (!result.ok) {
        setErrorMessage(resolveShiftGuardActionError(result.error, t));
        return;
      }
      const remaining = result.availability ?? [];
      const mergedAvailability = [
        ...availability.filter((slot) => slot.profile_id !== profileId),
        ...remaining,
      ];
      const displayRows = buildOverviewAvailabilityDisplayRows({
        availability: mergedAvailability,
        profiles,
        todayISO: todayISO(),
      });
      mergeProfileAvailability(profileId, remaining);
      setJumpSelectedEmployeeId(profileId);
      setSelectedAvailabilityId(
        firstOverviewAvailabilityRowIdForEmployee(displayRows, profileId)
      );
      setConfirmRemove(false);
    });
  }

  function handleBulkRemove() {
    const ids = rowIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      let nextAvailability = availability;
      for (const id of ids) {
        const slot = nextAvailability.find((entry) => entry.id === id);
        if (!slot) continue;
        const result = await deleteProfileRecurringAvailability({
          profileId: slot.profile_id,
          availabilityId: id,
        });
        if (!result.ok) {
          setErrorMessage(resolveShiftGuardActionError(result.error, t));
          bulkSelection.clear();
          setConfirmBulkRemove(false);
          setAvailability(nextAvailability);
          return;
        }
        nextAvailability = [
          ...nextAvailability.filter((entry) => entry.profile_id !== slot.profile_id),
          ...(result.availability ?? []),
        ];
      }
      setAvailability(nextAvailability);
      const displayRows = buildOverviewAvailabilityDisplayRows({
        availability: nextAvailability,
        profiles,
        todayISO: todayISO(),
      });
      setSelectedAvailabilityId((current) =>
        current && displayRows.some((row) => row.id === current) ? current : null
      );
      const bulkDeletedProfileIds = new Set(
        ids
          .map((id) => availability.find((entry) => entry.id === id)?.profile_id)
          .filter((id): id is string => !!id)
      );
      for (const profileId of bulkDeletedProfileIds) {
        const hasVisibleRows = displayRows.some((row) => row.employeeId === profileId);
        if (!hasVisibleRows) {
          setJumpSelectedEmployeeId(profileId);
          break;
        }
      }
      bulkSelection.clear();
      setConfirmBulkRemove(false);
      startTransition(() => {
        router.refresh();
      });
    });
  }

  function handleJumpToEmployee(employeeId: string, firstRowId: string | null) {
    jumpToEmployee(employeeId, firstRowId);
  }

  function dayLabel(row: (typeof rows)[number]): string {
    if (
      isOvernightAvailability(row.startTime, row.endTime) &&
      row.weekday !== 7
    ) {
      const startDay = weekdayLabel(row.weekday, localeKey, "long");
      const endDay = weekdayLabel((row.weekday + 1) % 7, localeKey, "long");
      return `${startDay} – ${endDay}`;
    }
    return weekdayLabel(row.weekday, localeKey, "long");
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
            aria-labelledby="overview-availabilities-modal-title"
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
                  id="overview-availabilities-modal-title"
                  className={SETTINGS_MODAL_TITLE_CLASS}
                >
                  {t("overview.availabilities.title")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {t("overview.availabilities.inlineEditHint")}
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
                    {t("overview.availabilities.listTitle")}
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
                      message={t("overview.availabilities.emptyList")}
                      hint={t("overview.availabilities.emptyEditHint")}
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
                              {t("overview.availabilities.day")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("overview.availabilities.time")}
                            </th>
                            <th
                              className={settingsOverviewListRowActionsHeaderClass()}
                              aria-hidden
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const isSelected = row.id === selectedAvailabilityId;
                            return (
                              <tr
                                key={row.id}
                                {...settingsListItemAttrs(row.id)}
                                onClick={(event) => {
                                  if (shouldIgnoreSettingsListRowActivation(event)) {
                                    return;
                                  }
                                  setSelectedAvailabilityId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setConfirmRemove(false);
                                  setConfirmBulkRemove(false);
                                  setFormMode(null);
                                  setErrorMessage(null);
                                }}
                                onDoubleClick={(event) => {
                                  event.preventDefault();
                                  window.getSelection()?.removeAllRanges();
                                  const slot = availabilityById.get(row.id);
                                  if (!slot) return;
                                  setSelectedAvailabilityId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setFormMode({ type: "edit", availability: slot });
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
                                <td className={settingsDataCellClass(isSelected)}>
                                  {dayLabel(row)}
                                </td>
                                <td
                                  className={settingsDataCellClass(isSelected, {
                                    className: "whitespace-nowrap tabular-nums",
                                  })}
                                >
                                  {formatAvailabilityTimeRange(
                                    row.startTime,
                                    row.endTime,
                                    localeKey
                                  )}
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
                                        setSelectedAvailabilityId(row.id);
                                        setJumpSelectedEmployeeId(row.employeeId);
                                        setFormMode(null);
                                        setConfirmBulkRemove(false);
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
                        setErrorMessage(null);
                      }}
                    />
                  }
                  secondary={
                    <>
                      <SettingsIconActionButton
                        label={t("profiles.edit")}
                        icon={<PencilIcon />}
                        disabled={pending || !selectedAvailability}
                        onClick={() => {
                          if (!selectedAvailability) return;
                          setFormMode({
                            type: "edit",
                            availability: selectedAvailability,
                          });
                          setConfirmRemove(false);
                          setConfirmBulkRemove(false);
                        }}
                      />
                      <SettingsIconActionButton
                        label={t("profiles.availabilityBulkEdit")}
                        icon={<ListIcon />}
                        disabled={pending || !selectedAvailability}
                        onClick={() => {
                          if (!selectedAvailability) return;
                          setFormMode({
                            type: "bulk-edit",
                            availability: selectedAvailability,
                          });
                          setConfirmRemove(false);
                          setConfirmBulkRemove(false);
                          setErrorMessage(null);
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
                        setConfirmBulkRemove(true);
                      }}
                    />
                  }
                />
              </div>

              {createEmployeeId ? (
                <p className="mt-3 text-xs text-muted">
                  {t("overview.availabilities.selectedEmployeeHint", {
                    name:
                      profiles.find((p) => p.id === createEmployeeId)?.full_name ??
                      "—",
                  })}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  {t("overview.availabilities.selectEmployeeHint")}
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
            <ProfileAvailabilityFormModal
              mode="create"
              profileId={createEmployeeId}
              existingAvailability={selectedEmployeeAvailability}
              onClose={() => setFormMode(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {formMode?.type === "edit" ? (
            <ProfileAvailabilityFormModal
              mode="edit"
              profileId={formMode.availability.profile_id}
              currentAvailability={formMode.availability}
              existingAvailability={availability.filter(
                (slot) => slot.profile_id === formMode.availability.profile_id
              )}
              onClose={() => setFormMode(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {formMode?.type === "bulk-edit" ? (
            <ProfileAvailabilityFormModal
              mode="bulk-edit"
              profileId={formMode.availability.profile_id}
              currentAvailability={formMode.availability}
              existingAvailability={availability.filter(
                (slot) => slot.profile_id === formMode.availability.profile_id
              )}
              onClose={() => setFormMode(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {confirmRemove && selectedAvailability ? (
            <DeleteConfirmModal
              name={formatProfileAvailabilitySummaryLabel(
                selectedAvailability,
                localeKey
              )}
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
        </div>
      ) : null}
    </div>
  );
}
