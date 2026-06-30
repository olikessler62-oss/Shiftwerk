"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import {
  settingsConfirmDialogClass,
  settingsModalFooterClass,
  settingsNestedModalOverlayClass,
  SettingsConfirmDialogCloseHeader,
} from "@/components/settings/settings-list-ui";

type Props = {
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
  message?: string;
  /** Seiten-Overlay für Slide-in-Panels und Kalender-Kontext. */
  placement?: "fixed" | "nested";
};

export function AreaCalendarShiftDeleteConfirmModal({
  onCancel,
  onConfirm,
  pending = false,
  message,
  placement = "nested",
}: Props) {
  const t = useTranslations();

  const overlayClass =
    placement === "fixed"
      ? cn(
          "fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-2 sm:p-4",
          "max-sm:items-stretch max-sm:justify-stretch max-sm:p-0"
        )
      : settingsNestedModalOverlayClass();

  const dialogClass =
    placement === "fixed"
      ? cn(settingsConfirmDialogClass(), "relative z-[121]")
      : settingsConfirmDialogClass();

  return (
    <div
      className={overlayClass}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="areacalendar-shift-delete-confirm-desc"
        className={cn(dialogClass, "overflow-hidden p-0")}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SettingsConfirmDialogCloseHeader
          onClose={onCancel}
          closeDisabled={pending}
          closeAriaLabel={t("common.close")}
        />
        <div className="px-4 py-4 sm:px-5">
        <p id="areacalendar-shift-delete-confirm-desc" className="text-sm text-foreground">
          {message ?? t("areaCalendar.deleteShiftConfirm")}
        </p>
        <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            {t("common.no")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            disabled={pending}
          >
            {t("common.yes")}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
