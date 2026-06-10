"use client";

import { useEffect } from "react";
import { InviteForm } from "@/components/settings/invite-form";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
} from "./settings-list-ui";
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
      className={settingsSubModalOverlayClass()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-invite-panel-title"
        className={settingsSubModalDialogClass("lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
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

        <div className={settingsModalBodyPaddingClass()}>
          <InviteForm
            employeeCount={employeeCount}
            embedded
            onSuccess={onInvited}
          />
        </div>

        <div className={settingsModalFooterClass()}>
          <Button type="button" variant="outline" onClick={onClose}>
            <CloseIcon />
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
