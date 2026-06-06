"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchProfileRecurringAvailability } from "@/app/actions/profile-availability";
import { fetchProfileHourlyRates } from "@/app/actions/profile-hourly-rates";
import { fetchProfileQualifications } from "@/app/actions/profile-qualifications";
import { deleteProfile, reorderProfiles } from "@/app/actions/profiles";
import type {
  Profile,
  ProfileRecurringAvailability,
  Qualification,
  ShiftTypeWithBreaks,
} from "@schichtwerk/types";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { ProfileAvailabilityPanelModal } from "./profile-availability-panel-modal";
import {
  ProfileCompensationPanelModal,
  type ProfileCompensationCacheEntry,
} from "./profile-compensation-panel-modal";
import { ProfileFormModal } from "./profile-form-modal";
import { ProfileInvitePanelModal } from "./profile-invite-panel-modal";
import { ProfileDetailActions } from "./profile-detail-actions";
import { ProfileQualificationsPanelModal } from "./profile-qualifications-panel-modal";
import {
  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsReorderButtons,
  settingsListItemAttrs,
  useScrollToSettingsListItem,
  StatusDot,
  settingsColumnHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsPanelHeaderClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CloseIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useSettingsListReorder } from "@/lib/settings-list-reorder";

type Props = {
  profiles: Profile[];
  shiftTypes: ShiftTypeWithBreaks[];
  onClose: () => void;
  initialSelectedProfileId?: string | null;
};

type ProfileFormMode =
  | null
  | { type: "create" }
  | { type: "edit"; profile: Profile };

type DetailPanel =
  | null
  | "qualifications"
  | "availability"
  | "compensation"
  | "invite";

const MODAL_MAX_WIDTH = "calc(54rem + 120px)";
const COLUMN_GAP_PX = 20;
const MAX_NAME_DISPLAY = 25;

function truncateLabel(name: string, max = MAX_NAME_DISPLAY): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function ProfileColorSwatch({ hex }: { hex: string | null }) {
  if (!hex) return null;
  return (
    <span
      className="inline-block h-[10px] w-[10px] shrink-0 rounded-sm border border-border/60"
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

function resolveInitialProfileId(
  profiles: Profile[],
  preferredId: string | null | undefined
): string | null {
  if (preferredId && profiles.some((p) => p.id === preferredId)) return preferredId;
  return profiles[0]?.id ?? null;
}

const PROFILES_EMPTY_STATE_CLASS = "min-h-full";

function ColumnShell({
  title,
  children,
  actions,
  listScrollClassName = SETTINGS_PROFILES_LIST_SCROLL_CLASS,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  listScrollClassName?: string;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
      <h3 className={settingsPanelHeaderClass()} title={title}>
        {title}
      </h3>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 bg-background px-2 py-2">
          <div
            className={cn(
              "min-h-0 overflow-y-auto rounded-md border border-border bg-surface",
              listScrollClassName
            )}
          >
            {children}
          </div>
        </div>
      </div>
      {actions ? <div className="mt-auto shrink-0">{actions}</div> : null}
    </div>
  );
}

export function ProfilesModal({
  profiles,
  onClose,
  initialSelectedProfileId,
  shiftTypes,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [profileList, setProfileList] = useState(profiles);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() =>
    resolveInitialProfileId(profiles, initialSelectedProfileId)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState(false);
  const [profileFormMode, setProfileFormMode] = useState<ProfileFormMode>(null);
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null);
  const [qualificationsCache, setQualificationsCache] = useState<
    Record<string, Qualification[]>
  >({});
  const [availabilityCache, setAvailabilityCache] = useState<
    Record<string, ProfileRecurringAvailability[]>
  >({});
  const [compensationCache, setCompensationCache] = useState<
    Record<string, ProfileCompensationCacheEntry>
  >({});
  const [scrollToProfileId, setScrollToProfileId] = useState<string | null>(null);

  const {
    sortedList: sortedProfiles,
    canMoveUp: canMoveProfileUp,
    canMoveDown: canMoveProfileDown,
    handleMove: handleMoveProfile,
  } = useSettingsListReorder({
    list: profileList,
    setList: setProfileList,
    selectedId: selectedProfileId,
    pending,
    startTransition,
    reorder: reorderProfiles,
    onError: setErrorMessage,
    onSuccess: () => router.refresh(),
  });

  const selectedProfile =
    sortedProfiles.find((p) => p.id === selectedProfileId) ?? null;
  const clearProfileScrollTarget = useCallback(
    () => setScrollToProfileId(null),
    []
  );
  useScrollToSettingsListItem(
    sortedProfiles,
    scrollToProfileId,
    clearProfileScrollTarget
  );

  const activeEmployeeCount = useMemo(
    () =>
      profileList.filter((profile) => profile.is_active && profile.role === "basic")
        .length,
    [profileList]
  );

  useEffect(() => {
    setProfileList(profiles);
    setSelectedProfileId((current) => {
      if (current && profiles.some((p) => p.id === current)) return current;
      return resolveInitialProfileId(profiles, initialSelectedProfileId);
    });
  }, [profiles, initialSelectedProfileId]);

  const actionDetailsReady =
    !selectedProfileId ||
    (selectedProfileId in qualificationsCache &&
      selectedProfileId in availabilityCache &&
      selectedProfileId in compensationCache);
  const actionDetailsLoading = !!selectedProfileId && !actionDetailsReady;

  useEffect(() => {
    const profileId = selectedProfileId;
    if (!profileId) return;

    const qualReady = profileId in qualificationsCache;
    const availReady = profileId in availabilityCache;
    const compReady = profileId in compensationCache;
    if (qualReady && availReady && compReady) return;

    let cancelled = false;

    void Promise.all([
      qualReady
        ? Promise.resolve(null)
        : fetchProfileQualifications(profileId),
      availReady
        ? Promise.resolve(null)
        : fetchProfileRecurringAvailability(profileId),
      compReady
        ? Promise.resolve(null)
        : fetchProfileHourlyRates(profileId),
    ]).then(([qualResult, availResult, compResult]) => {
      if (cancelled) return;
      setQualificationsCache((prev) => {
        if (profileId in prev) return prev;
        const list =
          qualResult?.ok === true ? (qualResult.qualifications ?? []) : [];
        return { ...prev, [profileId]: list };
      });
      setAvailabilityCache((prev) => {
        if (profileId in prev) return prev;
        const list =
          availResult?.ok === true ? (availResult.availability ?? []) : [];
        return { ...prev, [profileId]: list };
      });
      setCompensationCache((prev) => {
        if (profileId in prev) return prev;
        if (compResult?.ok === true) {
          return {
            ...prev,
            [profileId]: {
              currentRate: compResult.currentRate ?? null,
              rates: compResult.rates ?? [],
              serverToday: compResult.serverToday ?? "",
            },
          };
        }
        return {
          ...prev,
          [profileId]: { currentRate: null, rates: [], serverToday: "" },
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProfileId, qualificationsCache, availabilityCache, compensationCache]);

  const anyOverlayOpen = !!profileFormMode || !!detailPanel;
  const modalBusy = pending || actionDetailsLoading;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (profileFormMode) {
        setProfileFormMode(null);
        return;
      }
      if (detailPanel) {
        setDetailPanel(null);
        return;
      }
      if (confirmDeleteProfile) {
        setConfirmDeleteProfile(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteProfile, detailPanel, onClose, profileFormMode]);

  function refreshProfiles() {
    router.refresh();
  }

  function selectProfile(id: string) {
    if (id === selectedProfileId) return;
    setSelectedProfileId(id);
    setDetailPanel(null);
    setConfirmDeleteProfile(false);
    setProfileFormMode(null);
    setErrorMessage(null);
  }

  function openEditProfile(profile: Profile) {
    setProfileFormMode({ type: "edit", profile });
    setConfirmDeleteProfile(false);
    setDetailPanel(null);
    setErrorMessage(null);
  }

  function handleProfileSaved(profile: Profile) {
    const isNew = !profileList.some((p) => p.id === profile.id);
    setProfileList((prev) => {
      const index = prev.findIndex((p) => p.id === profile.id);
      if (index === -1) return [...prev, profile];
      const next = [...prev];
      next[index] = profile;
      return next;
    });
    setSelectedProfileId(profile.id);
    if (isNew) setScrollToProfileId(profile.id);
    refreshProfiles();
  }

  function handleDeleteProfile() {
    if (!selectedProfile) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteProfile(selectedProfile.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      if (result.profile) {
        setProfileList((prev) =>
          prev.map((p) => (p.id === result.profile!.id ? result.profile! : p))
        );
      }
      setQualificationsCache((prev) => {
        const next = { ...prev };
        delete next[selectedProfile.id];
        return next;
      });
      setAvailabilityCache((prev) => {
        const next = { ...prev };
        delete next[selectedProfile.id];
        return next;
      });
      setCompensationCache((prev) => {
        const next = { ...prev };
        delete next[selectedProfile.id];
        return next;
      });
      setConfirmDeleteProfile(false);
      refreshProfiles();
    });
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-black/25 p-4",
        modalBusy && "cursor-wait"
      )}
      role="presentation"
      onMouseDown={(e) => {
        if (
          e.target === e.currentTarget &&
          !anyOverlayOpen &&
          !confirmDeleteProfile
        ) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex w-full flex-col"
        style={{ maxWidth: MODAL_MAX_WIDTH }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profiles-modal-title"
          aria-busy={modalBusy}
          aria-hidden={anyOverlayOpen}
          className={cn(
            "flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl",
            modalBusy && "[&_*]:cursor-wait",
            anyOverlayOpen ? "pointer-events-none" : ""
          )}
        >
          <div className="shrink-0 border-b border-border px-6 py-4">
            <h2 id="profiles-modal-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("profiles.title")}
            </h2>
          </div>

          {errorMessage && (
            <div className="mx-4 mt-3 shrink-0">
              <Alert variant="error">{errorMessage}</Alert>
            </div>
          )}

          <div
            className={cn(
              "grid shrink-0 grid-cols-[minmax(0,calc(50%-10px+40px))_minmax(0,calc(50%-10px-40px))] items-stretch bg-background px-4 py-3",
              actionDetailsLoading && "pointer-events-none"
            )}
            style={{ gap: COLUMN_GAP_PX }}
            aria-busy={actionDetailsLoading}
          >
            <ColumnShell
              title={t("profiles.panelProfiles")}
              actions={
                <SettingsActionBar
                  primary={
                    <SettingsPrimaryActionButton
                      label={t("profiles.new")}
                      icon={<PlusIcon />}
                      disabled={pending}
                      onClick={() => {
                        setProfileFormMode({ type: "create" });
                        setConfirmDeleteProfile(false);
                        setDetailPanel(null);
                        setErrorMessage(null);
                      }}
                    />
                  }
                  secondary={
                    <>
                      <SettingsIconActionButton
                        label={t("profiles.edit")}
                        icon={<PencilIcon />}
                        disabled={pending || !selectedProfile}
                        onClick={() => {
                          if (!selectedProfile) return;
                          openEditProfile(selectedProfile);
                        }}
                      />
                      <SettingsReorderButtons
                        moveUpLabel={t("common.moveUp")}
                        moveDownLabel={t("common.moveDown")}
                        disabled={pending}
                        canMoveUp={canMoveProfileUp}
                        canMoveDown={canMoveProfileDown}
                        onMoveUp={() => {
                          setErrorMessage(null);
                          handleMoveProfile(-1);
                        }}
                        onMoveDown={() => {
                          setErrorMessage(null);
                          handleMoveProfile(1);
                        }}
                      />
                    </>
                  }
                  destructive={
                    <SettingsIconActionButton
                      label={t("profiles.delete")}
                      icon={<TrashIcon />}
                      disabled={pending || !selectedProfile}
                      onClick={() => {
                        setConfirmDeleteProfile(true);
                        setProfileFormMode(null);
                        setDetailPanel(null);
                        setErrorMessage(null);
                      }}
                    />
                  }
                />
              }
            >
              {profileList.length === 0 ? (
                <SettingsEmptyState
                  message={t("profiles.emptyProfiles")}
                  hint={t("common.emptyHintCreate")}
                  className={PROFILES_EMPTY_STATE_CLASS}
                />
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-[1] bg-subtle">
                    <tr className="border-b border-border bg-subtle">
                      <th className="w-1 p-0" aria-hidden />
                      <th className={cn(settingsColumnHeaderClass("center"), "w-14")}>
                        {t("profiles.columnActive")}
                      </th>
                      <th className={cn(settingsColumnHeaderClass("center"), "w-10")}>
                        {t("profiles.color")}
                      </th>
                      <th className={settingsColumnHeaderClass()}>
                        {t("profiles.columnName")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProfiles.map((item) => {
                      const isSelected = item.id === selectedProfileId;
                      return (
                        <tr
                          key={item.id}
                          {...settingsListItemAttrs(item.id)}
                          onClick={() => selectProfile(item.id)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            window.getSelection()?.removeAllRanges();
                            openEditProfile(item);
                          }}
                          className={settingsDataRowClass(isSelected)}
                        >
                          <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                          <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                            <StatusDot
                              variant={item.is_active ? "success" : "inactive"}
                              label={
                                item.is_active
                                  ? t("profiles.activeYes")
                                  : t("profiles.activeNo")
                              }
                            />
                          </td>
                          <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                            <ProfileColorSwatch hex={item.color} />
                          </td>
                          <td
                            className={settingsDataCellClass(isSelected, {
                              className: "max-w-[12rem] truncate font-medium",
                            })}
                            title={item.full_name}
                          >
                            {truncateLabel(item.full_name)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </ColumnShell>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
              <h3 className={settingsPanelHeaderClass()}>
                {selectedProfile
                  ? t("profiles.panelSelected")
                  : t("profiles.panelDetails")}
              </h3>
              {actionDetailsLoading ? (
                <div
                  className="min-h-0 flex-1 bg-background"
                  aria-label={t("common.loading")}
                />
              ) : (
                <ProfileDetailActions
                  selectedProfile={selectedProfile}
                  profileQualifications={
                    selectedProfile
                      ? qualificationsCache[selectedProfile.id]
                      : undefined
                  }
                  profileAvailability={
                    selectedProfile
                      ? availabilityCache[selectedProfile.id]
                      : undefined
                  }
                  profileCompensation={
                    selectedProfile
                      ? compensationCache[selectedProfile.id]
                      : undefined
                  }
                  disabled={pending}
                  onOpen={setDetailPanel}
                />
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-end border-t border-border px-6 py-3">
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

        {profileFormMode?.type === "create" && (
          <ProfileFormModal
            mode="create"
            allProfiles={profileList}
            onClose={() => setProfileFormMode(null)}
            onSaved={handleProfileSaved}
          />
        )}
        {profileFormMode?.type === "edit" && (
          <ProfileFormModal
            mode="edit"
            profile={profileFormMode.profile}
            allProfiles={profileList}
            onClose={() => setProfileFormMode(null)}
            onSaved={handleProfileSaved}
          />
        )}
        {confirmDeleteProfile && selectedProfile && (
          <DeleteConfirmModal
            name={selectedProfile.full_name}
            pending={pending}
            onCancel={() => setConfirmDeleteProfile(false)}
            onConfirm={handleDeleteProfile}
          />
        )}
        {detailPanel === "qualifications" && selectedProfile && (
          <ProfileQualificationsPanelModal
            profile={selectedProfile}
            cachedQualifications={
              selectedProfile.id in qualificationsCache
                ? qualificationsCache[selectedProfile.id]
                : undefined
            }
            onClose={() => setDetailPanel(null)}
            onCacheUpdate={(profileId, list) => {
              setQualificationsCache((prev) => ({ ...prev, [profileId]: list }));
            }}
          />
        )}
        {detailPanel === "availability" && selectedProfile && (
          <ProfileAvailabilityPanelModal
            profile={selectedProfile}
            shiftTypes={shiftTypes}
            cachedAvailability={
              selectedProfile.id in availabilityCache
                ? availabilityCache[selectedProfile.id]
                : undefined
            }
            onClose={() => setDetailPanel(null)}
            onCacheUpdate={(profileId, list) => {
              setAvailabilityCache((prev) => ({ ...prev, [profileId]: list }));
            }}
          />
        )}
        {detailPanel === "compensation" && selectedProfile && (
          <ProfileCompensationPanelModal
            profile={selectedProfile}
            cachedCompensation={
              selectedProfile.id in compensationCache
                ? compensationCache[selectedProfile.id]
                : undefined
            }
            onClose={() => setDetailPanel(null)}
            onCacheUpdate={(profileId, entry) => {
              setCompensationCache((prev) => ({ ...prev, [profileId]: entry }));
            }}
          />
        )}
        {detailPanel === "invite" && (
          <ProfileInvitePanelModal
            employeeCount={activeEmployeeCount}
            onClose={() => setDetailPanel(null)}
            onInvited={refreshProfiles}
          />
        )}
      </div>
    </div>
  );
}
