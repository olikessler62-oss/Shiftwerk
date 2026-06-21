"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isMutableHourlyRate } from "@schichtwerk/database";
import type {
  CompensationSurchargeType,
  Profile,
  ProfileCompensationSurcharge,
  ProfileHourlyRate,
} from "@schichtwerk/types";
import { deleteProfileCompensationSurcharge } from "@/app/actions/profile-compensation-surcharges";
import { fetchOverviewSurcharges } from "@/app/actions/overview-surcharges-data";
import { DeleteConfirmModal } from "@/components/settings/delete-confirm-modal";
import { ProfileCompensationSurchargeFormModal } from "@/components/settings/profile-compensation-surcharge-form-modal";
import type { ProfileCompensationCacheEntry } from "@/components/settings/profile-compensation-panel-modal";
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
  areaCalendarModalBackdropClass,
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
  settingsScrollableTableListClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  OVERVIEW_ABSENCES_LIST_SCROLL_CLASS,
} from "@/components/settings/settings-list-ui";
import {
  Button,
  CloseIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { COMPENSATION_SURCHARGES_UI_ENABLED } from "@/lib/compensation-surcharges-feature";
import { buildProfileCompensationCacheEntry } from "@/lib/overview-compensation-cache";
import {
  buildOverviewSurchargeDisplayRows,
  buildOverviewSurchargeEmployeeJumpOptions,
  countOverviewSurchargeEmployees,
  firstOverviewSurchargeRowIdForEmployee,
} from "@/lib/overview-surcharges-display";
import { formatSurchargeAmountLabel } from "@/lib/profile-compensation-calculation";
import { formatDateLabel } from "@/lib/profile-hourly-rate-display";
import {
  assignableCompensationSurchargeTypesForEmployeeProfile,
  formatProfileSurchargeLabel,
  formatSurchargeTriggerLabel,
  resolveProfileSurchargeAmount,
  resolveProfileSurchargeUnit,
} from "@/lib/profile-surcharge-display";
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
  | { type: "edit"; entry: ProfileCompensationSurcharge };

export function OverviewSurchargesEditableModal({
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
  const [surcharges, setSurcharges] = useState<ProfileCompensationSurcharge[]>([]);
  const [rates, setRates] = useState<ProfileHourlyRate[]>([]);
  const [surchargeTypes, setSurchargeTypes] = useState<CompensationSurchargeType[]>([]);
  const [serverToday, setServerToday] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
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

    const result = await fetchOverviewSurcharges();
    if (!result.ok) {
      setErrorMessage(result.error);
      setLoading(false);
      return;
    }

    setProfiles(result.profiles);
    setSurcharges(result.surcharges);
    setRates(result.rates);
    setSurchargeTypes(result.surchargeTypes);
    setServerToday(result.serverToday);
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

  const entryById = useMemo(
    () => new Map(surcharges.map((item) => [item.id, item])),
    [surcharges]
  );

  const rows = useMemo(
    () =>
      buildOverviewSurchargeDisplayRows({
        surcharges,
        profiles,
      }),
    [surcharges, profiles]
  );

  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const mutableEntryIds = useMemo(() => {
    if (!COMPENSATION_SURCHARGES_UI_ENABLED || !serverToday) {
      return new Set<string>();
    }
    return new Set(
      surcharges
        .filter((entry) => isMutableHourlyRate(entry.valid_from, serverToday))
        .map((entry) => entry.id)
    );
  }, [serverToday, surcharges]);
  const bulkSelection = useSettingsListBulkSelection(rowIds, {
    selectableIds: mutableEntryIds,
  });

  const employeeCount = useMemo(() => countOverviewSurchargeEmployees(rows), [rows]);
  const employeeJumpOptions = useMemo(
    () => buildOverviewSurchargeEmployeeJumpOptions(profiles, rows),
    [profiles, rows]
  );
  const enableScroll = employeeCount >= 10;

  const resolveFirstRowIdForEmployee = useCallback(
    (employeeId: string) => firstOverviewSurchargeRowIdForEmployee(rows, employeeId),
    [rows]
  );

  const handleEmployeePosition = useCallback(
    (employeeId: string, firstRowId: string | null) => {
      setJumpSelectedEmployeeId(employeeId);
      setSelectedEntryId(firstRowId);
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
    if (!selectedEntryId) return;
    if (rows.some((row) => row.id === selectedEntryId)) return;
    setSelectedEntryId(null);
  }, [rows, selectedEntryId]);

  const selectedEntry = selectedEntryId ? (entryById.get(selectedEntryId) ?? null) : null;
  const tableSelectedEmployeeId = selectedEntry?.profile_id ?? null;
  const createEmployeeId = jumpSelectedEmployeeId || tableSelectedEmployeeId || null;

  const createEmployeeCompensationEntry = useMemo(() => {
    if (!createEmployeeId || !serverToday) return null;
    return buildProfileCompensationCacheEntry(
      createEmployeeId,
      rates,
      surcharges,
      serverToday
    );
  }, [createEmployeeId, rates, serverToday, surcharges]);

  const availableSurchargeTypes = useMemo(() => {
    if (!createEmployeeId || !serverToday) return [];
    return assignableCompensationSurchargeTypesForEmployeeProfile({
      types: surchargeTypes,
      surchargeEntries: surcharges,
      profileId: createEmployeeId,
      serverToday,
    });
  }, [createEmployeeId, surchargeTypes, surcharges, serverToday]);

  const selectedEntryMutable =
    !!selectedEntry &&
    !!serverToday &&
    isMutableHourlyRate(selectedEntry.valid_from, serverToday);

  const mergeProfileSurcharges = useCallback(
    (
      profileId: string,
      profileSurcharges: ProfileCompensationSurcharge[],
      nextServerToday: string
    ) => {
      setSurcharges((current) => [
        ...current.filter((entry) => entry.profile_id !== profileId),
        ...profileSurcharges,
      ]);
      setServerToday(nextServerToday);
      startTransition(() => {
        router.refresh();
      });
    },
    [router]
  );

  function handleSaved(
    entry: ProfileCompensationCacheEntry,
    selectedId: string,
    scrollToSelection = false
  ) {
    const profileId = createEmployeeId ?? entry.surchargeEntries[0]?.profile_id;
    if (!profileId) return;
    mergeProfileSurcharges(profileId, entry.surchargeEntries, entry.serverToday);
    setJumpSelectedEmployeeId(profileId);

    const mergedSurcharges = [
      ...surcharges.filter((item) => item.profile_id !== profileId),
      ...entry.surchargeEntries,
    ];
    const firstRowId =
      firstOverviewSurchargeRowIdForEmployee(
        buildOverviewSurchargeDisplayRows({
          surcharges: mergedSurcharges,
          profiles,
        }),
        profileId
      ) ?? selectedId;

    if (scrollToSelection && firstRowId) {
      applyCreatedListSelection(firstRowId, setSelectedEntryId, setScrollToItemId);
    } else if (selectedId) {
      setSelectedEntryId(selectedId);
    }
    setFormMode(null);
  }

  function handleRemove() {
    if (!selectedEntry) return;
    const profileId = selectedEntry.profile_id;
    const deletedId = selectedEntry.id;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteProfileCompensationSurcharge({
        profileId,
        entryId: deletedId,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      const remaining = result.surchargeEntries ?? [];
      mergeProfileSurcharges(
        profileId,
        remaining,
        result.serverToday ?? serverToday
      );
      setJumpSelectedEmployeeId(profileId);
      setSelectedEntryId(
        firstOverviewSurchargeRowIdForEmployee(
          buildOverviewSurchargeDisplayRows({
            surcharges: [
              ...surcharges.filter((entry) => entry.profile_id !== profileId),
              ...remaining,
            ],
            profiles,
          }),
          profileId
        )
      );
      setConfirmRemove(false);
    });
  }

  function handleBulkRemove() {
    const ids = rowIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      let nextSurcharges = surcharges;
      for (const id of ids) {
        const entry = nextSurcharges.find((item) => item.id === id);
        if (!entry) continue;
        const result = await deleteProfileCompensationSurcharge({
          profileId: entry.profile_id,
          entryId: id,
        });
        if (!result.ok) {
          setErrorMessage(result.error);
          bulkSelection.clear();
          setConfirmBulkRemove(false);
          return;
        }
        nextSurcharges = [
          ...nextSurcharges.filter((item) => item.profile_id !== entry.profile_id),
          ...(result.surchargeEntries ?? []),
        ];
        if (result.serverToday) {
          setServerToday(result.serverToday);
        }
      }
      setSurcharges(nextSurcharges);
      const displayRows = buildOverviewSurchargeDisplayRows({
        surcharges: nextSurcharges,
        profiles,
      });
      setSelectedEntryId((current) =>
        current && displayRows.some((row) => row.id === current) ? current : null
      );
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

  const deleteConfirmLabel = selectedEntry
    ? formatProfileSurchargeLabel(selectedEntry, localeKey)
    : "";

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
          className={cn(settingsModalRootClass("5xl"), !contentReady && "invisible pointer-events-none")}
          aria-hidden={!contentReady}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="overview-surcharges-modal-title"
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
                  id="overview-surcharges-modal-title"
                  className={SETTINGS_MODAL_TITLE_CLASS}
                >
                  {t("overview.surcharges.title")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {t("overview.surcharges.inlineEditHint")}
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
                    {t("overview.surcharges.listTitle")}
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
                      message={t("overview.surcharges.emptyList")}
                      hint={t("overview.surcharges.emptyEditHint")}
                    />
                  ) : (
                    <div
                      className={cn(
                        settingsScrollableTableListClass(),
                        enableScroll && OVERVIEW_ABSENCES_LIST_SCROLL_CLASS
                      )}
                    >
                      <table className="w-full min-w-[48rem] border-collapse">
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
                              {t("profiles.surchargeColumnName")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("profiles.surchargeColumnTrigger")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass("right")}>
                              {t("profiles.surchargeColumnAmount")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("profiles.hourlyRateColumnValidFrom")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("profiles.hourlyRateColumnValidTo")}
                            </th>
                            <th
                              className={settingsOverviewListRowActionsHeaderClass()}
                              aria-hidden
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const isSelected = row.id === selectedEntryId;
                            const entry = row.entry;
                            const resolvedAmount = resolveProfileSurchargeAmount(entry);
                            const entryMutable =
                              COMPENSATION_SURCHARGES_UI_ENABLED &&
                              !!serverToday &&
                              isMutableHourlyRate(entry.valid_from, serverToday);
                            return (
                              <tr
                                key={row.id}
                                {...settingsListItemAttrs(row.id)}
                                onClick={(event) => {
                                  if (shouldIgnoreSettingsListRowActivation(event)) {
                                    return;
                                  }
                                  setSelectedEntryId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setConfirmRemove(false);
                                  setConfirmBulkRemove(false);
                                  setFormMode(null);
                                  setErrorMessage(null);
                                }}
                                onDoubleClick={(event) => {
                                  event.preventDefault();
                                  window.getSelection()?.removeAllRanges();
                                  if (!entryMutable) return;
                                  setSelectedEntryId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setFormMode({ type: "edit", entry });
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
                                    className: "font-medium",
                                  })}
                                >
                                  {entry.surcharge_type_name}
                                </td>
                                <td className={settingsDataCellClass(isSelected)}>
                                  {formatSurchargeTriggerLabel(entry.trigger, t)}
                                </td>
                                <td
                                  className={settingsDataCellClass(isSelected, {
                                    align: "right",
                                    className: "whitespace-nowrap tabular-nums",
                                  })}
                                >
                                  {formatSurchargeAmountLabel(
                                    resolvedAmount,
                                    resolveProfileSurchargeUnit(entry),
                                    localeKey
                                  )}
                                  {entry.amount === null ? (
                                    <span className="ml-1 text-xs text-muted">
                                      ({t("profiles.orgDefaultShort")})
                                    </span>
                                  ) : null}
                                </td>
                                <td className={settingsDataCellClass(isSelected)}>
                                  {formatDateLabel(entry.valid_from, locale)}
                                </td>
                                <td className={settingsDataCellClass(isSelected)}>
                                  {entry.valid_to
                                    ? formatDateLabel(entry.valid_to, locale)
                                    : t("profiles.hourlyRateOpen")}
                                </td>
                                <SettingsOverviewListRowActions
                                  isSelected={isSelected}
                                  checkbox={
                                    <SettingsListRowCheckbox
                                      checked={bulkSelection.isChecked(row.id)}
                                      disabled={pending || !entryMutable}
                                      ariaLabel={t("common.selectRow")}
                                      className="mx-0"
                                      onChange={() => bulkSelection.toggle(row.id)}
                                    />
                                  }
                                  deleteButton={
                                    <SettingsListRowDeleteButton
                                      label={t("profiles.delete")}
                                      disabled={pending || !entryMutable}
                                      onClick={() => {
                                        setSelectedEntryId(row.id);
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
                        pending ||
                        !createEmployeeId ||
                        !serverToday ||
                        availableSurchargeTypes.length === 0
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
                      disabled={pending || !selectedEntryMutable}
                      onClick={() => {
                        if (!selectedEntry || !selectedEntryMutable) return;
                        setFormMode({ type: "edit", entry: selectedEntry });
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
                  {t("overview.surcharges.selectedEmployeeHint", {
                    name:
                      profiles.find((profile) => profile.id === createEmployeeId)
                        ?.full_name ?? "—",
                  })}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  {t("overview.surcharges.selectEmployeeHint")}
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

          {formMode?.type === "create" &&
          createEmployeeId &&
          createEmployeeCompensationEntry ? (
            <ProfileCompensationSurchargeFormModal
              mode="create"
              profileId={createEmployeeId}
              serverToday={serverToday}
              currentEntry={createEmployeeCompensationEntry}
              availableTypes={availableSurchargeTypes}
              onClose={() => setFormMode(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {formMode?.type === "edit" ? (
            <ProfileCompensationSurchargeFormModal
              mode="edit"
              profileId={formMode.entry.profile_id}
              serverToday={serverToday}
              currentEntry={buildProfileCompensationCacheEntry(
                formMode.entry.profile_id,
                rates,
                surcharges,
                serverToday
              )}
              availableTypes={surchargeTypes}
              editingEntry={formMode.entry}
              onClose={() => setFormMode(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {confirmRemove && selectedEntry ? (
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
        </div>
      ) : null}
    </div>
  );
}
