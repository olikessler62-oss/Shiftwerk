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
  variant: "manager" | "employee";
  employeeName?: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
  /** Seiten-Overlay für Kalender-Kontext. */
  placement?: "fixed" | "nested" | "stacked";
};

export function ShiftCancelConfirmModal({
  variant,
  employeeName,
  onCancel,
  onConfirm,
  pending = false,
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

  const messageKey =
    variant === "manager"
      ? employeeName
        ? "shiftConfirmation.cancel.confirmManagerNamed"
        : "shiftConfirmation.cancel.confirmManager"
      : "shiftConfirmation.cancel.confirmEmployee";

  const titleKey =
    variant === "manager"
      ? "shiftConfirmation.actions.cancelShiftManager"
      : "shiftConfirmation.actions.cancelShiftEmployee";

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
        aria-labelledby="shift-cancel-confirm-title"
        aria-describedby="shift-cancel-confirm-desc"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SettingsConfirmDialogShell
          className={dialogClass}
          titleId="shift-cancel-confirm-title"
          title={t(titleKey)}
          onClose={onCancel}
          closeDisabled={pending}
          closeAriaLabel={t("common.close")}
          footer={
            <>
              <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
                {t("common.no")}
              </Button>
              <Button type="button" variant="primary" onClick={onConfirm} disabled={pending}>
                {t("common.yes")}
              </Button>
            </>
          }
        >
          <p id="shift-cancel-confirm-desc" className="text-sm text-foreground">
            {employeeName ? t(messageKey, { name: employeeName }) : t(messageKey)}
          </p>
        </SettingsConfirmDialogShell>
      </div>
    </div>
  );
}
