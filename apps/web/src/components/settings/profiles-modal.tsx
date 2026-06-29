"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchProfileAbsences } from "@/app/actions/absences";
import { fetchProfileRecurringAvailability } from "@/app/actions/profile-availability";
import { fetchProfileShiftPreferences } from "@/app/actions/profile-shift-preferences";
import { fetchProfileHourlyRates } from "@/app/actions/profile-hourly-rates";
import { fetchProfileQualifications } from "@/app/actions/profile-qualifications";
import { deleteProfile } from "@/app/actions/profiles";
import type {
  AbsenceRequest,
  Profile,
  ProfileRecurringAvailability,
  ProfileShiftPreference,
  Qualification,
} from "@schichtwerk/types";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { ProfileAvailabilityPanelModal } from "./profile-availability-panel-modal";
import { ProfileShiftPreferencesPanelModal } from "./profile-shift-preferences-panel-modal";
import { ProfileAbsencesPanelModal } from "./profile-absences-panel-modal";
import {
  ProfileCompensationPanelModal,
  type ProfileCompensationCacheEntry,
} from "./profile-compensation-panel-modal";
import { ProfileSurchargesPanelModal } from "./profile-surcharges-panel-modal";
import { ProfileFormModal } from "./profile-form-modal";
import { ProfileInvitePanelModal } from "./profile-invite-panel-modal";
import { ProfileDetailActions } from "./profile-detail-actions";
import { ProfileQualificationsPanelModal } from "./profile-qualifications-panel-modal";
import { SettingsSidePanel, SettingsSidePanelCloseButton } from "./settings-side-panel";
import { SettingsDetailBackButton } from "./settings-detail-nav";
import {
  SETTINGS_PROFILES_LIST_COMPACT_CLASS,
  SETTINGS_PROFILES_LIST_SCROLL_FROM_ELEVEN_CLASS,
  SETTINGS_PROFILES_LIST_SCROLL_THRESHOLD,
  SETTINGS_PROFILES_MASTER_DETAIL_MIN_HEIGHT_CLASS,
  settingsMasterDetailLayoutClass,
  settingsModalFooterClass,
  SettingsActionBar,
  SettingsEmptyState,
  SettingsIconActionButton,
  SettingsPrimaryActionButton,
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
  PLANNING_SIDE_PANEL_SUBTITLE_CLASS,
} from "./settings-list-ui";
import {
  Alert,
  CheckIcon,
  CloseIcon,
  PencilIcon,
  PlusIcon,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { sortProfilesByFirstName } from "@/lib/profile-display-sort";

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
  | "shiftPreferences"
  | "absences"
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
  return sortProfilesByFirstName(profiles)[0]?.id ?? null;
}

function isProfileDetailCached(
  profileId: string,
  qualificationsCache: Record<string, Qualification[]>,
  availabilityCache: Record<string, ProfileRecurringAvailability[]>,
  shiftPreferencesCache: Record<string, ProfileShiftPreference[]>,
  compensationCache: Record<string, ProfileCompensationCacheEntry>,
  absencesCache: Record<string, AbsenceRequest[]>
): boolean {
  return (
    profileId in qualificationsCache &&
    profileId in availabilityCache &&
    profileId in shiftPreferencesCache &&
    profileId in compensationCache &&
    profileId in absencesCache
  );
}

function profileDetailPanelTitle(
  panel: Exclude<DetailPanel, null>,
  t: (key: string) => string
): string {
  switch (panel) {
    case "qualifications":
      return t("profiles.panelQualifications");
    case "availability":
      return t("profiles.panelAvailability");
    case "shiftPreferences":
      return t("profiles.panelShiftPreferences");
    case "absences":
      return t("profiles.panelAbsences");
    case "compensation":
      return t("profiles.panelCompensation");
    case "surcharges":
      return t("profiles.surchargesSection");
    case "invite":
      return t("profiles.inviteEmployeeTitle");
  }
}

function isProfilesModalReady(
  profiles: Profile[],
  selectedProfileId: string | null,
  displayedProfileId: string | null,
  qualificationsCache: Record<string, Qualification[]>,
  availabilityCache: Record<string, ProfileRecurringAvailability[]>,
  shiftPreferencesCache: Record<string, ProfileShiftPreference[]>,
  compensationCache: Record<string, ProfileCompensationCacheEntry>,
  absencesCache: Record<string, AbsenceRequest[]>
): boolean {
  if (profiles.length === 0) return true;
  if (!selectedProfileId) return true;
  if (
    !isProfileDetailCached(
      selectedProfileId,
      qualificationsCache,
      availabilityCache,
      shiftPreferencesCache,
      compensationCache,
      absencesCache
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
  enableListScroll = false,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  enableListScroll?: boolean;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
      <h3 className={settingsPanelHeaderClass()}>
        <Tooltip content={title} className="block min-w-0 w-full truncate">
          <span className="block truncate">{title}</span>
        </Tooltip>
      </h3>
      <div
        className={cn(
          "relative flex flex-col",
          enableListScroll && "min-h-0 flex-1"
        )}
      >
        <div
          className={cn(
            "bg-background px-2 py-2",
            enableListScroll && "flex min-h-0 flex-1 flex-col"
          )}
        >
          <div
            className={cn(
              "rounded-md border border-border bg-surface",
              enableListScroll
                ? SETTINGS_PROFILES_LIST_SCROLL_FROM_ELEVEN_CLASS
                : SETTINGS_PROFILES_LIST_COMPACT_CLASS
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState(false);
  const [profileFormMode, setProfileFormMode] = useState<ProfileFormMode>(null);
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null);
  const [qualificationsCache, setQualificationsCache] = useState<
    Record<string, Qualification[]>
  >({});
  const [availabilityCache, setAvailabilityCache] = useState<
    Record<string, ProfileRecurringAvailability[]>
  >({});
  const [shiftPreferencesCache, setShiftPreferencesCache] = useState<
    Record<string, ProfileShiftPreference[]>
  >({});
  const [compensationCache, setCompensationCache] = useState<
    Record<string, ProfileCompensationCacheEntry>
  >({});
  const [absencesCache, setAbsencesCache] = useState<
    Record<string, AbsenceRequest[]>
  >({});
  const [scrollToProfileId, setScrollToProfileId] = useState<string | null>(null);
  const [pendingEditProfileId, setPendingEditProfileId] = useState<string | null>(
    null
  );

  const sortedProfiles = useMemo(
    () => sortProfilesByFirstName(profileList),
    [profileList]
  );
  const enableProfileListScroll =
    sortedProfiles.length >= SETTINGS_PROFILES_LIST_SCROLL_THRESHOLD;

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
      shiftPreferencesCache,
      compensationCache,
      absencesCache
    );
  const displayedPanelReady =
    !!displayedProfileId &&
    isProfileDetailCached(
      displayedProfileId,
      qualificationsCache,
      availabilityCache,
      shiftPreferencesCache,
      compensationCache,
      absencesCache
    );
  const modalReady = isProfilesModalReady(
    profileList,
    selectedProfileId,
    displayedProfileId,
    qualificationsCache,
    availabilityCache,
    shiftPreferencesCache,
    compensationCache,
    absencesCache
  );
  const deferInitialRender = !hasInitiallyShown && !modalReady;
  const profileDetailSwitching =
    !!selectedProfileId && selectedProfileId !== displayedProfileId;
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
    const shiftPrefReady = profileId in shiftPreferencesCache;
    const compReady = profileId in compensationCache;
    const absencesReady = profileId in absencesCache;
    if (qualReady && availReady && shiftPrefReady && compReady && absencesReady) return;

    let cancelled = false;

    void Promise.all([
      qualReady
        ? Promise.resolve(null)
        : fetchProfileQualifications(profileId),
      availReady
        ? Promise.resolve(null)
        : fetchProfileRecurringAvailability(profileId),
      shiftPrefReady
        ? Promise.resolve(null)
        : fetchProfileShiftPreferences(profileId),
      compReady
        ? Promise.resolve(null)
        : fetchProfileHourlyRates(profileId),
      absencesReady
        ? Promise.resolve(null)
        : fetchProfileAbsences(profileId),
    ]).then(([qualResult, availResult, shiftPrefResult, compResult, absencesResult]) => {
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
      setShiftPreferencesCache((prev) => {
        if (profileId in prev) return prev;
        const list =
          shiftPrefResult?.ok === true ? (shiftPrefResult.preferences ?? []) : [];
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
      setAbsencesCache((prev) => {
        if (profileId in prev) return prev;
        const list =
          absencesResult?.ok === true ? (absencesResult.absences ?? []) : [];
        return { ...prev, [profileId]: list };
      });
      setDisplayedProfileId(profileId);
    });

    return () => {
      cancelled = true;
    };
  }, [
    selectedProfileId,
    qualificationsCache,
    availabilityCache,
    shiftPreferencesCache,
    compensationCache,
    absencesCache,
  ]);

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

  const overlayFormOpen = !!profileFormMode;
  const anySubModalOpen = overlayFormOpen || confirmDeleteProfile;
  const modalBusy = pending || actionDetailsLoading || deferInitialRender;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (detailPanel) {
        setDetailPanel(null);
        return;
      }
      if (profileFormMode) {
        setProfileFormMode(null);
        return;
      }
      if (confirmDeleteProfile) {
        setConfirmDeleteProfile(false);
        return;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDeleteProfile, detailPanel, profileFormMode]);

  useEffect(() => {
    if (!deferInitialRender && !profileDetailSwitching) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previous;
    };
  }, [deferInitialRender, profileDetailSwitching]);

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
        shiftPreferencesCache,
        compensationCache,
        absencesCache
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
      shiftPreferencesCache,
      compensationCache,
      absencesCache
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
    setSuccessMessage(null);
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
        setSuccessMessage(
          t("profiles.deactivated", { name: result.profile.full_name })
        );
      }
      setConfirmDeleteProfile(false);
      refreshProfiles();
    });
  }

  function navigateBackFromDetail() {
    setDetailPanel(null);
  }

  const detailContextProfile =
    selectedProfile ??
    (displayedProfileId
      ? sortedProfiles.find((p) => p.id === displayedProfileId)
      : null);

  const detailSubtitleNode =
    detailPanel && detailPanel !== "invite" && detailContextProfile
      ? (
        <div className={PLANNING_SIDE_PANEL_SUBTITLE_CLASS}>
          <p className="break-words">
            {detailContextProfile.full_name}
            {detailContextProfile.role_name
              ? ` · ${detailContextProfile.role_name}`
              : ""}
          </p>
        </div>
      )
      : undefined;

  return (
    <SettingsSidePanel
      title={
        detailPanel
          ? profileDetailPanelTitle(detailPanel, t)
          : t("profiles.title")
      }
      subtitleNode={detailSubtitleNode}
      titleId="profiles-modal-title"
      onClose={onClose}
      closeDisabled={pending}
      dismissOnBackdrop={!anySubModalOpen && !detailPanel}
      dismissOnEscape={!anySubModalOpen && !detailPanel}
      closeAriaLabel={t("common.close")}
      contentReady={!deferInitialRender}
      panelClassName={cn(
        modalBusy && "cursor-wait [&_*]:cursor-wait",
        anySubModalOpen && "pointer-events-none"
      )}
      bodyClassName={cn(
        detailPanel ? "flex min-h-0 w-full flex-col px-0 py-0" : undefined
      )}
      headerAside={
        detailPanel ? (
          <SettingsDetailBackButton
            label={t("profiles.title")}
            onClick={() => setDetailPanel(null)}
            disabled={pending || profileDetailSwitching}
          />
        ) : undefined
      }
      footer={
        !detailPanel ? (
          <div className={settingsModalFooterClass()}>
            <SettingsSidePanelCloseButton disabled={pending} />
          </div>
        ) : undefined
      }
      overlay={
        <>
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
              confirmMessage={t("profiles.confirmDeactivate", {
                name: selectedProfile.full_name,
              })}
              pending={pending}
              onCancel={() => setConfirmDeleteProfile(false)}
              onConfirm={handleDeleteProfile}
            />
          )}
        </>
      }
    >
      {successMessage && (
        <div className="mb-4 shrink-0">
          <Alert variant="info">{successMessage}</Alert>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 shrink-0">
          <Alert variant="error">{errorMessage}</Alert>
        </div>
      )}

      {detailPanel && (detailPanel === "invite" || selectedProfile) ? (
        <>
          {detailPanel === "qualifications" && selectedProfile && (
            <ProfileQualificationsPanelModal
              embedded
              profile={selectedProfile}
              cachedQualifications={
                selectedProfile.id in qualificationsCache
                  ? qualificationsCache[selectedProfile.id]
                  : undefined
              }
              onClose={navigateBackFromDetail}
              onCacheUpdate={(profileId, list) => {
                setQualificationsCache((prev) => ({ ...prev, [profileId]: list }));
              }}
            />
          )}
          {detailPanel === "availability" && selectedProfile && (
            <ProfileAvailabilityPanelModal
              embedded
              profile={selectedProfile}
              cachedAvailability={
                selectedProfile.id in availabilityCache
                  ? availabilityCache[selectedProfile.id]
                  : undefined
              }
              cachedShiftPreferences={
                selectedProfile.id in shiftPreferencesCache
                  ? shiftPreferencesCache[selectedProfile.id]
                  : undefined
              }
              onClose={navigateBackFromDetail}
              onCacheUpdate={(profileId, list) => {
                setAvailabilityCache((prev) => ({ ...prev, [profileId]: list }));
              }}
              onProfileUpdate={handleProfileSaved}
            />
          )}
          {detailPanel === "shiftPreferences" && selectedProfile && (
            <ProfileShiftPreferencesPanelModal
              embedded
              profile={selectedProfile}
              cachedPreferences={
                selectedProfile.id in shiftPreferencesCache
                  ? shiftPreferencesCache[selectedProfile.id]
                  : undefined
              }
              cachedAvailability={
                selectedProfile.id in availabilityCache
                  ? availabilityCache[selectedProfile.id]
                  : undefined
              }
              onClose={navigateBackFromDetail}
              onCacheUpdate={(profileId, list) => {
                setShiftPreferencesCache((prev) => ({ ...prev, [profileId]: list }));
              }}
            />
          )}
          {detailPanel === "absences" && selectedProfile && (
            <ProfileAbsencesPanelModal
              embedded
              profile={selectedProfile}
              profiles={profileList}
              onClose={navigateBackFromDetail}
              onCacheUpdate={(profileId, absences) => {
                setAbsencesCache((prev) => ({ ...prev, [profileId]: absences }));
              }}
            />
          )}
          {detailPanel === "compensation" && selectedProfile && (
            <ProfileCompensationPanelModal
              embedded
              profile={selectedProfile}
              cachedCompensation={
                selectedProfile.id in compensationCache
                  ? compensationCache[selectedProfile.id]
                  : undefined
              }
              onClose={navigateBackFromDetail}
              onCacheUpdate={(profileId, entry) => {
                setCompensationCache((prev) => ({ ...prev, [profileId]: entry }));
              }}
            />
          )}
          {detailPanel === "surcharges" && selectedProfile && (
            <ProfileSurchargesPanelModal
              embedded
              profile={selectedProfile}
              cachedCompensation={
                selectedProfile.id in compensationCache
                  ? compensationCache[selectedProfile.id]
                  : undefined
              }
              onClose={navigateBackFromDetail}
              onCacheUpdate={(profileId, entry) => {
                setCompensationCache((prev) => ({ ...prev, [profileId]: entry }));
              }}
            />
          )}
          {detailPanel === "invite" && (
            <ProfileInvitePanelModal
              embedded
              employeeCount={activeEmployeeCount}
              onClose={navigateBackFromDetail}
              onInvited={refreshProfiles}
            />
          )}
        </>
      ) : (
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
              enableListScroll={enableProfileListScroll}
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
                    <SettingsIconActionButton
                      label={t("profiles.edit")}
                      icon={<PencilIcon />}
                      disabled={pending || !selectedProfile}
                      onClick={() => {
                        if (!selectedProfile) return;
                        openEditProfile(selectedProfile);
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
                          className={cn(settingsDataRowClass(isSelected), "h-9")}
                        >
                          <td className={settingsIndicatorCellClass(isSelected)} aria-hidden />
                          <td className={settingsDataCellClass(isSelected, { align: "center" })}>
                            {item.is_active ? (
                              <span
                                className="inline-flex justify-center"
                                aria-label={t("profiles.activeYes")}
                              >
                                <CheckIcon className="size-4 text-primary" />
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
                              disabled={pending || !item.is_active}
                              showTooltip={false}
                              onClick={() => {
                                if (!item.is_active) return;
                                selectProfile(item.id);
                                setConfirmDeleteProfile(true);
                                setProfileFormMode(null);
                                setDetailPanel(null);
                                setErrorMessage(null);
                                setSuccessMessage(null);
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
                    profileShiftPreferences={
                      shiftPreferencesCache[displayedProfile.id]
                    }
                    profileAbsences={absencesCache[displayedProfile.id]}
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
      )}
    </SettingsSidePanel>
  );
}
