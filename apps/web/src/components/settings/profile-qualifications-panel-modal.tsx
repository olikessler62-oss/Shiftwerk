"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  fetchOrganizationQualifications,
  fetchProfileQualifications,
  removeProfileQualification,
} from "@/app/actions/profile-qualifications";
import type { Profile, Qualification } from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { ProfileQualificationFormModal } from "./profile-qualification-form-modal";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsListRowDeleteButton,
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

const MAX_NAME_DISPLAY = 25;
const EMPTY_STATE_CLASS = "min-h-full";

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

type QualificationFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; qualification: Qualification };

type Props = {
  profile: Profile;
  cachedQualifications?: Qualification[];
  onClose: () => void;
  onCacheUpdate: (profileId: string, qualifications: Qualification[]) => void;
};

export function ProfileQualificationsPanelModal({
  profile,
  cachedQualifications,
  onClose,
  onCacheUpdate,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(cachedQualifications === undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileQualifications, setProfileQualifications] = useState<
    Qualification[]
  >(cachedQualifications ?? []);
  const [selectedQualificationId, setSelectedQualificationId] = useState<
    string | null
  >(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [formMode, setFormMode] = useState<QualificationFormMode>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const [allQualifications, setAllQualifications] = useState<Qualification[]>(
    []
  );

  const selectedQualification =
    profileQualifications.find((q) => q.id === selectedQualificationId) ?? null;

  const assignedIds = useMemo(
    () => new Set(profileQualifications.map((q) => q.id)),
    [profileQualifications]
  );
  const unassignedQualifications = useMemo(
    () => allQualifications.filter((q) => !assignedIds.has(q.id)),
    [allQualifications, assignedIds]
  );
  const editAvailableQualifications = useMemo(() => {
    if (!selectedQualification) return [];
    const others = unassignedQualifications.filter(
      (q) => q.id !== selectedQualification.id
    );
    return [selectedQualification, ...others];
  }, [selectedQualification, unassignedQualifications]);

  const applyList = useCallback(
    (list: Qualification[]) => {
      setProfileQualifications(list);
      onCacheUpdate(profile.id, list);
      setSelectedQualificationId((current) => {
        if (current && list.some((q) => q.id === current)) return current;
        return list[0]?.id ?? null;
      });
    },
    [onCacheUpdate, profile.id]
  );

  useEffect(() => {
    void fetchOrganizationQualifications().then((result) => {
      if (result.ok && result.qualifications) {
        setAllQualifications(result.qualifications);
      }
    });
  }, []);

  useEffect(() => {
    if (cachedQualifications !== undefined) {
      setProfileQualifications(cachedQualifications);
      setSelectedQualificationId(cachedQualifications[0]?.id ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    void fetchProfileQualifications(profile.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setErrorMessage(result.error);
        applyList([]);
        return;
      }
      applyList(result.qualifications ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [applyList, cachedQualifications, profile.id]);

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

  useScrollToSettingsListItem(
    profileQualifications,
    scrollToItemId,
    () => setScrollToItemId(null)
  );

  function handleSaved(list: Qualification[], assignedQualificationId: string) {
    const wasCreate = formMode?.type === "create";
    applyList(list);
    setSelectedQualificationId(assignedQualificationId);
    if (wasCreate) setScrollToItemId(assignedQualificationId);
  }

  function handleRemove() {
    if (!selectedQualification) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await removeProfileQualification({
        profileId: profile.id,
        qualificationId: selectedQualification.id,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      applyList(result.qualifications ?? []);
      setConfirmRemove(false);
    });
  }

  const title = t("profiles.panelQualificationsOf", {
    name: truncateLabel(profile.full_name, 40),
  });

  return (
    <div
      className={cn(settingsSubModalOverlayClass(), (loading || pending) && "cursor-wait")}
      role="presentation"
      onMouseDown={(e) => {
        if (
          e.target === e.currentTarget &&
          !anyFormOpen &&
          !confirmRemove
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-qualifications-panel-title"
        aria-busy={loading || pending}
        aria-hidden={anyFormOpen}
        className={cn(
          settingsSubModalDialogClass("lg"),
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
            id="profile-qualifications-panel-title"
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
            ) : profileQualifications.length === 0 ? (
              <SettingsEmptyState
                message={t("profiles.emptyQualifications")}
                hint={t("common.emptyHintCreate")}
                className={EMPTY_STATE_CLASS}
              />
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th
                      className={settingsStickyIndicatorHeaderClass()}
                      aria-hidden
                    />
                    <th className={settingsStickyColumnHeaderClass()}>
                      {t("profiles.columnQualification")}
                    </th>
                    <th
                      className={settingsListRowDeleteHeaderClass()}
                      aria-hidden
                    />
                  </tr>
                </thead>
                <tbody>
                  {profileQualifications.map((item) => {
                    const isSelected = item.id === selectedQualificationId;
                    return (
                      <tr
                        key={item.id}
                        {...settingsListItemAttrs(item.id)}
                        onClick={() => {
                          setSelectedQualificationId(item.id);
                          setConfirmRemove(false);
                          setFormMode(null);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          window.getSelection()?.removeAllRanges();
                          setFormMode({ type: "edit", qualification: item });
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
                            className: "max-w-[20rem] truncate font-medium",
                          })}
                          title={item.name}
                        >
                          {truncateLabel(item.name)}
                        </td>
                        <td className={settingsListRowDeleteCellClass(isSelected)}>
                          <SettingsListRowDeleteButton
                            label={t("profiles.delete")}
                            disabled={pending || loading}
                            onClick={() => {
                              setSelectedQualificationId(item.id);
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
                disabled={
                  pending || loading || unassignedQualifications.length === 0
                }
                onClick={() => {
                  setFormMode({ type: "create" });
                  setConfirmRemove(false);
                  setErrorMessage(null);
                }}
              />
            }
            secondary={
              <SettingsIconActionButton
                label={t("profiles.edit")}
                icon={<PencilIcon />}
                disabled={pending || loading || !selectedQualification}
                onClick={() => {
                  if (!selectedQualification) return;
                  setFormMode({ type: "edit", qualification: selectedQualification });
                  setConfirmRemove(false);
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
        <ProfileQualificationFormModal
          mode="create"
          profileId={profile.id}
          availableQualifications={unassignedQualifications}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
      {formMode?.type === "edit" && (
        <ProfileQualificationFormModal
          mode="edit"
          profileId={profile.id}
          currentQualification={formMode.qualification}
          availableQualifications={editAvailableQualifications}
          onClose={() => setFormMode(null)}
          onSaved={handleSaved}
        />
      )}
      {confirmRemove && selectedQualification && (
        <DeleteConfirmModal
          name={selectedQualification.name}
          pending={pending}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={handleRemove}
        />
      )}
    </div>
  );
}
