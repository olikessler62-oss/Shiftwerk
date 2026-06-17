"use client";

import { useEffect, useState } from "react";
import {
  fetchNotificationOutboxEntries,
  type NotificationOutboxRow,
} from "@/app/actions/notification-outbox";
import { NotificationOutboxView } from "@/components/settings/notification-outbox-view";
import { Alert, Button, CloseIcon, IconButton } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
} from "./settings-list-ui";

type Props = {
  onClose: () => void;
};

export function NotificationOutboxModal({ onClose }: Props) {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [entries, setEntries] = useState<NotificationOutboxRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    void fetchNotificationOutboxEntries().then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setErrorMessage(result.error);
        setEntries([]);
        return;
      }
      setEntries(result.entries);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onClose]);

  return (
    <div
      className={cn(settingsSubModalOverlayClass(), loading && "cursor-wait")}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-outbox-modal-title"
        aria-busy={loading}
        className={cn(
          settingsSubModalDialogClass("2xl"),
          "flex max-h-[min(90vh,52rem)] flex-col",
          loading && "[&_*]:cursor-wait"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            "flex shrink-0 items-start justify-between gap-3 border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <div className="min-w-0">
            <h2 id="notification-outbox-modal-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("shiftConfirmation.outbox.title")}
            </h2>
            <p className="mt-1 text-sm text-muted">{t("shiftConfirmation.outbox.hint")}</p>
          </div>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={loading}
            aria-label={t("common.close")}
            className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        {errorMessage ? (
          <div className="mx-4 mt-3 shrink-0">
            <Alert variant="error">{errorMessage}</Alert>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">{t("common.loading")}</p>
          ) : (
            <NotificationOutboxView entries={entries} embedded />
          )}
        </div>

        <div className={settingsModalFooterClass("shrink-0")}>
          <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
            <CloseIcon />
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
