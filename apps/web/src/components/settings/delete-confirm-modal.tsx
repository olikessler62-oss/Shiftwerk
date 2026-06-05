"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { Button, CloseIcon, TrashIcon } from "@/components/ui";

type Props = {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
};

export function DeleteConfirmModal({
  name,
  onCancel,
  onConfirm,
  pending = false,
}: Props) {
  const t = useTranslations();

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center rounded-2xl bg-black/30 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-desc"
        className="relative z-[71] w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p id="delete-confirm-desc" className="text-sm text-foreground">
          {t("common.confirmDelete", { name })}
        </p>
        <div className="mt-5 flex justify-end gap-2">
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
  );
}
