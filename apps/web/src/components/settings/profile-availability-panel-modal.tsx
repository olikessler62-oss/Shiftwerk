"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  deleteProfileRecurringAvailability,
  fetchProfileRecurringAvailability,
} from "@/app/actions/profile-availability";
import { fetchProfileShiftPreferences } from "@/app/actions/profile-shift-preferences";
import { sortProfileRecurringAvailabilityBySchedule } from "@schichtwerk/database";
import {
  formatAvailabilityTimeRange,
  formatProfileAvailabilitySummaryLabel,
  weekdayLabel,
} from "@/lib/profile-availability-label";
import { findNonConformantProfileShiftPreferences } from "@/lib/profile-shift-preference-availability";
import type {
  Profile,
  ProfileRecurringAvailability,
  ProfileShiftPreference,
} from "@schichtwerk/types";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { ProfileAvailabilityFormModal } from "./profile-availability-form-modal";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsListRowDeleteButton,
  SettingsListRowCheckbox,
  SettingsBulkDeleteActionButton,
  settingsListItemAttrs,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsScrollableTableListClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
  useScrollToSettingsListItem,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  settingsListRowDeleteCellClass,
  settingsListRowDeleteHeaderClass,
  settingsListRowCheckboxCellClass,
  settingsListRowCheckboxHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CloseIcon,
  IconButton,
  ListIcon,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useSettingsListBulkSelection } from "@/lib/use-settings-list-bulk-selection";

const MAX_NAME_DISPLAY = 25;
const EMPTY_STATE_CLASS = "min-h-full";

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

type AvailabilityFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; availability: ProfileRecurringAvailability }
  | { type: "bulk-edit"; availability: ProfileRecurringAvailability };

type Props = {
  profile: Profile;
  cachedAvailability?: ProfileRecurringAvailability[];
  cachedShiftPreferences?: ProfileShiftPreference[];
  onClose: () => void;
  onCacheUpdate: (
    profileId: string,
    availability: ProfileRecurringAvailability[]
  ) => void;
};

export function ProfileAvailabilityPanelModal({
  profile,
  cachedAvailability,
  cachedShiftPreferences,
  onClose,
  onCacheUpdate,
}: Props) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(cachedAvailability === undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileAvailabilities, setProfileAvailabilities] = useState<
    ProfileRecurringAvailability[]
  >(cachedAvailability ?? []);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<
    string | null
  >(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [formMode, setFormMode] = useState<AvailabilityFormMode>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const [shiftPreferenceWarning, setShiftPreferenceWarning] = useState<
    string | null
  >(null);

  const applyList = useCallback(
    (list: ProfileRecurringAvailability[]) => {
      const sorted = sortProfileRecurringAvailabilityBySchedule(list);
      setProfileAvailabilities(sorted);
      onCacheUpdate(profile.id, sorted);
      setSelectedAvailabilityId((current) => {
        if (current && sorted.some((a) => a.id === current)) return current;
        return sorted[0]?.id ?? null;
      });
    },
    [onCacheUpdate, profile.id]
  );

  const sortedAvailabilities = useMemo(
    () => sortProfileRecurringAvailabilityBySchedule(profileAvailabilities),
    [profileAvailabilities]
  );
  const availabilityIds = useMemo(
    () => sortedAvailabilities.map((item) => item.id),
    [sortedAvailabilities]
  );
  const bulkSelection = useSettingsListBulkSelection(availabilityIds);

  const selectedAvailability =
    sortedAvailabilities.find((a) => a.id === selectedAvailabilityId) ?? null;

  useScrollToSettingsListItem(sortedAvailabilities, scrollToItemId, () =>
    setScrollToItemId(null)
  );

  useEffect(() => {
    if (cachedAvailability !== undefined) {
      const sorted = sortProfileRecurringAvailabilityBySchedule(cachedAvailability);
      setProfileAvailabilities(sorted);
      setSelectedAvailabilityId((current) => {
        if (current && sorted.some((a) => a.id === current)) return current;
        return sorted[0]?.id ?? null;
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    void fetchProfileRecurringAvailability(profile.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setErrorMessage(result.error);
        applyList([]);
        return;
      }
      applyList(result.availability ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [applyList, cachedAvailability, profile.id]);

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

  const syncShiftPreferenceWarning = useCallback(
    async (availability: ProfileRecurringAvailability[]) => {
      let preferences = cachedShiftPreferences;
      if (preferences === undefined) {
        const result = await fetchProfileShiftPreferences(profile.id);
        if (!result.ok) {
          setShiftPreferenceWarning(null);
          return;
        }
        preferences = result.preferences ?? [];
      }

      const nonConformant = findNonConformantProfileShiftPreferences(
        preferences,
        availability
      );
      setShiftPreferenceWarning(
        nonConformant.length > 0
          ? t("profiles.shiftPreferencesNeedAdjustment")
          : null
      );
    },
    [cachedShiftPreferences, profile.id, t]
  );

  function handleSaved(
    list: ProfileRecurringAvailability[],
    selectedId: string,
    scrollToSelection = false
  ) {
    applyList(list);
    setSelectedAvailabilityId(selectedId);
    if (scrollToSelection && selectedId) setScrollToItemId(selectedId);
    void syncShiftPreferenceWarning(list);
  }

  function handleRemove() {
    if (!selectedAvailability) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteProfileRecurringAvailability({
        profileId: profile.id,
        availabilityId: selectedAvailability.id,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      applyList(result.availability ?? []);
      setConfirmRemove(false);
      void syncShiftPreferenceWarning(result.availability ?? []);
    });
  }

  function handleBulkRemove() {
    const ids = availabilityIds.filter((id) => bulkSelection.isChecked(id));
    if (ids.length === 0) return;
    setErrorMessage(null);
    startTransition(async () => {
      let latestList = profileAvailabilities;
      for (const availabilityId of ids) {
        const result = await deleteProfileRecurringAvailability({
          profileId: profile.id,
          availabilityId,
        });
        if (!result.ok) {
          setErrorMessage(result.error);
          if (result.availability) applyList(result.availability);
          bulkSelection.clear();
          setConfirmBulkRemove(false);
          return;
        }
        latestList = result.availability ?? latestList;
      }
      applyList(latestList);
      bulkSelection.clear();
      setConfirmBulkRemove(false);
      void syncShiftPreferenceWarning(latestList);
    });
  }

  return (
    <div
      className={cn(settingsSubModalOverlayClass(), (loading || pending) && "cursor-wait")}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !anyFormOpen && !confirmRemove && !confirmBulkRemove) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-availability-panel-title"
        aria-busy={loading || pending}
        aria-hidden={anyFormOpen}
        className={cn(
          settingsSubModalDialogClass("xl"),
          (loading || pending) && "[&_*]:cursor-wait",
          anyFormOpen ? "pointer-events-none" : ""
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <h3
            id="profile-availability-panel-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            <span className="text-foreground">
              {t("profiles.panelAvailabilityOfPrefix")}{" "}
            </span>
            <span className="text-cyan-600">{profile.full_name}</span>
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

        {errorMessage && (
          <div className="mx-4 mt-3 shrink-0">
            <Alert variant="error">{errorMessage}</Alert>
          </div>
        )}

        {shiftPreferenceWarning && (
          <div className="mx-4 mt-3 shrink-0">
            <Alert variant="info">{shiftPreferenceWarning}</Alert>
          </div>
        )}

        <div className="min-h-0 bg-background px-4 py-3">
          <div
            className={cn(
              settingsScrollableTableListClass(),
              SETTINGS_PROFILES_LIST_SCROLL_CLASS
            )}
          >
            {loading ? (
              <SettingsEmptyState
                message={t("common.loading")}
                className={EMPTY_STATE_CLASS}
              />
            ) : profileAvailabilities.length === 0 ? (
              <SettingsEmptyState
                message={t("profiles.emptyAvailability")}
                hint={t("common.emptyHintCreate")}
                className={EMPTY_STATE_CLASS}
              />
            ) : (
              <table className="w-full min-w-[24rem] border-collapse">
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
                  {sortedAvailabilities.map((item) => {
                    const isSelected = item.id === selectedAvailabilityId;
                    return (
                      <tr
                        key={item.id}
                        {...settingsListItemAttrs(item.id)}
                        onClick={() => {
                          setSelectedAvailabilityId(item.id);
                          setConfirmRemove(false);
                          setConfirmBulkRemove(false);
                          setFormMode(null);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          window.getSelection()?.removeAllRanges();
                          setFormMode({ type: "edit", availability: item });
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
                          {weekdayLabel(item.weekday, localeKey, "long")}
                        </td>
                        <td
                          className={settingsDataCellClass(isSelected, {
                            className: "whitespace-nowrap tabular-nums",
                          })}
                        >
                          {formatAvailabilityTimeRange(
                            item.start_time,
                            item.end_time,
                            localeKey
                          )}
                        </td>
                        <td className={settingsListRowCheckboxCellClass(isSelected)}>
                          <SettingsListRowCheckbox
                            checked={bulkSelection.isChecked(item.id)}
                            disabled={pending || loading}
                            ariaLabel={t("common.selectRow")}
                            onChange={() => bulkSelection.toggle(item.id)}
                          />
                        </td>
                        <td className={settingsListRowDeleteCellClass(isSelected)}>
                          <SettingsListRowDeleteButton
                            label={t("profiles.delete")}
                            disabled={pending || loading}
                            onClick={() => {
                              setSelectedAvailabilityId(item.id);
                              setFormMode(null);
                              setConfirmRemove(true);
                            }}
                          />
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
              <>
                <SettingsIconActionButton
                  label={t("profiles.edit")}
                  icon={<PencilIcon />}
                  disabled={pending || loading || !selectedAvailability}
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
                  disabled={pending || loading || !selectedAvailability}
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
            {t("common.close")}
          </Button>
        </div>
      </div>

      {formMode?.type === "create" && (
        <ProfileAvailabilityFormModal
          mode="create"
          profileId={profile.id}
          existingAvailability={profileAvailabilities}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
      {formMode?.type === "edit" && (
        <ProfileAvailabilityFormModal
          mode="edit"
          profileId={profile.id}
          currentAvailability={formMode.availability}
          existingAvailability={profileAvailabilities}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
      {formMode?.type === "bulk-edit" && (
        <ProfileAvailabilityFormModal
          mode="bulk-edit"
          profileId={profile.id}
          currentAvailability={formMode.availability}
          existingAvailability={profileAvailabilities}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
      {confirmRemove && selectedAvailability && (
        <DeleteConfirmModal
          name={formatProfileAvailabilitySummaryLabel(
            selectedAvailability,
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
    </div>
  );
}
