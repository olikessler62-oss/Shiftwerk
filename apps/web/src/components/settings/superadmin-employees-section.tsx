"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { Profile } from "@schichtwerk/types";
import {
  listSuperadminProfiles,
  updateSuperadminProfileSimulationSettings,
} from "@/app/actions/superadmin-profiles";
import { Alert } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  SETTINGS_LIST_HEADER_BG_CLASS,
  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
  settingsResponsiveTableWrapClass,
} from "./settings-list-ui";

type Props = {
  disabled?: boolean;
};

type EmployeeRowState = {
  is_active: boolean;
  schedulable: boolean;
  app_registered: boolean;
  email_fallback_mode: boolean;
};

function toRowState(profile: Profile): EmployeeRowState {
  return {
    is_active: profile.is_active,
    schedulable: profile.schedulable,
    app_registered: profile.app_registered_at != null,
    email_fallback_mode: profile.email_fallback_mode,
  };
}

function rowsEqual(a: EmployeeRowState, b: EmployeeRowState): boolean {
  return (
    a.is_active === b.is_active &&
    a.schedulable === b.schedulable &&
    a.app_registered === b.app_registered &&
    a.email_fallback_mode === b.email_fallback_mode
  );
}

export function SuperadminEmployeesSection({ disabled = false }: Props) {
  const t = useTranslations();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rowState, setRowState] = useState<Record<string, EmployeeRowState>>({});
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [loading, startLoadTransition] = useTransition();

  useEffect(() => {
    startLoadTransition(async () => {
      const result = await listSuperadminProfiles();
      if (Array.isArray(result)) {
        setProfiles(result);
        setRowState(
          Object.fromEntries(result.map((profile) => [profile.id, toRowState(profile)]))
        );
        setLoadError(null);
        return;
      }
      setLoadError(t(result.errorKey));
    });
  }, [t]);

  const saveProfile = useCallback(
    async (profileId: string, next: EmployeeRowState) => {
      setSaveError(null);
      setSavingProfileId(profileId);
      const result = await updateSuperadminProfileSimulationSettings({
        profileId,
        ...next,
      });
      setSavingProfileId(null);
      if (!result.ok) {
        setSaveError(t(result.errorKey));
        return false;
      }
      setProfiles((current) =>
        current.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                is_active: next.is_active,
                schedulable: next.is_active ? next.schedulable : false,
                app_registered_at: next.app_registered ? new Date().toISOString() : null,
                email_fallback_mode: next.email_fallback_mode,
              }
            : profile
        )
      );
      return true;
    },
    [t]
  );

  async function updateRow(profileId: string, patch: Partial<EmployeeRowState>) {
    const current = rowState[profileId];
    if (!current) return;

    let next: EmployeeRowState = { ...current, ...patch };
    if (patch.is_active === false) {
      next = { ...next, schedulable: false };
    }

    setRowState((state) => ({ ...state, [profileId]: next }));

    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;

    const saved = toRowState(profile);
    const normalizedNext = {
      ...next,
      schedulable: next.is_active ? next.schedulable : false,
    };
    if (rowsEqual(saved, normalizedNext)) return;

    const ok = await saveProfile(profileId, normalizedNext);
    if (!ok) {
      setRowState((state) => ({ ...state, [profileId]: toRowState(profile) }));
    }
  }

  const controlsDisabled = disabled || loading || savingProfileId != null;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-snug text-muted">{t("nav.superadminEmployeesHint")}</p>
      <p className="text-xs leading-snug text-muted">{t("nav.superadminEmployeeMobileHint")}</p>

      {loadError ? <Alert variant="error">{loadError}</Alert> : null}
      {saveError ? <Alert variant="error">{saveError}</Alert> : null}

      {loading && profiles.length === 0 ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : null}

      {!loading && profiles.length === 0 ? (
        <p className="text-sm text-muted">{t("nav.superadminEmployeeEmpty")}</p>
      ) : null}

      {profiles.length > 0 ? (
        <div className={cn(settingsResponsiveTableWrapClass(), SETTINGS_PROFILES_LIST_SCROLL_CLASS, "overflow-auto")}>
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className={cn("sticky top-0 z-[1] text-xs uppercase tracking-wide text-muted", SETTINGS_LIST_HEADER_BG_CLASS)}>
              <tr className="border-b border-border">
                <th className="px-2 py-2 font-semibold">{t("nav.superadminEmployeeColumnName")}</th>
                <th className="px-2 py-2 font-semibold">{t("nav.superadminEmployeeColumnRole")}</th>
                <th className="px-2 py-2 font-semibold">{t("nav.superadminEmployeeActive")}</th>
                <th className="px-2 py-2 font-semibold">{t("nav.superadminEmployeeSchedulable")}</th>
                <th
                  className="px-2 py-2 font-semibold"
                  title={t("nav.superadminEmployeeAppRegisteredHint")}
                >
                  {t("nav.superadminEmployeeAppRegistered")}
                </th>
                <th
                  className="px-2 py-2 font-semibold"
                  title={t("nav.superadminEmployeeEmailFallbackHint")}
                >
                  {t("nav.superadminEmployeeEmailFallback")}
                </th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const state = rowState[profile.id] ?? toRowState(profile);
                const rowDisabled = controlsDisabled || savingProfileId === profile.id;

                return (
                  <tr key={profile.id} className="border-b border-border/70">
                    <td className="px-2 py-2 font-medium text-foreground">{profile.full_name}</td>
                    <td className="px-2 py-2 text-muted">{profile.role_name}</td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={state.is_active}
                        disabled={rowDisabled}
                        onChange={(event) =>
                          updateRow(profile.id, { is_active: event.target.checked })
                        }
                        aria-label={`${t("nav.superadminEmployeeActive")} — ${profile.full_name}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={state.schedulable}
                        disabled={rowDisabled || !state.is_active}
                        onChange={(event) =>
                          updateRow(profile.id, { schedulable: event.target.checked })
                        }
                        aria-label={`${t("nav.superadminEmployeeSchedulable")} — ${profile.full_name}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={state.app_registered}
                        disabled={rowDisabled || !state.is_active}
                        onChange={(event) =>
                          updateRow(profile.id, { app_registered: event.target.checked })
                        }
                        aria-label={`${t("nav.superadminEmployeeAppRegistered")} — ${profile.full_name}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={state.email_fallback_mode}
                        disabled={rowDisabled || !state.is_active}
                        onChange={(event) =>
                          updateRow(profile.id, { email_fallback_mode: event.target.checked })
                        }
                        aria-label={`${t("nav.superadminEmployeeEmailFallback")} — ${profile.full_name}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
