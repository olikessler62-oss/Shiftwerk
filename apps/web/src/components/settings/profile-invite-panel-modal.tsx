"use client";

import { useEffect } from "react";
import { InviteForm } from "@/components/settings/invite-form";
import { useTranslations } from "@/i18n/locale-provider";
import { SETTINGS_MODAL_TITLE_CLASS } from "./settings-list-ui";
import { Button, CloseIcon, IconButton } from "@/components/ui";

type Props = {
  employeeCount: number;
  onClose: () => void;
  onInvited: () => void;
};

export function ProfileInvitePanelModal({
  employeeCount,
  onClose,
  onInvited,
}: Props) {
  const t = useTranslations();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center rounded-2xl bg-black/30 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-invite-panel-title"
        className="relative z-[61] flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="profile-invite-panel-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            {t("profiles.inviteEmployeeTitle")}
          </h3>
          <IconButton
            size="sm"
            onClick={onClose}
            aria-label={t("common.close")}
            className="border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div className="px-5 py-4">
          <InviteForm
            employeeCount={employeeCount}
            embedded
            onSuccess={onInvited}
          />
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            <CloseIcon />
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
