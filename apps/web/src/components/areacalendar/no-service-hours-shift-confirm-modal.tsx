"use client";

import { createPortal } from "react-dom";
import { useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui";
import {
  settingsFixedNestedOverlayClass,
  SettingsConfirmDialogShell,
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
        aria-labelledby="no-service-hours-shift-confirm-title"
        aria-describedby="no-service-hours-shift-confirm-desc"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SettingsConfirmDialogShell
          titleId="no-service-hours-shift-confirm-title"
          title={t("areaCalendar.noServiceHours")}
          onClose={onCancel}
          closeAriaLabel={t("common.close")}
          footer={
            <>
              <Button type="button" variant="outline" onClick={onCancel}>
                {t("common.no")}
              </Button>
              <Button type="button" variant="primary" onClick={onConfirm}>
                {t("common.yes")}
              </Button>
            </>
          }
        >
          <p id="no-service-hours-shift-confirm-desc" className="text-sm text-foreground">
            {t("areaCalendar.noServiceHoursShiftConfirm", { area: areaName })}
          </p>
        </SettingsConfirmDialogShell>
      </div>
    </div>,
    document.body
  );
}
