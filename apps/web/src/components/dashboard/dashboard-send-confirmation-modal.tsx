"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listConfirmationSendCandidates,
  sendConfirmationRequestBulkWeek,
  type ConfirmationSendCandidate,
} from "@/app/actions/shift-confirmations";
import { Alert, Button, CloseIcon, IconButton } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalHeaderPaddingClass,
} from "@/components/settings/settings-list-ui";

type Props = {
  weekStart: string;
  locationId: string | null;
  onClose: () => void;
};

export function DashboardSendConfirmationModal({
  weekStart,
  locationId,
  onClose,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<ConfirmationSendCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await listConfirmationSendCandidates({
        weekStart,
        locationId: locationId ?? undefined,
      });
      if (cancelled) return;
      if (!result.ok) {
        setErrorMessage(result.error);
        setCandidates([]);
      } else {
        setCandidates(result.candidates);
        setSelected(new Set(result.candidates.map((row) => row.employeeId)));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, locationId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  function toggleEmployee(employeeId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  function handleSend() {
    setErrorMessage(null);
    setSuccessMessage(null);
    const employeeIds = [...selected];
    if (!employeeIds.length) {
      setErrorMessage(t("shiftConfirmation.send.noSelection"));
      return;
    }

    startTransition(async () => {
      const result = await sendConfirmationRequestBulkWeek({
        weekStart,
        employeeIds,
        locationId: locationId ?? undefined,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      const failed = result.results.filter((row) => !row.ok);
      const sent = result.results.filter((row) => row.ok);
      if (sent.length === 0) {
        setErrorMessage(failed[0]?.error ?? t("shiftConfirmation.send.failed"));
        return;
      }

      router.refresh();
      if (failed.length > 0) {
        setSuccessMessage(
          t("shiftConfirmation.send.partialSuccess", {
            sent: sent.length,
            failed: failed.length,
          })
        );
      } else {
        onClose();
      }
    });
  }

  return (
    <div
      className={settingsModalBackdropClass()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-confirmation-title"
        className={cn(settingsModalDialogClass(), "max-w-md")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            settingsModalHeaderPaddingClass(),
            "flex items-start justify-between gap-3 border-b border-border"
          )}
        >
          <h2 id="send-confirmation-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            {t("shiftConfirmation.send.modalTitle")}
          </h2>
          <IconButton
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
            disabled={pending}
          >
            <CloseIcon />
          </IconButton>
        </div>

        <div className={cn(settingsModalBodyPaddingClass(), "space-y-4")}>
          {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
          {successMessage ? (
            <Alert variant="success">{successMessage}</Alert>
          ) : null}

          <p className="text-sm text-muted">{t("shiftConfirmation.send.modalHint")}</p>

          {loading ? (
            <p className="text-sm text-muted">{t("common.loading")}</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted">{t("shiftConfirmation.send.noCandidates")}</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded border border-border p-2">
              {candidates.map((candidate) => (
                <li key={candidate.employeeId}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-subtle">
                    <input
                      type="checkbox"
                      checked={selected.has(candidate.employeeId)}
                      onChange={() => toggleEmployee(candidate.employeeId)}
                      disabled={pending}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="min-w-0 flex-1 text-sm text-foreground">
                      {candidate.fullName}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {t("shiftConfirmation.send.proposedCount", {
                        count: candidate.proposedCount,
                      })}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={pending || loading || candidates.length === 0}
            >
              {t("shiftConfirmation.actions.requestConfirmation")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
