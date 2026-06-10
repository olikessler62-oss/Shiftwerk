"use client";

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  deleteProfileRecurringAvailability,
  fetchProfileRecurringAvailability,
  reorderProfileRecurringAvailability,
} from "@/app/actions/profile-availability";
import { formatActiveWeekdaysLabel } from "@schichtwerk/database";
import {
  formatAvailabilityTimeRange,
  formatProfileAvailabilitySummaryLabel,
  shortenShiftTypeDisplayName,
} from "@/lib/profile-availability-label";
import type {
  Profile,
  ProfileRecurringAvailability,
  ShiftTypeWithBreaks,
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
  SettingsReorderButtons,
  settingsListItemAttrs,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
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
  TrashIcon,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useSettingsListReorder } from "@/lib/settings-list-reorder";

const MAX_NAME_DISPLAY = 25;
const EMPTY_STATE_CLASS = "min-h-full";

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function weekdayLabel(weekday: number, locale: "de" | "en"): string {
  const mask = Array.from({ length: 7 }, (_, i) => (i === weekday ? "1" : "0")).join(
    ""
  );
  return formatActiveWeekdaysLabel(mask, locale);
}

type AvailabilityFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; availability: ProfileRecurringAvailability };

type Props = {
  profile: Profile;
  shiftTypes: ShiftTypeWithBreaks[];
  cachedAvailability?: ProfileRecurringAvailability[];
  onClose: () => void;
  onCacheUpdate: (
    profileId: string,
    availability: ProfileRecurringAvailability[]
  ) => void;
};

export function ProfileAvailabilityPanelModal({
  profile,
  shiftTypes,
  cachedAvailability,
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
  const [formMode, setFormMode] = useState<AvailabilityFormMode>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);

  const applyList = useCallback(
    (list: ProfileRecurringAvailability[]) => {
      setProfileAvailabilities(list);
      onCacheUpdate(profile.id, list);
      setSelectedAvailabilityId((current) => {
        if (current && list.some((a) => a.id === current)) return current;
        return list[0]?.id ?? null;
      });
    },
    [onCacheUpdate, profile.id]
  );

  const setAvailabilityListWithCache = useCallback<
    Dispatch<SetStateAction<ProfileRecurringAvailability[]>>
  >(
    (value) => {
      setProfileAvailabilities((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        onCacheUpdate(profile.id, next);
        return next;
      });
    },
    [onCacheUpdate, profile.id]
  );

  const {
    sortedList: sortedAvailabilities,
    canMoveUp: canMoveAvailabilityUp,
    canMoveDown: canMoveAvailabilityDown,
    handleMove: handleMoveAvailability,
  } = useSettingsListReorder({
    list: profileAvailabilities,
    setList: setAvailabilityListWithCache,
    selectedId: selectedAvailabilityId,
    pending,
    startTransition,
    reorder: async (orderedIds) => {
      const result = await reorderProfileRecurringAvailability({
        profileId: profile.id,
        orderedIds,
      });
      if (!result.ok) return result;
      if (result.availability) applyList(result.availability);
      return { ok: true };
    },
    onError: setErrorMessage,
  });

  const selectedAvailability =
    sortedAvailabilities.find((a) => a.id === selectedAvailabilityId) ?? null;

  useScrollToSettingsListItem(sortedAvailabilities, scrollToItemId, () =>
    setScrollToItemId(null)
  );

  useEffect(() => {
    if (cachedAvailability !== undefined) {
      setProfileAvailabilities(cachedAvailability);
      setSelectedAvailabilityId(cachedAvailability[0]?.id ?? null);
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
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmRemove, formMode, onClose]);

  const anyFormOpen = !!formMode;

  function handleSaved(
    list: ProfileRecurringAvailability[],
    selectedId: string,
    scrollToSelection = false
  ) {
    applyList(list);
    setSelectedAvailabilityId(selectedId);
    if (scrollToSelection && selectedId) setScrollToItemId(selectedId);
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
    });
  }

  const title = t("profiles.panelAvailabilityOf", {
    name: truncateLabel(profile.full_name, 40),
  });

  return (
    <div
      className={cn(settingsSubModalOverlayClass(), (loading || pending) && "cursor-wait")}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !anyFormOpen && !confirmRemove) {
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
            {title}
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
                    <th className={settingsStickyColumnHeaderClass()}>
                      {t("profiles.columnShiftType")}
                    </th>
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
                          {weekdayLabel(item.weekday, localeKey)}
                        </td>
                        <td
                          className={settingsDataCellClass(isSelected, {
                            className: "whitespace-nowrap tabular-nums text-muted",
                          })}
                        >
                          {formatAvailabilityTimeRange(
                            item.start_time,
                            item.end_time,
                            localeKey
                          )}
                        </td>
                        <td
                          className={settingsDataCellClass(isSelected, {
                            className: "max-w-[10rem] truncate text-muted",
                          })}
                          title={item.shift_type_name ?? undefined}
                        >
                          {item.shift_type_name
                            ? truncateLabel(
                                shortenShiftTypeDisplayName(item.shift_type_name),
                                18
                              )
                            : "—"}
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
                  }}
                />
                <SettingsReorderButtons
                  moveUpLabel={t("common.moveUp")}
                  moveDownLabel={t("common.moveDown")}
                  disabled={pending || loading}
                  canMoveUp={canMoveAvailabilityUp}
                  canMoveDown={canMoveAvailabilityDown}
                  onMoveUp={() => {
                    setErrorMessage(null);
                    handleMoveAvailability(-1);
                  }}
                  onMoveDown={() => {
                    setErrorMessage(null);
                    handleMoveAvailability(1);
                  }}
                />
              </>
            }
            destructive={
              <SettingsIconActionButton
                label={t("profiles.delete")}
                icon={<TrashIcon />}
                disabled={pending || loading || !selectedAvailability}
                onClick={() => {
                  setFormMode(null);
                  setConfirmRemove(true);
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
          shiftTypes={shiftTypes}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
      {formMode?.type === "edit" && (
        <ProfileAvailabilityFormModal
          mode="edit"
          profileId={profile.id}
          currentAvailability={formMode.availability}
          shiftTypes={shiftTypes}
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
    </div>
  );
}
