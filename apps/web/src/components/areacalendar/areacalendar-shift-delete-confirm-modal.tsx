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
};

export function AreaCalendarShiftDeleteConfirmModal({
  onCancel,
  onConfirm,
  pending = false,
  message,
}: Props) {
  const t = useTranslations();

  return (
    <div
      className={settingsNestedModalOverlayClass()}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="areacalendar-shift-delete-confirm-desc"
        className={cn(settingsConfirmDialogClass(), "overflow-hidden p-0")}
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
