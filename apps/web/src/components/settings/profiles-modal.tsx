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
} from "@schichtwerk/types";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { ProfileAvailabilityPanelModal } from "./profile-availability-panel-modal";
import {
  ProfileCompensationPanelModal,
  type ProfileCompensationCacheEntry,
} from "./profile-compensation-panel-modal";
import { ProfileSurchargesPanelModal } from "./profile-surcharges-panel-modal";
import { ProfileFormModal } from "./profile-form-modal";
import { ProfileInvitePanelModal } from "./profile-invite-panel-modal";
import { ProfileDetailActions } from "./profile-detail-actions";
import { ProfileQualificationsPanelModal } from "./profile-qualifications-panel-modal";
import {
  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
  SETTINGS_PROFILES_MASTER_DETAIL_MIN_HEIGHT_CLASS,
  SETTINGS_MODAL_MAX_WIDTH,
  SETTINGS_MODAL_TITLE_CLASS,
  settingsMasterDetailLayoutClass,
  settingsModalBackdropClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
  SettingsReorderButtons,
  SettingsListRowDeleteButton,
  settingsListItemAttrs,
  useScrollToSettingsListItem,
  settingsListRowDeleteCellClass,
  settingsListRowDeleteHeaderClass,
  settingsStickyColumnHeaderClass,
  settingsStickyIndicatorHeaderClass,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsIndicatorCellClass,
  settingsPanelHeaderClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useSettingsListReorder } from "@/lib/settings-list-reorder";
import { useDeferredSettingsModalRender } from "./use-deferred-settings-modal-render";

type Props = {
  profiles: Profile[];
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
  | "surcharges"
  | "invite";

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

function isProfileDetailCached(
  profileId: string,
  qualificationsCache: Record<string, Qualification[]>,
  availabilityCache: Record<string, ProfileRecurringAvailability[]>,
  compensationCache: Record<string, ProfileCompensationCacheEntry>
): boolean {
  return (
    profileId in qualificationsCache &&
    profileId in availabilityCache &&
    profileId in compensationCache
  );
}

function isProfilesModalReady(
  profiles: Profile[],
  selectedProfileId: string | null,
  displayedProfileId: string | null,
  qualificationsCache: Record<string, Qualification[]>,
  availabilityCache: Record<string, ProfileRecurringAvailability[]>,
  compensationCache: Record<string, ProfileCompensationCacheEntry>
): boolean {
  if (profiles.length === 0) return true;
  if (!selectedProfileId) return true;
  if (
    !isProfileDetailCached(
      selectedProfileId,
      qualificationsCache,
      availabilityCache,
      compensationCache
    )
  ) {
    return false;
  }
  return displayedProfileId === selectedProfileId;
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
      <h3 className={settingsPanelHeaderClass()}>
        <Tooltip content={title} className="block min-w-0 w-full truncate">
          <span className="block truncate">{title}</span>
        </Tooltip>
      </h3>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 bg-background px-2 py-2">
          <div
            className={cn(
              "min-h-0 overflow-auto rounded-md border border-border bg-surface",
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
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [hasInitiallyShown, setHasInitiallyShown] = useState(false);
  const [profileList, setProfileList] = useState(profiles);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() =>
    resolveInitialProfileId(profiles, initialSelectedProfileId)
  );
  const [displayedProfileId, setDisplayedProfileId] = useState<string | null>(null);
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
  const [pendingEditProfileId, setPendingEditProfileId] = useState<string | null>(
    null
  );

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
  const displayedProfile = displayedProfileId
    ? sortedProfiles.find((p) => p.id === displayedProfileId) ?? null
    : null;
  const panelProfileReady =
    !!selectedProfileId &&
    isProfileDetailCached(
      selectedProfileId,
      qualificationsCache,
      availabilityCache,
      compensationCache
    );
  const displayedPanelReady =
    !!displayedProfileId &&
    isProfileDetailCached(
      displayedProfileId,
      qualificationsCache,
      availabilityCache,
      compensationCache
    );
  const modalReady = isProfilesModalReady(
    profileList,
    selectedProfileId,
    displayedProfileId,
    qualificationsCache,
    availabilityCache,
    compensationCache
  );
  const deferInitialRender = !hasInitiallyShown && !modalReady;
  const profileDetailSwitching =
    !!selectedProfileId && selectedProfileId !== displayedProfileId;
  const showModal = useDeferredSettingsModalRender(deferInitialRender, onClose);
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
    if (modalReady && !hasInitiallyShown) {
      setHasInitiallyShown(true);
    }
  }, [hasInitiallyShown, modalReady]);

  useEffect(() => {
    if (!selectedProfileId) {
      setDisplayedProfileId(null);
      return;
    }
    if (!panelProfileReady) return;
    setDisplayedProfileId(selectedProfileId);
  }, [selectedProfileId, panelProfileReady]);

  useEffect(() => {
    setProfileList(profiles);
    setSelectedProfileId((current) => {
      if (current && profiles.some((p) => p.id === current)) return current;
      return resolveInitialProfileId(profiles, initialSelectedProfileId);
    });
  }, [profiles, initialSelectedProfileId]);

  const actionDetailsLoading = profileDetailSwitching;

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
              currentSurcharges: compResult.currentSurcharges ?? [],
              surchargeEntries: compResult.surchargeEntries ?? [],
              serverToday: compResult.serverToday ?? "",
            },
          };
        }
        return {
          ...prev,
          [profileId]: {
            currentRate: null,
            rates: [],
            currentSurcharges: [],
            surchargeEntries: [],
            serverToday: "",
          },
        };
      });
      setDisplayedProfileId(profileId);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProfileId, qualificationsCache, availabilityCache, compensationCache]);

  useEffect(() => {
    if (!pendingEditProfileId) return;
    if (selectedProfileId !== pendingEditProfileId) return;
    if (!panelProfileReady) return;

    const profile = profileList.find((p) => p.id === pendingEditProfileId);
    if (profile) {
      setProfileFormMode({ type: "edit", profile });
      setConfirmDeleteProfile(false);
      setDetailPanel(null);
      setErrorMessage(null);
    }
    setPendingEditProfileId(null);
  }, [
    panelProfileReady,
    pendingEditProfileId,
    profileList,
    selectedProfileId,
  ]);

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
    setPendingEditProfileId(null);
    setSelectedProfileId(id);
    if (
      isProfileDetailCached(
        id,
        qualificationsCache,
        availabilityCache,
        compensationCache
      )
    ) {
      setDisplayedProfileId(id);
    }
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
    setPendingEditProfileId(null);
  }

  function requestEditProfile(profile: Profile) {
    const profileReady = isProfileDetailCached(
      profile.id,
      qualificationsCache,
      availabilityCache,
      compensationCache
    );

    if (profile.id !== selectedProfileId) {
      setSelectedProfileId(profile.id);
      setDetailPanel(null);
      setConfirmDeleteProfile(false);
      setProfileFormMode(null);
      setErrorMessage(null);
    }

    if (profileReady) {
      setDisplayedProfileId(profile.id);
      openEditProfile(profile);
    } else {
      setPendingEditProfileId(profile.id);
    }
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

  if (!showModal) return null;

  return (
    <div
      className={cn(settingsModalBackdropClass(), modalBusy && "cursor-wait")}
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
        className="relative flex w-full min-w-0 flex-col"
        style={{ maxWidth: SETTINGS_MODAL_MAX_WIDTH }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profiles-modal-title"
          aria-busy={modalBusy}
          aria-hidden={anyOverlayOpen}
          className={cn(
            settingsModalDialogClass(),
            modalBusy && "[&_*]:cursor-wait",
            anyOverlayOpen ? "pointer-events-none" : ""
          )}
        >
          <div className={cn("shrink-0 border-b border-border", settingsModalHeaderPaddingClass())}>
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
              settingsMasterDetailLayoutClass(),
              SETTINGS_PROFILES_MASTER_DETAIL_MIN_HEIGHT_CLASS
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
                  <thead>
                    <tr className="border-b border-border">
                      <th
                        className={settingsStickyIndicatorHeaderClass()}
                        aria-hidden
                      />
                      <th className={cn(settingsStickyColumnHeaderClass("center"), "w-14")}>
                        {t("profiles.columnActive")}
                      </th>
                      <th className={cn(settingsStickyColumnHeaderClass("center"), "w-10")}>
                        {t("profiles.color")}
                      </th>
                      <th className={settingsStickyColumnHeaderClass()}>
                        {t("profiles.columnName")}
                      </th>
                      <th className={settingsStickyColumnHeaderClass()}>
                        {t("profiles.columnRole")}
                      </th>
                      <th
                        className={settingsListRowDeleteHeaderClass()}
                        aria-hidden
                      />
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
                            requestEditProfile(item);
                          }}
                          className={settingsDataRowClass(isSelected)}
                        >
                          <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                          <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                            {item.is_active ? (
                              <span
                                className="inline-flex justify-center"
                                aria-label={t("profiles.activeYes")}
                              >
                                <CheckIcon className="size-4 text-green-600" />
                              </span>
                            ) : (
                              <span
                                className="inline-flex justify-center"
                                aria-label={t("profiles.activeNo")}
                              >
                                <CloseIcon className="size-4 text-red-600" />
                              </span>
                            )}
                          </td>
                          <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                            <ProfileColorSwatch hex={item.color} />
                          </td>
                          <td
                            className={settingsDataCellClass(isSelected, {
                              className: "max-w-[12rem] truncate font-medium",
                            })}
                          >
                            <span className="block max-w-full truncate">
                              {truncateLabel(item.full_name)}
                            </span>
                          </td>
                          <td
                            className={settingsDataCellClass(isSelected, {
                              className: "max-w-[10rem] truncate text-muted",
                            })}
                          >
                            <span className="block max-w-full truncate">
                              {item.role_name ? truncateLabel(item.role_name, 20) : "—"}
                            </span>
                          </td>
                          <td className={settingsListRowDeleteCellClass(isSelected)}>
                            <SettingsListRowDeleteButton
                              label={t("profiles.delete")}
                              disabled={pending}
                              showTooltip={false}
                              onClick={() => {
                                selectProfile(item.id);
                                setConfirmDeleteProfile(true);
                                setProfileFormMode(null);
                                setDetailPanel(null);
                                setErrorMessage(null);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </ColumnShell>

            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60",
                actionDetailsLoading && "pointer-events-none"
              )}
            >
              <h3
                className={cn(
                  settingsPanelHeaderClass(),
                  (displayedProfile?.role_name ?? selectedProfile?.role_name) &&
                    "flex min-w-0 items-baseline gap-2"
                )}
              >
                {displayedProfile ? (
                  <>
                    <span className="shrink-0">{t("profiles.panelSelected")}</span>
                    {displayedProfile.role_name ? (
                      <span className="min-w-0 truncate text-xs font-normal text-muted">
                        {displayedProfile.role_name}
                      </span>
                    ) : null}
                  </>
                ) : selectedProfile ? (
                  <>
                    <span className="shrink-0">{t("profiles.panelSelected")}</span>
                    {selectedProfile.role_name ? (
                      <span className="min-w-0 truncate text-xs font-normal text-muted">
                        {selectedProfile.role_name}
                      </span>
                    ) : null}
                  </>
                ) : (
                  t("profiles.panelDetails")
                )}
              </h3>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {displayedProfile && displayedPanelReady ? (
                  <ProfileDetailActions
                    selectedProfile={displayedProfile}
                    profileQualifications={
                      qualificationsCache[displayedProfile.id]
                    }
                    profileAvailability={availabilityCache[displayedProfile.id]}
                    profileCompensation={compensationCache[displayedProfile.id]}
                    disabled={pending || profileDetailSwitching}
                    onOpen={setDetailPanel}
                  />
                ) : (
                  <ProfileDetailActions
                    selectedProfile={null}
                    disabled={pending || profileDetailSwitching}
                    onOpen={setDetailPanel}
                  />
                )}
              </div>
            </div>
          </div>

          <div className={settingsModalFooterClass("shrink-0 px-4 sm:px-6")}>
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
        {detailPanel === "surcharges" && selectedProfile && (
          <ProfileSurchargesPanelModal
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
