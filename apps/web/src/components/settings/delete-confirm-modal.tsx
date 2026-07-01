"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { Button, CloseIcon, TrashIcon } from "@/components/ui";
import {
  settingsNestedModalOverlayClass,
  SettingsConfirmDialogShell,
} from "./settings-list-ui";

type Props = {
  name: string;
  count?: number;
  confirmMessage?: string;
  title?: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
};

export function DeleteConfirmModal({
  name,
  count,
  confirmMessage,
  title,
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
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-desc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SettingsConfirmDialogShell
          titleId="delete-confirm-title"
          title={title ?? t("common.delete")}
          onClose={onCancel}
          closeDisabled={pending}
          closeAriaLabel={t("common.close")}
          footer={
            <>
              <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
                <CloseIcon />
                {t("common.cancel")}
              </Button>
              <Button type="button" variant="danger" onClick={onConfirm} disabled={pending}>
                <TrashIcon />
                {t("common.yesDelete")}
              </Button>
            </>
          }
        >
          <p id="delete-confirm-desc" className="text-sm text-foreground">
            {message}
          </p>
        </SettingsConfirmDialogShell>
      </div>
    </div>
  );
}
