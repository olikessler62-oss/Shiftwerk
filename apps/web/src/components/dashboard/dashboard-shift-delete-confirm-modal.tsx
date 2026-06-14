"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui";
import {
  settingsConfirmDialogClass,
  settingsModalFooterClass,
  settingsNestedModalOverlayClass,
} from "@/components/settings/settings-list-ui";

type Props = {
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
};

export function DashboardShiftDeleteConfirmModal({
  onCancel,
  onConfirm,
  pending = false,
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
        aria-labelledby="dashboard-shift-delete-confirm-desc"
        className={settingsConfirmDialogClass()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p id="dashboard-shift-delete-confirm-desc" className="text-sm text-foreground">
          {t("dashboard.deleteShiftConfirm")}
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
  );
}
