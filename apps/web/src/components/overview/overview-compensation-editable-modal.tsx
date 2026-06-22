"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile, ProfileHourlyRate } from "@schichtwerk/types";
import { deleteProfileHourlyRate } from "@/app/actions/profile-hourly-rates";
import { fetchOverviewCompensation } from "@/app/actions/overview-compensation-data";
import { DeleteConfirmModal } from "@/components/settings/delete-confirm-modal";
import { ProfileHourlyRateFormModal } from "@/components/settings/profile-hourly-rate-form-modal";
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
import {
  buildOverviewCompensationDisplayRows,
  buildOverviewCompensationEmployeeJumpOptions,
  countOverviewCompensationEmployees,
  firstOverviewCompensationRowIdForEmployee,
  isOverviewCompensationPlaceholderRow,
} from "@/lib/overview-compensation-display";
import {
  formatAmountLabel,
  formatDateLabel,
  sortProfileHourlyRatesByValidFrom,
} from "@/lib/profile-hourly-rate-display";
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
  | { type: "edit"; rate: ProfileHourlyRate };

const MAX_NAME_DISPLAY = 18;

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function OverviewCompensationEditableModal({
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
  const [rates, setRates] = useState<ProfileHourlyRate[]>([]);
  const [serverToday, setServerToday] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
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

    const result = await fetchOverviewCompensation();
    if (!result.ok) {
      setErrorMessage(result.error);
      setLoading(false);
      return;
    }

    setProfiles(result.profiles);
    setRates(result.rates);
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

  const rateById = useMemo(
    () => new Map(rates.map((item) => [item.id, item])),
    [rates]
  );

  const rows = useMemo(
    () =>
      buildOverviewCompensationDisplayRows({
        rates,
        profiles,
      }),
    [rates, profiles]
  );

  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const bulkSelection = useSettingsListBulkSelection(rowIds);

  const employeeCount = useMemo(
    () => countOverviewCompensationEmployees(rows),
    [rows]
  );
  const employeeJumpOptions = useMemo(
    () => buildOverviewCompensationEmployeeJumpOptions(profiles, rows),
    [profiles, rows]
  );
  const enableScroll = employeeCount >= 10;

  const resolveFirstRowIdForEmployee = useCallback(
    (employeeId: string) => firstOverviewCompensationRowIdForEmployee(rows, employeeId),
    [rows]
  );

  const handleEmployeePosition = useCallback(
    (employeeId: string, firstRowId: string | null) => {
      setJumpSelectedEmployeeId(employeeId);
      setSelectedRateId(firstRowId);
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
    if (!selectedRateId) return;
    if (rows.some((row) => row.id === selectedRateId)) return;
    setSelectedRateId(null);
  }, [rows, selectedRateId]);

  const selectedRate = selectedRateId ? (rateById.get(selectedRateId) ?? null) : null;
  const selectedRow = useMemo(
    () => (selectedRateId ? rows.find((row) => row.id === selectedRateId) ?? null : null),
    [rows, selectedRateId]
  );
  const tableSelectedEmployeeId =
    selectedRow?.employeeId ?? selectedRate?.profile_id ?? null;
  const createEmployeeId = jumpSelectedEmployeeId || tableSelectedEmployeeId || null;

  const createEmployeeRates = useMemo(
    () =>
      createEmployeeId
        ? sortProfileHourlyRatesByValidFrom(
            rates.filter((rate) => rate.profile_id === createEmployeeId)
          )
        : [],
    [createEmployeeId, rates]
  );

  const defaultCurrency = createEmployeeRates[0]?.currency ?? "EUR";

  const mergeProfileRates = useCallback(
    (profileId: string, profileRates: ProfileHourlyRate[], nextServerToday: string) => {
      setRates((current) => [
        ...current.filter((rate) => rate.profile_id !== profileId),
        ...profileRates,
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
    const profileId = entry.rates[0]?.profile_id ?? createEmployeeId;
    if (!profileId) return;
    mergeProfileRates(profileId, entry.rates, entry.serverToday);
    setJumpSelectedEmployeeId(profileId);

    const mergedRates = [
      ...rates.filter((rate) => rate.profile_id !== profileId),
      ...entry.rates,
    ];
    const firstRowId =
      firstOverviewCompensationRowIdForEmployee(
        buildOverviewCompensationDisplayRows({
          rates: mergedRates,
          profiles,
        }),
        profileId
      ) ?? selectedId;

    if (scrollToSelection && firstRowId) {
      applyCreatedListSelection(firstRowId, setSelectedRateId, setScrollToItemId);
    } else if (selectedId) {
      setSelectedRateId(selectedId);
    }
    setFormMode(null);
  }

  function handleRemove() {
    if (!selectedRate) return;
    const profileId = selectedRate.profile_id;
    const deletedId = selectedRate.id;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteProfileHourlyRate({
        profileId,
        rateId: deletedId,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      const remaining = result.rates ?? [];
      mergeProfileRates(profileId, remaining, result.serverToday ?? serverToday);
      setJumpSelectedEmployeeId(profileId);
      setSelectedRateId(
        firstOverviewCompensationRowIdForEmployee(
          buildOverviewCompensationDisplayRows({
            rates: [
              ...rates.filter((rate) => rate.profile_id !== profileId),
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
      let nextRates = rates;
      for (const id of ids) {
        const rate = nextRates.find((entry) => entry.id === id);
        if (!rate) continue;
        const result = await deleteProfileHourlyRate({
          profileId: rate.profile_id,
          rateId: id,
        });
        if (!result.ok) {
          setErrorMessage(result.error);
          bulkSelection.clear();
          setConfirmBulkRemove(false);
          return;
        }
        nextRates = [
          ...nextRates.filter((entry) => entry.profile_id !== rate.profile_id),
          ...(result.rates ?? []),
        ];
        if (result.serverToday) {
          setServerToday(result.serverToday);
        }
      }
      setRates(nextRates);
      const displayRows = buildOverviewCompensationDisplayRows({
        rates: nextRates,
        profiles,
      });
      setSelectedRateId((current) =>
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

  const deleteConfirmLabel =
    selectedRate && serverToday
      ? `${formatAmountLabel(selectedRate.amount, selectedRate.currency, locale)} (${formatDateLabel(selectedRate.valid_from, locale)})`
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
            aria-labelledby="overview-compensation-modal-title"
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
                  id="overview-compensation-modal-title"
                  className={SETTINGS_MODAL_TITLE_CLASS}
                >
                  {t("overview.compensation.title")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {t("overview.compensation.inlineEditHint")}
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
                    {t("overview.compensation.listTitle")}
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
                      message={t("overview.compensation.emptyList")}
                      hint={t("overview.compensation.emptyEditHint")}
                    />
                  ) : (
                    <div
                      className={cn(
                        settingsScrollableTableListClass(),
                        enableScroll && OVERVIEW_ABSENCES_LIST_SCROLL_CLASS
                      )}
                    >
                      <table className="w-full min-w-[40rem] border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th
                              className={settingsStickyIndicatorHeaderClass()}
                              aria-hidden
                            />
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.employee")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass("right")}>
                              {t("profiles.hourlyRateColumnAmount")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("profiles.hourlyRateColumnValidFrom")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("profiles.hourlyRateColumnCreatedBy")}
                            </th>
                            <th
                              className={settingsOverviewListRowActionsHeaderClass()}
                              aria-hidden
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const isSelected = row.id === selectedRateId;
                            const rate = row.rate;
                            const isPlaceholder = isOverviewCompensationPlaceholderRow(row);
                            return (
                              <tr
                                key={row.id}
                                {...settingsListItemAttrs(row.id)}
                                onClick={(event) => {
                                  if (shouldIgnoreSettingsListRowActivation(event)) {
                                    return;
                                  }
                                  setSelectedRateId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setConfirmRemove(false);
                                  setConfirmBulkRemove(false);
                                  setFormMode(null);
                                  setErrorMessage(null);
                                }}
                                onDoubleClick={(event) => {
                                  event.preventDefault();
                                  window.getSelection()?.removeAllRanges();
                                  setSelectedRateId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  if (isPlaceholder) {
                                    setFormMode({ type: "create" });
                                  } else if (rate) {
                                    setFormMode({ type: "edit", rate });
                                  }
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
                                    align: "right",
                                    className: "whitespace-nowrap tabular-nums",
                                  })}
                                >
                                  {rate
                                    ? formatAmountLabel(rate.amount, rate.currency, locale)
                                    : "—"}
                                </td>
                                <td className={settingsDataCellClass(isSelected)}>
                                  {rate ? (
                                    <>
                                      {formatDateLabel(rate.valid_from, locale)}
                                      {row.isCurrentRate ? (
                                        <span className="ml-1 text-muted">
                                          ({t("profiles.hourlyRateOpen")})
                                        </span>
                                      ) : null}
                                    </>
                                  ) : (
                                    <span className="text-muted">
                                      {t("profiles.noHourlyRate")}
                                    </span>
                                  )}
                                </td>
                                <td
                                  className={settingsDataCellClass(isSelected, {
                                    className: "max-w-[8rem] truncate text-muted",
                                  })}
                                >
                                  {rate?.created_by_name
                                    ? truncateLabel(rate.created_by_name, 18)
                                    : "—"}
                                </td>
                                <SettingsOverviewListRowActions
                                  isSelected={isSelected}
                                  checkbox={
                                    <SettingsListRowCheckbox
                                      checked={bulkSelection.isChecked(row.id)}
                                      disabled={pending || isPlaceholder}
                                      ariaLabel={t("common.selectRow")}
                                      className="mx-0"
                                      onChange={() => bulkSelection.toggle(row.id)}
                                    />
                                  }
                                  deleteButton={
                                    <SettingsListRowDeleteButton
                                      label={t("profiles.delete")}
                                      disabled={pending || isPlaceholder}
                                      onClick={() => {
                                        setSelectedRateId(row.id);
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
                      disabled={pending || !createEmployeeId || !serverToday}
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
                      disabled={pending || !selectedRate}
                      onClick={() => {
                        if (!selectedRate) return;
                        setFormMode({ type: "edit", rate: selectedRate });
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
                  {t("overview.compensation.selectedEmployeeHint", {
                    name:
                      profiles.find((profile) => profile.id === createEmployeeId)
                        ?.full_name ?? "—",
                  })}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  {t("overview.compensation.selectEmployeeHint")}
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
            <ProfileHourlyRateFormModal
              mode="create"
              profileId={createEmployeeId}
              serverToday={serverToday}
              rates={createEmployeeRates}
              defaultCurrency={defaultCurrency}
              onClose={() => setFormMode(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {formMode?.type === "edit" ? (
            <ProfileHourlyRateFormModal
              mode="edit"
              profileId={formMode.rate.profile_id}
              serverToday={serverToday}
              rates={sortProfileHourlyRatesByValidFrom(
                rates.filter((rate) => rate.profile_id === formMode.rate.profile_id)
              )}
              editingRate={formMode.rate}
              onClose={() => setFormMode(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {confirmRemove && selectedRate ? (
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
