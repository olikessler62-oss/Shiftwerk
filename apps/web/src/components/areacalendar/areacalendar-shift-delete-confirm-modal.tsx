"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import {
  settingsNestedModalOverlayClass,
  settingsStackedConfirmOverlayClass,
} from "@/components/settings/settings-modal-shell";
import { SettingsConfirmDialogShell } from "@/components/settings/settings-list-ui";

type Props = {
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
  message?: string;
  title?: string;
  /** Seiten-Overlay für Slide-in-Panels und Kalender-Kontext. */
  placement?: "fixed" | "nested" | "stacked";
};

export function AreaCalendarShiftDeleteConfirmModal({
  onCancel,
  onConfirm,
  pending = false,
  message,
  title,
  placement = "nested",
}: Props) {
  const t = useTranslations();

  const overlayClass =
    placement === "stacked"
      ? settingsStackedConfirmOverlayClass()
      : placement === "fixed"
        ? cn(
            "fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-2 sm:p-4",
            "max-sm:items-stretch max-sm:justify-stretch max-sm:p-0"
          )
        : settingsNestedModalOverlayClass();

  const dialogClass =
    placement === "stacked"
      ? "relative z-[131]"
      : placement === "fixed"
        ? "relative z-[121]"
        : undefined;

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
        aria-labelledby="areacalendar-shift-delete-confirm-title"
        aria-describedby="areacalendar-shift-delete-confirm-desc"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SettingsConfirmDialogShell
          className={dialogClass}
          titleId="areacalendar-shift-delete-confirm-title"
          title={title ?? t("areaCalendar.deleteShift")}
          onClose={onCancel}
          closeDisabled={pending}
          closeAriaLabel={t("common.close")}
          footer={
            <>
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
            </>
          }
        >
          <p
            id="areacalendar-shift-delete-confirm-desc"
            className="text-sm text-foreground"
          >
            {message ?? t("areaCalendar.deleteShiftConfirm")}
          </p>
        </SettingsConfirmDialogShell>
      </div>
    </div>
  );
}
