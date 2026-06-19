"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  Location,
  LocationArea,
  Profile,
  ProfileRecurringAvailability,
  ProfileShiftPreference,
  Qualification,
} from "@schichtwerk/types";
import { deleteProfileShiftPreference } from "@/app/actions/profile-shift-preferences";
import { fetchOverviewShiftPreferences } from "@/app/actions/overview-shift-preferences-data";
import { DeleteConfirmModal } from "@/components/settings/delete-confirm-modal";
import { ProfileShiftPreferencesFormModal } from "@/components/settings/profile-shift-preferences-form-modal";
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
  buildOverviewShiftPreferenceDisplayRows,
  buildOverviewShiftPreferenceEmployeeJumpOptions,
  countOverviewShiftPreferenceEmployees,
  firstOverviewShiftPreferenceRowIdForEmployee,
} from "@/lib/overview-shift-preferences-display";
import {
  buildShiftPreferencePlacementLookups,
  formatShiftPreferenceAreaLabel,
  formatShiftPreferenceJobLabel,
  formatShiftPreferenceLocationLabel,
} from "@/lib/profile-shift-preference-display";
import {
  formatAvailabilityTimeRange,
  formatProfileShiftPreferenceSummaryLabel,
  weekdayLabel,
} from "@/lib/profile-availability-label";
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
  | { type: "edit"; preference: ProfileShiftPreference };

export function OverviewShiftPreferencesEditableModal({
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
  const [preferences, setPreferences] = useState<ProfileShiftPreference[]>([]);
  const [availability, setAvailability] = useState<ProfileRecurringAvailability[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<LocationArea[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPreferenceId, setSelectedPreferenceId] = useState<string | null>(null);
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

    const result = await fetchOverviewShiftPreferences();
    if (!result.ok) {
      setErrorMessage(resolveShiftGuardActionError(result.error, t));
      setLoading(false);
      return;
    }

    setProfiles(result.profiles);
    setPreferences(result.preferences);
    setAvailability(result.availability);
    setLocations(result.locations);
    setAreas(result.areas);
    setQualifications(result.qualifications);
    setLoading(false);
  }, [t]);

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

  const preferenceById = useMemo(
    () => new Map(preferences.map((item) => [item.id, item])),
    [preferences]
  );

  const placementLookups = useMemo(
    () =>
      buildShiftPreferencePlacementLookups({
        locations,
        areas,
        qualifications,
      }),
    [areas, locations, qualifications]
  );

  const emptyPlacementLabel = t("profiles.shiftPreferenceNone");

  const rows = useMemo(
    () =>
      buildOverviewShiftPreferenceDisplayRows({
        preferences,
        profiles,
      }),
    [preferences, profiles]
  );

  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const bulkSelection = useSettingsListBulkSelection(rowIds);

  const employeeCount = useMemo(
    () => countOverviewShiftPreferenceEmployees(rows),
    [rows]
  );
  const employeeJumpOptions = useMemo(
    () => buildOverviewShiftPreferenceEmployeeJumpOptions(profiles, rows),
    [profiles, rows]
  );
  const enableScroll = employeeCount >= 10;

  const resolveFirstRowIdForEmployee = useCallback(
    (employeeId: string) =>
      firstOverviewShiftPreferenceRowIdForEmployee(rows, employeeId),
    [rows]
  );

  const handleEmployeePosition = useCallback(
    (employeeId: string, firstRowId: string | null) => {
      setJumpSelectedEmployeeId(employeeId);
      setSelectedPreferenceId(firstRowId);
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
    if (!selectedPreferenceId) return;
    if (rows.some((row) => row.id === selectedPreferenceId)) return;
    setSelectedPreferenceId(null);
  }, [rows, selectedPreferenceId]);

  const selectedPreference = selectedPreferenceId
    ? (preferenceById.get(selectedPreferenceId) ?? null)
    : null;
  const tableSelectedEmployeeId = selectedPreference?.profile_id ?? null;
  const createEmployeeId = jumpSelectedEmployeeId || tableSelectedEmployeeId || null;
  const selectedEmployeeAvailability = useMemo(
    () =>
      createEmployeeId
        ? availability.filter((slot) => slot.profile_id === createEmployeeId)
        : [],
    [availability, createEmployeeId]
  );

  const mergeProfilePreferences = useCallback(
    (profileId: string, list: ProfileShiftPreference[]) => {
      setPreferences((current) => [
        ...current.filter((item) => item.profile_id !== profileId),
        ...list,
      ]);
      startTransition(() => {
        router.refresh();
      });
    },
    [router]
  );

  function handleSaved(
    list: ProfileShiftPreference[],
    selectedId: string,
    scrollToSelection = false
  ) {
    const profileId = list[0]?.profile_id ?? createEmployeeId;
    if (!profileId) return;
    mergeProfilePreferences(profileId, list);
    setJumpSelectedEmployeeId(profileId);

    const mergedPreferences = [
      ...preferences.filter((item) => item.profile_id !== profileId),
      ...list,
    ];
    const firstRowId =
      firstOverviewShiftPreferenceRowIdForEmployee(
        buildOverviewShiftPreferenceDisplayRows({
          preferences: mergedPreferences,
          profiles,
        }),
        profileId
      ) ?? selectedId;

    if (scrollToSelection && firstRowId) {
      applyCreatedListSelection(
        firstRowId,
        setSelectedPreferenceId,
        setScrollToItemId
      );
    } else if (selectedId) {
      setSelectedPreferenceId(selectedId);
    }
    setFormMode(null);
  }

  function handleRemove() {
    if (!selectedPreference) return;
    const profileId = selectedPreference.profile_id;
    const deletedId = selectedPreference.id;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteProfileShiftPreference({
        profileId,
        preferenceId: deletedId,
      });
      if (!result.ok) {
        setErrorMessage(resolveShiftGuardActionError(result.error, t));
        return;
      }
      const remaining = result.preferences ?? [];
      const mergedPreferences = [
        ...preferences.filter((item) => item.profile_id !== profileId),
        ...remaining,
      ];
      const displayRows = buildOverviewShiftPreferenceDisplayRows({
        preferences: mergedPreferences,
        profiles,
      });
      mergeProfilePreferences(profileId, remaining);
      setJumpSelectedEmployeeId(profileId);
      setSelectedPreferenceId(
        firstOverviewShiftPreferenceRowIdForEmployee(displayRows, profileId)
      );
      setConfirmRemove(false);
    });
  }

  function handleBulkRemove() {
    const ids = rowIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      let nextPreferences = preferences;
      for (const id of ids) {
        const preference = nextPreferences.find((entry) => entry.id === id);
        if (!preference) continue;
        const result = await deleteProfileShiftPreference({
          profileId: preference.profile_id,
          preferenceId: id,
        });
        if (!result.ok) {
          setErrorMessage(resolveShiftGuardActionError(result.error, t));
          bulkSelection.clear();
          setConfirmBulkRemove(false);
          setPreferences(nextPreferences);
          return;
        }
        nextPreferences = [
          ...nextPreferences.filter(
            (entry) => entry.profile_id !== preference.profile_id
          ),
          ...(result.preferences ?? []),
        ];
      }
      setPreferences(nextPreferences);
      const displayRows = buildOverviewShiftPreferenceDisplayRows({
        preferences: nextPreferences,
        profiles,
      });
      setSelectedPreferenceId((current) =>
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
            aria-labelledby="overview-shift-preferences-modal-title"
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
                  id="overview-shift-preferences-modal-title"
                  className={SETTINGS_MODAL_TITLE_CLASS}
                >
                  {t("overview.preferences.title")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {t("overview.preferences.inlineEditHint")}
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
                    {t("overview.preferences.listTitle")}
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
                      message={t("overview.preferences.emptyList")}
                      hint={t("overview.preferences.emptyEditHint")}
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
                              {t("profiles.columnWeekday")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("profiles.columnTimeRange")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("profiles.shiftPreferenceLocation")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("profiles.shiftPreferenceArea")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("profiles.shiftPreferenceJob")}
                            </th>
                            <th
                              className={settingsOverviewListRowActionsHeaderClass()}
                              aria-hidden
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const isSelected = row.id === selectedPreferenceId;
                            const preference = row.preference;
                            return (
                              <tr
                                key={row.id}
                                {...settingsListItemAttrs(row.id)}
                                onClick={(event) => {
                                  if (shouldIgnoreSettingsListRowActivation(event)) {
                                    return;
                                  }
                                  setSelectedPreferenceId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setConfirmRemove(false);
                                  setConfirmBulkRemove(false);
                                  setFormMode(null);
                                  setErrorMessage(null);
                                }}
                                onDoubleClick={(event) => {
                                  event.preventDefault();
                                  window.getSelection()?.removeAllRanges();
                                  setSelectedPreferenceId(row.id);
                                  setJumpSelectedEmployeeId(row.employeeId);
                                  setFormMode({ type: "edit", preference });
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
                                    className: "whitespace-nowrap",
                                  })}
                                >
                                  {preference.weekday != null
                                    ? weekdayLabel(preference.weekday, localeKey, "long")
                                    : t("profiles.shiftPreferenceAnyDay")}
                                </td>
                                <td
                                  className={settingsDataCellClass(isSelected, {
                                    className: "whitespace-nowrap tabular-nums",
                                  })}
                                >
                                  {preference.start_time != null &&
                                  preference.end_time != null
                                    ? formatAvailabilityTimeRange(
                                        preference.start_time,
                                        preference.end_time,
                                        localeKey
                                      )
                                    : t("profiles.shiftPreferenceNoTime")}
                                </td>
                                <td
                                  className={settingsDataCellClass(isSelected, {
                                    className: "text-muted",
                                  })}
                                >
                                  {formatShiftPreferenceLocationLabel(
                                    preference,
                                    placementLookups,
                                    emptyPlacementLabel
                                  )}
                                </td>
                                <td
                                  className={settingsDataCellClass(isSelected, {
                                    className: "text-muted",
                                  })}
                                >
                                  {formatShiftPreferenceAreaLabel(
                                    preference,
                                    placementLookups,
                                    emptyPlacementLabel
                                  )}
                                </td>
                                <td
                                  className={settingsDataCellClass(isSelected, {
                                    className: "text-muted",
                                  })}
                                >
                                  {formatShiftPreferenceJobLabel(
                                    preference,
                                    placementLookups,
                                    emptyPlacementLabel
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
                                        setSelectedPreferenceId(row.id);
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
                    <SettingsIconActionButton
                      label={t("profiles.edit")}
                      icon={<PencilIcon />}
                      disabled={pending || !selectedPreference}
                      onClick={() => {
                        if (!selectedPreference) return;
                        setFormMode({ type: "edit", preference: selectedPreference });
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
                  {t("overview.preferences.selectedEmployeeHint", {
                    name:
                      profiles.find((profile) => profile.id === createEmployeeId)
                        ?.full_name ?? "—",
                  })}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  {t("overview.preferences.selectEmployeeHint")}
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
            <ProfileShiftPreferencesFormModal
              mode="create"
              profileId={createEmployeeId}
              profileAvailability={selectedEmployeeAvailability}
              onClose={() => setFormMode(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {formMode?.type === "edit" ? (
            <ProfileShiftPreferencesFormModal
              mode="edit"
              profileId={formMode.preference.profile_id}
              profileAvailability={availability.filter(
                (slot) => slot.profile_id === formMode.preference.profile_id
              )}
              currentPreference={formMode.preference}
              onClose={() => setFormMode(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {confirmRemove && selectedPreference ? (
            <DeleteConfirmModal
              name={formatProfileShiftPreferenceSummaryLabel(
                selectedPreference,
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
