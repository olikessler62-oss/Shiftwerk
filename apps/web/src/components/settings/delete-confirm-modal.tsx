"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { Button, CloseIcon, TrashIcon } from "@/components/ui";
import {
  settingsConfirmDialogClass,
  settingsModalFooterClass,
  settingsNestedModalOverlayClass,
  SettingsConfirmDialogCloseHeader,
} from "./settings-list-ui";

type Props = {
  name: string;
  count?: number;
  confirmMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
};

export function DeleteConfirmModal({
  name,
  count,
  confirmMessage,
  onCancel,
  onConfirm,
  pending = false,
}: Props) {
  const t = useTranslations();
  const message =
    confirmMessage ??
    (count != null && count > 1
      ? t("common.confirmDeleteSelected", { count: String(count) })
      : t("common.confirmDelete", { name }));

  return (
    <div
      className={settingsNestedModalOverlayClass()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-desc"
        className={cn(settingsConfirmDialogClass(), "overflow-hidden p-0")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SettingsConfirmDialogCloseHeader
          onClose={onCancel}
          closeDisabled={pending}
          closeAriaLabel={t("common.close")}
        />
        <div className="px-4 py-4 sm:px-5">
        <p id="delete-confirm-desc" className="text-sm text-foreground">
          {message}
        </p>
        <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={pending}>
            <TrashIcon />
            {t("common.yesDelete")}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
