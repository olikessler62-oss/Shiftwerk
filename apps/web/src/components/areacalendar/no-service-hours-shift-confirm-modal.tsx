"use client";

import { createPortal } from "react-dom";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import {
  settingsConfirmDialogClass,
  settingsFixedNestedOverlayClass,
  settingsModalFooterClass,
  SettingsConfirmDialogCloseHeader,
} from "@/components/settings/settings-list-ui";

type Props = {
  areaName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function NoServiceHoursShiftConfirmModal({
  areaName,
  onCancel,
  onConfirm,
}: Props) {
  const t = useTranslations();

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={settingsFixedNestedOverlayClass()}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="no-service-hours-shift-confirm-desc"
        className={cn(settingsConfirmDialogClass(), "overflow-hidden p-0")}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SettingsConfirmDialogCloseHeader
          onClose={onCancel}
          closeAriaLabel={t("common.close")}
        />
        <div className="px-4 py-4 sm:px-5">
        <p id="no-service-hours-shift-confirm-desc" className="text-sm text-foreground">
          {t("areaCalendar.noServiceHoursShiftConfirm", { area: areaName })}
        </p>
        <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.no")}
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm}>
            {t("common.yes")}
          </Button>
        </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
