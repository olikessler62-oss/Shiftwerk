"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listConfirmationSendShifts,
  sendConfirmationRequestForSelectedShifts,
  type ConfirmationSendShiftRow,
} from "@/app/actions/shift-confirmations";
import { Alert, Button, CloseIcon, IconButton } from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { formatDayHeader } from "@/lib/planning-utils";
import {
  useShiftConfirmationSimulation,
  useSimulatedProposedOnAssignRequest,
} from "@/lib/shift-confirmation-simulation-context";
import { getShiftConfirmationSimulationSendBlockedResult } from "@/lib/shift-confirmation-simulation-send-guard";
import {
  MODAL_SCROLLBAR_CLASS,
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

const ROW_GRID_CLASS =
  "grid grid-cols-[12.5rem_minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)] items-center gap-x-4";

const LIST_MAX_HEIGHT_CLASS = "max-h-40";

const CELL_CLASS = "min-w-0 truncate text-left text-sm";
const HEADER_CELL_CLASS =
  "min-w-0 truncate text-left text-xs font-semibold uppercase tracking-wide text-muted";
const CHECKBOX_LABEL_CLASS =
  "flex shrink-0 items-center gap-2 whitespace-nowrap text-left text-xs text-muted";

function statusLabelKey(
  row: ConfirmationSendShiftRow
): "shiftConfirmation.send.rowStatusOpen" | "shiftConfirmation.send.rowStatusRequested" {
  return row.confirmationStatus === "requested"
    ? "shiftConfirmation.send.rowStatusRequested"
    : "shiftConfirmation.send.rowStatusOpen";
}

export function DashboardSendConfirmationModal({
  weekStart,
  locationId,
  onClose,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const router = useRouter();
  const { blocksOutboundSend } = useShiftConfirmationSimulation();
  const { simulatedProposedOnAssign } = useSimulatedProposedOnAssignRequest();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<ConfirmationSendShiftRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sendableShifts = useMemo(
    () => shifts.filter((row) => row.sendable),
    [shifts]
  );

  const allSendableSelected = useMemo(
    () =>
      sendableShifts.length > 0 &&
      sendableShifts.every((row) => selected.has(row.shiftId)),
    [sendableShifts, selected]
  );

  const someSendableSelected = useMemo(
    () => sendableShifts.some((row) => selected.has(row.shiftId)),
    [sendableShifts, selected]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await listConfirmationSendShifts({
        weekStart,
        locationId: locationId ?? undefined,
        simulatedProposedOnAssign,
      });
      if (cancelled) return;
      if (!result.ok) {
        setErrorMessage(result.error);
        setShifts([]);
        setSelected(new Set());
      } else {
        setShifts(result.shifts);
        setSelected(
          new Set(result.shifts.filter((row) => row.sendable).map((row) => row.shiftId))
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, locationId, simulatedProposedOnAssign]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  function toggleShift(shiftId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(shiftId)) next.delete(shiftId);
      else next.add(shiftId);
      return next;
    });
  }

  function toggleAllSendable(checked: boolean) {
    setSelected(
      checked ? new Set(sendableShifts.map((row) => row.shiftId)) : new Set()
    );
  }

  function handleSend() {
    setErrorMessage(null);
    setSuccessMessage(null);
    const shiftIds = sendableShifts
      .filter((row) => selected.has(row.shiftId))
      .map((row) => row.shiftId);
    if (!shiftIds.length) {
      setErrorMessage(t("shiftConfirmation.send.noSelection"));
      return;
    }

    startTransition(async () => {
      if (blocksOutboundSend && !simulatedProposedOnAssign) {
        setErrorMessage(getShiftConfirmationSimulationSendBlockedResult().error);
        return;
      }
      const result = await sendConfirmationRequestForSelectedShifts({
        weekStart,
        shiftIds,
        locationId: locationId ?? undefined,
        simulatedProposedOnAssign,
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
          t("shiftConfirmation.send.partialSuccessShifts", {
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
      className={cn(
        settingsModalBackdropClass(),
        (loading || pending) && "cursor-wait [&_*]:cursor-wait"
      )}
      role="presentation"
      aria-busy={loading || pending}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      {!loading ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-confirmation-title"
          className={cn(settingsModalDialogClass(), "max-w-5xl")}
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

          <div className={cn(settingsModalBodyPaddingClass(), "space-y-3")}>
            {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
            {successMessage ? (
              <Alert variant="success">{successMessage}</Alert>
            ) : null}

            {shifts.length === 0 ? (
              <p className="text-sm text-muted">{t("shiftConfirmation.send.noCandidates")}</p>
            ) : (
              <div className="rounded border border-border">
                <div
                  className={cn(
                    ROW_GRID_CLASS,
                    "border-b border-border bg-subtle/40 px-3 py-2"
                  )}
                >
                  <span className={HEADER_CELL_CLASS}>
                    {t("shiftConfirmation.send.colConfirmationSelection")}
                  </span>
                  <span className={HEADER_CELL_CLASS}>
                    {t("shiftConfirmation.send.colEmployee")}
                  </span>
                  <span className={HEADER_CELL_CLASS}>
                    {t("shiftConfirmation.send.colDate")}
                  </span>
                  <span className={HEADER_CELL_CLASS}>
                    {t("shiftConfirmation.send.colTemplate")}
                  </span>
                  <span className={HEADER_CELL_CLASS}>
                    {t("shiftConfirmation.send.colTime")}
                  </span>
                  <span className={HEADER_CELL_CLASS}>
                    {t("shiftConfirmation.send.colStatus")}
                  </span>
                </div>

                <ul
                  className={cn(
                    LIST_MAX_HEIGHT_CLASS,
                    "divide-y divide-border overflow-y-auto",
                    MODAL_SCROLLBAR_CLASS
                  )}
                >
                  {shifts.map((row) => {
                    const { weekday, label } = formatDayHeader(
                      row.shiftDate,
                      intlLocale,
                      "long"
                    );
                    const hasTemplate = Boolean(row.templateName?.trim());
                    const templateLabel = hasTemplate
                      ? row.templateName!.trim()
                      : t("shiftConfirmation.send.noTemplate");

                    return (
                      <li key={row.shiftId} className={cn(ROW_GRID_CLASS, "px-3 py-2")}>
                        <label className={CHECKBOX_LABEL_CLASS}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 rounded border-border"
                            checked={selected.has(row.shiftId)}
                            disabled={pending || !row.sendable}
                            onChange={() => toggleShift(row.shiftId)}
                            aria-label={t("shiftConfirmation.send.rowRequestConfirmation")}
                          />
                          <span>{t("shiftConfirmation.send.rowRequestConfirmation")}</span>
                        </label>
                        <span className={cn(CELL_CLASS, "font-medium text-foreground")}>
                          {row.employeeName}
                        </span>
                        <span className={cn(CELL_CLASS, "text-muted")}>
                          {weekday}, {label}
                        </span>
                        <span
                          className={cn(
                            CELL_CLASS,
                            hasTemplate
                              ? "font-medium text-foreground"
                              : "text-muted"
                          )}
                        >
                          {templateLabel}
                        </span>
                        <span className={cn(CELL_CLASS, "whitespace-nowrap text-muted")}>
                          {row.startTime}–{row.endTime}
                        </span>
                        <span className={cn(CELL_CLASS, "font-medium text-foreground/80")}>
                          {t(statusLabelKey(row))}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div
                  className={cn(
                    ROW_GRID_CLASS,
                    "border-t border-border px-3 py-2"
                  )}
                >
                  <label className={CHECKBOX_LABEL_CLASS}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-border"
                      checked={allSendableSelected}
                      ref={(element) => {
                        if (element) {
                          element.indeterminate =
                            someSendableSelected && !allSendableSelected;
                        }
                      }}
                      disabled={pending || sendableShifts.length === 0}
                      onChange={(event) => toggleAllSendable(event.target.checked)}
                      aria-label={t("shiftConfirmation.send.selectAll")}
                    />
                    <span>{t("shiftConfirmation.send.selectAll")}</span>
                  </label>
                  <span aria-hidden className="min-w-0" />
                  <span aria-hidden className="min-w-0" />
                  <span aria-hidden className="min-w-0" />
                  <span aria-hidden className="min-w-0" />
                  <span aria-hidden className="min-w-0" />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSend}
                disabled={pending || sendableShifts.length === 0}
              >
                {t("shiftConfirmation.actions.requestConfirmation")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
