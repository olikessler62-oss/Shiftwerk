"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui";
import {
  settingsConfirmDialogClass,
  settingsModalFooterClass,
  settingsNestedModalOverlayClass,
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

  return (
    <div
      className={settingsNestedModalOverlayClass()}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="no-service-hours-shift-confirm-desc"
        className={settingsConfirmDialogClass()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p id="no-service-hours-shift-confirm-desc" className="text-sm text-foreground">
          {t("dashboard.noServiceHoursShiftConfirm", { area: areaName })}
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
  );
}
