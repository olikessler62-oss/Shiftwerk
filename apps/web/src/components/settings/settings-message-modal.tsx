"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { Button, CheckIcon } from "@/components/ui";
import {
  settingsConfirmDialogClass,
  settingsModalFooterClass,
  settingsNestedModalOverlayClass,
} from "./settings-list-ui";

type Props = {
  message: string;
  title?: string;
  onClose: () => void;
};

export function SettingsMessageModal({ message, title, onClose }: Props) {
  const t = useTranslations();

  return (
    <div
      className={cn(settingsNestedModalOverlayClass(), "z-[75]")}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="settings-message-modal-text"
        aria-describedby={title ? "settings-message-modal-text" : undefined}
        className={cn(settingsConfirmDialogClass(), "z-[76]")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title ? (
          <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
        ) : null}
        <p id="settings-message-modal-text" className="text-sm text-foreground">
          {message}
        </p>
        <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
          <Button
            type="button"
            variant="primary"
            onClick={onClose}
            className="w-full sm:ml-auto sm:w-auto"
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
