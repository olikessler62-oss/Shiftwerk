"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import {
  SettingsConfirmDialogShell,
  settingsNestedModalOverlayClass,
} from "./settings-list-ui";

const TITLE_ID = "settings-message-modal-title";
const DESC_ID = "settings-message-modal-desc";

type Props = {
  message: string;
  title?: string;
  subtitle?: ReactNode;
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
  subtitle,
  onClose,
  placement = "nested",
  overlayClassName,
  dialogClassName,
  messageClassName,
}: Props) {
  const t = useTranslations();
  const resolvedTitle = title ?? t("common.notice");

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
    placement === "fixed" ? cn("relative z-[121]", dialogClassName) : cn("z-[76]", dialogClassName);

  return (
    <div
      className={overlayClass}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={DESC_ID}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SettingsConfirmDialogShell
          className={dialogClass}
          titleId={TITLE_ID}
          title={resolvedTitle}
          subtitle={subtitle}
          onClose={onClose}
          closeAriaLabel={t("common.close")}
          footer={
            <Button
              type="button"
              variant="primary"
              onClick={onClose}
              className="w-full sm:ml-auto sm:w-auto"
            >
              {t("common.ok")}
            </Button>
          }
        >
          <p
            id={DESC_ID}
            className={cn("text-sm leading-relaxed text-foreground", messageClassName)}
          >
            {message}
          </p>
        </SettingsConfirmDialogShell>
      </div>
    </div>
  );
}
