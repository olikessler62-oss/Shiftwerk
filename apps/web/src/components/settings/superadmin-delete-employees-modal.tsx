"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listSuperadminProfiles,
  permanentlyDeleteSuperadminProfile,
} from "@/app/actions/superadmin-profiles";
import type { Profile } from "@schichtwerk/types";
import { DeleteConfirmModal } from "@/components/settings/delete-confirm-modal";
import { Alert, Button, CloseIcon, IconButton } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  SETTINGS_LIST_HEADER_BG_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsResponsiveTableWrapClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
  SettingsListRowDeleteButton,
} from "./settings-list-ui";

type Props = {
  onClose: () => void;
};

export function SuperadminDeleteEmployeesModal({ onClose }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [confirmProfile, setConfirmProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void listSuperadminProfiles().then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (Array.isArray(result)) {
        setProfiles(result);
        return;
      }
      setLoadError(t(result.errorKey));
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || pending || loading) return;
      if (confirmProfile) {
        setConfirmProfile(null);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmProfile, loading, onClose, pending]);

  function handlePermanentDelete() {
    if (!confirmProfile) return;
    const profile = confirmProfile;
    setActionError(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const result = await permanentlyDeleteSuperadminProfile({
        profileId: profile.id,
      });
      if (!result.ok) {
        setActionError(t(result.errorKey));
        return;
      }
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      setSuccessMessage(
        t("nav.superadminDeleteEmployeesDeleted", { name: profile.full_name })
      );
      setConfirmProfile(null);
      router.refresh();
    });
  }

  const busy = loading || pending;

  return (
    <>
      <div
        className={cn(settingsSubModalOverlayClass(), busy && "cursor-wait")}
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy && !confirmProfile) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="superadmin-delete-employees-title"
          className={cn(settingsSubModalDialogClass(), busy && "[&_*]:cursor-wait")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            className={cn(
              "flex items-start justify-between gap-3 border-b border-border",
              settingsModalHeaderPaddingClass()
            )}
          >
            <div className="min-w-0">
              <h2
                id="superadmin-delete-employees-title"
                className={SETTINGS_MODAL_TITLE_CLASS}
              >
                {t("nav.superadminDeleteEmployeesTitle")}
              </h2>
              <p className="mt-1 text-xs leading-snug text-muted">
                {t("nav.superadminDeleteEmployeesHint")}
              </p>
            </div>
            <IconButton
              type="button"
              aria-label={t("common.close")}
              onClick={onClose}
              disabled={busy}
            >
              <CloseIcon />
            </IconButton>
          </div>

          <div className="space-y-3 px-4 py-4 sm:px-6">
            {loadError ? <Alert variant="error">{loadError}</Alert> : null}
            {actionError ? <Alert variant="error">{actionError}</Alert> : null}
            {successMessage ? <Alert variant="info">{successMessage}</Alert> : null}

            {loading ? (
              <p className="text-sm text-muted">{t("common.loading")}</p>
            ) : null}

            {!loading && profiles.length === 0 ? (
              <p className="text-sm text-muted">{t("nav.superadminEmployeeEmpty")}</p>
            ) : null}

            {profiles.length > 0 ? (
              <div
                className={cn(
                  settingsResponsiveTableWrapClass(),
                  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
                  "overflow-auto"
                )}
              >
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className={cn("sticky top-0 z-[1] text-xs uppercase tracking-wide text-muted", SETTINGS_LIST_HEADER_BG_CLASS)}>
                    <tr className="border-b border-border">
                      <th className="px-2 py-2 font-semibold">
                        {t("nav.superadminEmployeeColumnName")}
                      </th>
                      <th className="px-2 py-2 font-semibold">
                        {t("nav.superadminEmployeeColumnRole")}
                      </th>
                      <th className="px-2 py-2 font-semibold">
                        {t("profiles.columnActive")}
                      </th>
                      <th className="px-2 py-2 font-semibold" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((profile) => (
                      <tr key={profile.id} className="border-b border-border/70">
                        <td className="px-2 py-2 font-medium text-foreground">
                          {profile.full_name}
                        </td>
                        <td className="px-2 py-2 text-muted">{profile.role_name}</td>
                        <td className="px-2 py-2 text-muted">
                          {profile.is_active
                            ? t("profiles.activeYes")
                            : t("profiles.activeNo")}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <SettingsListRowDeleteButton
                            label={t("common.yesDelete")}
                            disabled={busy}
                            showTooltip={false}
                            onClick={() => {
                              setActionError(null);
                              setSuccessMessage(null);
                              setConfirmProfile(profile);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <div className={settingsModalFooterClass()}>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      </div>

      {confirmProfile ? (
        <DeleteConfirmModal
          name={confirmProfile.full_name}
          confirmMessage={t("nav.superadminDeleteEmployeesConfirm", {
            name: confirmProfile.full_name,
          })}
          pending={pending}
          onCancel={() => setConfirmProfile(null)}
          onConfirm={handlePermanentDelete}
        />
      ) : null}
    </>
  );
}
