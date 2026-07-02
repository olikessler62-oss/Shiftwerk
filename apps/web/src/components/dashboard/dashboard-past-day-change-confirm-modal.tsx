"use client";

import { createPortal } from "react-dom";
import { useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui";
import {
  settingsFixedNestedOverlayClass,
  SettingsConfirmDialogShell,
} from "@/components/settings/settings-list-ui";

type Props = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function DashboardPastDayChangeConfirmModal({
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
        aria-labelledby="dashboard-past-day-change-confirm-title"
        aria-describedby="dashboard-past-day-change-confirm-desc"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SettingsConfirmDialogShell
          titleId="dashboard-past-day-change-confirm-title"
          title={t("dashboard.pastDayChangeConfirmTitle")}
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
          <p
            id="dashboard-past-day-change-confirm-desc"
            className="text-sm text-foreground"
          >
            {t("dashboard.pastDayChangeConfirmMessage")}
          </p>
        </SettingsConfirmDialogShell>
      </div>
    </div>,
    document.body
  );
}
