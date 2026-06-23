"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  deleteProfileShiftPreference,
  fetchProfileShiftPreferences,
  fetchProfileShiftPreferenceFormOptions,
} from "@/app/actions/profile-shift-preferences";
import { sortProfileShiftPreferencesBySchedule } from "@schichtwerk/database";
import {
  formatAvailabilityTimeRange,
  formatProfileShiftPreferenceSummaryLabel,
  weekdayLabel,
} from "@/lib/profile-availability-label";
import type { Profile, ProfileRecurringAvailability, ProfileShiftPreference } from "@schichtwerk/types";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { ProfileShiftPreferencesFormModal } from "./profile-shift-preferences-form-modal";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  SETTINGS_EMBEDDED_EMPTY_STATE_CLASS,
  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsListRowDeleteButton,
  SettingsListRowCheckbox,
  SettingsBulkDeleteActionButton,
  settingsEmbeddedDetailPanelBodyClass,
  settingsEmbeddedDetailPanelInnerClass,
  settingsEmbeddedDetailPanelShellClass,
  settingsListItemAttrs,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsProfileEmbeddedListScrollClass,
  settingsScrollableTableListClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
  useScrollToSettingsListItem,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CloseIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";
import {
  buildShiftPreferencePlacementLookups,
  formatShiftPreferenceAreaLabel,
  formatShiftPreferenceJobLabel,
  formatShiftPreferenceLocationLabel,
} from "@/lib/profile-shift-preference-display";

const EMPTY_STATE_CLASS = "min-h-full";

type PreferenceFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; preference: ProfileShiftPreference };

type Props = {
  profile: Profile;
  cachedPreferences?: ProfileShiftPreference[];
  cachedAvailability?: ProfileRecurringAvailability[];
  onClose: () => void;
  onCacheUpdate: (
    profileId: string,
    preferences: ProfileShiftPreference[]
  ) => void;
  /** In Slide-in-Profile: Inhalt ohne Sub-Modal-Overlay. */
  embedded?: boolean;
};

export function ProfileShiftPreferencesPanelModal({
  profile,
  cachedPreferences,
  cachedAvailability = [],
  onClose,
  onCacheUpdate,
  embedded = false,
}: Props) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(cachedPreferences === undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profilePreferences, setProfilePreferences] = useState<
    ProfileShiftPreference[]
  >(cachedPreferences ?? []);
  const [selectedPreferenceId, setSelectedPreferenceId] = useState<
    string | null
  >(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [formMode, setFormMode] = useState<PreferenceFormMode>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const [formOptions, setFormOptions] = useState<
    Extract<Awaited<ReturnType<typeof fetchProfileShiftPreferenceFormOptions>>, { ok: true }> | null
  >(null);

  const applyList = useCallback(
    (list: ProfileShiftPreference[]) => {
      const sorted = sortProfileShiftPreferencesBySchedule(list);
      setProfilePreferences(sorted);
      onCacheUpdate(profile.id, sorted);
      setSelectedPreferenceId((current) => {
        if (current && sorted.some((item) => item.id === current)) return current;
        return sorted[0]?.id ?? null;
      });
    },
    [onCacheUpdate, profile.id]
  );

  const sortedPreferences = useMemo(
    () => sortProfileShiftPreferencesBySchedule(profilePreferences),
    [profilePreferences]
  );
  const preferenceIds = useMemo(
    () => sortedPreferences.map((item) => item.id),
    [sortedPreferences]
  );
  const bulkSelection = useSettingsListBulkSelection(preferenceIds);

  const placementLookups = useMemo(
    () =>
      formOptions
        ? buildShiftPreferencePlacementLookups(formOptions)
        : null,
    [formOptions]
  );
  const emptyPlacementLabel = t("profiles.shiftPreferenceNone");

  const selectedPreference =
    sortedPreferences.find((item) => item.id === selectedPreferenceId) ?? null;

  const profileAvailability = cachedAvailability ?? [];

  useScrollToSettingsListItem(sortedPreferences, scrollToItemId, () =>
    setScrollToItemId(null)
  );

  useEffect(() => {
    void fetchProfileShiftPreferenceFormOptions(profile.id).then((result) => {
      if (result.ok) {
        setFormOptions(result);
      }
    });
  }, [profile.id]);

  useEffect(() => {
    if (cachedPreferences !== undefined) {
      const sorted = sortProfileShiftPreferencesBySchedule(cachedPreferences);
      setProfilePreferences(sorted);
      setSelectedPreferenceId((current) => {
        if (current && sorted.some((item) => item.id === current)) return current;
        return sorted[0]?.id ?? null;
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    void fetchProfileShiftPreferences(profile.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setErrorMessage(result.error);
        applyList([]);
        return;
      }
      applyList(result.preferences ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [applyList, cachedPreferences, profile.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
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

  const anyFormOpen = !!formMode;

  function handleSaved(
    list: ProfileShiftPreference[],
    selectedId: string,
    scrollToSelection = false
  ) {
    applyList(list);
    setSelectedPreferenceId(selectedId);
    if (scrollToSelection && selectedId) setScrollToItemId(selectedId);
  }

  function handleRemove() {
    if (!selectedPreference) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteProfileShiftPreference({
        profileId: profile.id,
        preferenceId: selectedPreference.id,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      applyList(result.preferences ?? []);
      setConfirmRemove(false);
    });
  }

  function handleBulkRemove() {
    const ids = preferenceIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      let latestList = profilePreferences;
      for (const preferenceId of ids) {
        const result = await deleteProfileShiftPreference({
          profileId: profile.id,
          preferenceId,
        });
        if (!result.ok) {
          setErrorMessage(result.error);
          bulkSelection.clear();
          setConfirmBulkRemove(false);
          return;
        }
        latestList = result.preferences ?? latestList;
      }
      applyList(latestList);
      bulkSelection.clear();
      setConfirmBulkRemove(false);
    });
  }

  if (embedded && loading) {
    return (
      <div className="flex shrink-0 items-center justify-center py-8 text-sm text-muted">
        {t("common.loading")}
      </div>
    );
  }

  const anyOverlayOpen = anyFormOpen || confirmRemove || confirmBulkRemove;

  const panelContent = (
    <>
        {!embedded ? (
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <h3
            id="profile-shift-preferences-panel-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            <span className="text-foreground">
              {t("profiles.panelShiftPreferencesOfPrefix")}{" "}
            </span>
            <span className="text-primary">{profile.full_name}</span>
          </h3>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={pending}
            aria-label={t("common.close")}
            className="border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>
        ) : null}

        {errorMessage && (
          <div className="mx-4 mt-3 shrink-0">
            <Alert variant="error">{errorMessage}</Alert>
          </div>
        )}

        <div
          className={
            embedded
              ? settingsEmbeddedDetailPanelBodyClass()
              : "min-h-0 bg-background px-4 py-3"
          }
        >
          <div
            className={cn(
              settingsScrollableTableListClass(),
              embedded
                ? settingsProfileEmbeddedListScrollClass(profilePreferences.length)
                : SETTINGS_PROFILES_LIST_SCROLL_CLASS
            )}
          >
            {loading ? (
              <SettingsEmptyState
                message={t("common.loading")}
                className={
                  embedded ? SETTINGS_EMBEDDED_EMPTY_STATE_CLASS : EMPTY_STATE_CLASS
                }
              />
            ) : profilePreferences.length === 0 ? (
              <SettingsEmptyState
                message={t("profiles.emptyShiftPreferences")}
                hint={t("common.emptyHintCreate")}
                className={
                  embedded ? SETTINGS_EMBEDDED_EMPTY_STATE_CLASS : EMPTY_STATE_CLASS
                }
              />
            ) : (
              <table className="w-full min-w-0 border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th
                      className={settingsStickyIndicatorHeaderClass()}
                      aria-hidden
                    />
                    <th className={settingsStickyColumnHeaderClass()}>
                      {t("profiles.columnWeekday")}
                    </th>
                    <th className={settingsStickyColumnHeaderClass()}>
                      {t("profiles.columnTimeRange")}
                    </th>
                    <th
                      className={settingsStickyColumnHeaderClass(
                        "left",
                        "min-w-[9rem]"
                      )}
                    >
                      {t("profiles.shiftPreferenceLocation")}
                    </th>
                    <th
                      className={settingsStickyColumnHeaderClass(
                        "left",
                        "min-w-[9rem]"
                      )}
                    >
                      {t("profiles.shiftPreferenceArea")}
                    </th>
                    <th
                      className={settingsStickyColumnHeaderClass(
                        "left",
                        "min-w-[9rem]"
                      )}
                    >
                      {t("profiles.shiftPreferenceJob")}
                    </th>
                    <th
                      className={settingsStickyColumnHeaderClass(
                        "right",
                        "w-14 !px-1"
                      )}
                      aria-hidden
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedPreferences.map((item) => {
                    const isSelected = item.id === selectedPreferenceId;
                    return (
                      <tr
                        key={item.id}
                        {...settingsListItemAttrs(item.id)}
                        onClick={() => {
                          setSelectedPreferenceId(item.id);
                          setConfirmRemove(false);
                          setConfirmBulkRemove(false);
                          setFormMode(null);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          window.getSelection()?.removeAllRanges();
                          setFormMode({ type: "edit", preference: item });
                          setConfirmRemove(false);
                        }}
                        className={settingsDataRowClass(isSelected)}
                      >
                        <td
                          className={settingsIndicatorCellClass(isSelected)}
                          aria-hidden
                        />
                        <td
                          className={settingsDataCellClass(isSelected, {
                            className: "whitespace-nowrap font-medium",
                          })}
                        >
                          {item.weekday != null
                            ? weekdayLabel(item.weekday, localeKey, "long")
                            : t("profiles.shiftPreferenceAnyDay")}
                        </td>
                        <td
                          className={settingsDataCellClass(isSelected, {
                            className: "whitespace-nowrap tabular-nums",
                          })}
                        >
                          {item.start_time != null && item.end_time != null
                            ? formatAvailabilityTimeRange(
                                item.start_time,
                                item.end_time,
                                localeKey
                              )
                            : t("profiles.shiftPreferenceNoTime")}
                        </td>
                        <td
                          className={settingsDataCellClass(isSelected, {
                            className: "min-w-[9rem] text-muted",
                          })}
                        >
                          {placementLookups
                            ? formatShiftPreferenceLocationLabel(
                                item,
                                placementLookups,
                                emptyPlacementLabel
                              )
                            : "—"}
                        </td>
                        <td
                          className={settingsDataCellClass(isSelected, {
                            className: "min-w-[9rem] text-muted",
                          })}
                        >
                          {placementLookups
                            ? formatShiftPreferenceAreaLabel(
                                item,
                                placementLookups,
                                emptyPlacementLabel
                              )
                            : "—"}
                        </td>
                        <td
                          className={settingsDataCellClass(isSelected, {
                            className: "min-w-[9rem] text-muted",
                          })}
                        >
                          {placementLookups
                            ? formatShiftPreferenceJobLabel(
                                item,
                                placementLookups,
                                emptyPlacementLabel
                              )
                            : "—"}
                        </td>
                        <td
                          className={settingsDataCellClass(isSelected, {
                            align: "right",
                            className: "whitespace-nowrap !px-1",
                          })}
                        >
                          <div className="flex items-center justify-end gap-0.5">
                            <SettingsListRowCheckbox
                              checked={bulkSelection.isChecked(item.id)}
                              disabled={pending || loading}
                              ariaLabel={t("common.selectRow")}
                              className="!mx-0"
                              onChange={() => bulkSelection.toggle(item.id)}
                            />
                            <SettingsListRowDeleteButton
                              label={t("profiles.delete")}
                              disabled={pending || loading}
                              onClick={() => {
                                setSelectedPreferenceId(item.id);
                                setFormMode(null);
                                setConfirmRemove(true);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3">
          <SettingsActionBar
            primary={
              <SettingsPrimaryActionButton
                label={t("profiles.new")}
                icon={<PlusIcon />}
                disabled={pending || loading}
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
                disabled={pending || loading || !selectedPreference}
                onClick={() => {
                  if (!selectedPreference) return;
                  setFormMode({
                    type: "edit",
                    preference: selectedPreference,
                  });
                  setConfirmRemove(false);
                  setConfirmBulkRemove(false);
                }}
              />
            }
            destructive={
              <SettingsBulkDeleteActionButton
                label={t("common.deleteSelectedEntries")}
                disabled={pending || loading || !bulkSelection.canBulkDelete}
                onClick={() => {
                  setConfirmRemove(false);
                  setFormMode(null);
                  setConfirmBulkRemove(true);
                }}
              />
            }
          />
        </div>

        <div className={settingsModalFooterClass("shrink-0")}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-7 shrink-0 whitespace-nowrap px-2 text-xs"
          >
            <CloseIcon />
            {embedded ? t("profiles.title") : t("common.close")}
          </Button>
        </div>
    </>
  );

  const panelOverlays = (
    <>
      {formMode?.type === "create" && (
        <ProfileShiftPreferencesFormModal
          mode="create"
          profileId={profile.id}
          profileAvailability={profileAvailability}
          formOptions={formOptions ?? undefined}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
      {formMode?.type === "edit" && (
        <ProfileShiftPreferencesFormModal
          mode="edit"
          profileId={profile.id}
          profileAvailability={profileAvailability}
          currentPreference={formMode.preference}
          formOptions={formOptions ?? undefined}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
      {confirmRemove && selectedPreference && (
        <DeleteConfirmModal
          name={formatProfileShiftPreferenceSummaryLabel(
            selectedPreference,
            localeKey
          )}
          pending={pending}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={handleRemove}
        />
      )}
      {confirmBulkRemove && bulkSelection.checkedCount > 0 && (
        <DeleteConfirmModal
          name={t("common.deleteSelectedEntries")}
          count={bulkSelection.checkedCount}
          pending={pending}
          onCancel={() => setConfirmBulkRemove(false)}
          onConfirm={handleBulkRemove}
        />
      )}
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
            anyOverlayOpen && "pointer-events-none"
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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !anyOverlayOpen) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-shift-preferences-panel-title"
        aria-busy={loading || pending}
        aria-hidden={anyOverlayOpen}
        className={cn(
          settingsSubModalDialogClass(
            "5xl",
            "!max-w-[calc(100%-0.5rem)]"
          ),
          (loading || pending) && "[&_*]:cursor-wait",
          anyOverlayOpen ? "pointer-events-none" : ""
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {panelContent}
      </div>
      {panelOverlays}
    </div>
  );
}
