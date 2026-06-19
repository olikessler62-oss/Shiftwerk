"use client";

import { useEffect } from "react";
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
  /** Seiten-Overlay (Kalender) oder verschachtelt in Einstellungs-Modals. */
  placement?: "fixed" | "nested";
  overlayClassName?: string;
  dialogClassName?: string;
  messageClassName?: string;
};

export function SettingsMessageModal({
  message,
  title,
  onClose,
  placement = "nested",
  overlayClassName,
  dialogClassName,
  messageClassName,
}: Props) {
  const t = useTranslations();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const overlayClass =
    placement === "fixed"
      ? cn(
          "fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-2 sm:p-4",
          "max-sm:items-stretch max-sm:justify-stretch max-sm:p-0",
          overlayClassName
        )
      : cn(settingsNestedModalOverlayClass(), "z-[75]", overlayClassName);

  const dialogClass =
    placement === "fixed"
      ? cn(
          settingsConfirmDialogClass(),
          "relative z-[121] flex max-h-[min(85dvh,36rem)] w-full flex-col",
          dialogClassName
        )
      : cn(settingsConfirmDialogClass(), "z-[76]", dialogClassName);

  return (
    <div
      className={overlayClass}
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
        className={dialogClass}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title ? (
          <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
        ) : null}
        <p
          id="settings-message-modal-text"
          className={cn("text-sm text-foreground", messageClassName)}
        >
          {message}
        </p>
        <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0 sm:justify-end")}>
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
