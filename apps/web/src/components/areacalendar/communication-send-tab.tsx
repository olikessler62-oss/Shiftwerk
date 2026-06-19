"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listConfirmationSendShifts,
  sendConfirmationRequestForSelectedShifts,
  type ConfirmationSendShiftRow,
} from "@/app/actions/shift-confirmations";
import { Alert, Button } from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { formatDayHeader } from "@/lib/planning-utils";
import {
  useShiftConfirmationSimulation,
  useSimulatedProposedOnAssignRequest,
} from "@/lib/shift-confirmation-simulation-context";
import { getShiftConfirmationSimulationSendBlockedResult } from "@/lib/shift-confirmation-simulation-send-guard";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";

type Props = {
  weekStart: string;
  locationId: string | null;
  onBusyChange?: (busy: boolean) => void;
};

const ROW_GRID_CLASS =
  "grid grid-cols-[minmax(9.5rem,1.05fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,0.85fr)] items-center gap-x-3";

const LIST_MAX_HEIGHT_CLASS = "max-h-[min(28rem,calc(100dvh-18rem))]";

const CELL_CLASS = "min-w-0 truncate text-left text-sm";
const HEADER_CELL_CLASS =
  "min-w-0 truncate text-left text-xs font-semibold uppercase tracking-wide text-muted";
const CHECKBOX_LABEL_CLASS =
  "flex min-w-0 items-center gap-2 whitespace-nowrap text-left text-xs text-muted";

function statusLabelKey(
  row: ConfirmationSendShiftRow
): "shiftConfirmation.send.rowStatusOpen" | "shiftConfirmation.send.rowStatusRequested" {
  return row.confirmationStatus === "requested"
    ? "shiftConfirmation.send.rowStatusRequested"
    : "shiftConfirmation.send.rowStatusOpen";
}

export function CommunicationSendTab({
  weekStart,
  locationId,
  onBusyChange,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const router = useRouter();
  const { blocksOutboundSend } = useShiftConfirmationSimulation();
  const { simulatedProposedOnAssign, relaxAppRegistrationGate } =
    useSimulatedProposedOnAssignRequest();
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

  const selectedCount = sendableShifts.filter((row) => selected.has(row.shiftId)).length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await listConfirmationSendShifts({
        weekStart,
        locationId: locationId ?? undefined,
        simulatedProposedOnAssign,
        relaxAppRegistrationGate,
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
  }, [relaxAppRegistrationGate, weekStart, locationId, simulatedProposedOnAssign]);

  useEffect(() => {
    onBusyChange?.(loading || pending);
  }, [loading, onBusyChange, pending]);

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
        relaxAppRegistrationGate,
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
        setSuccessMessage(
          t("shiftConfirmation.communication.resendSuccess", {
            count: sent.length,
          })
        );
        setSelected(new Set());
      }
    });
  }

  if (loading) {
    return <p className="py-6 text-sm text-muted">{t("common.loading")}</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}

      <p className="text-xs text-muted">{t("shiftConfirmation.send.modalHint")}</p>

      {shifts.length === 0 ? (
        <p className="py-6 text-sm text-muted">{t("shiftConfirmation.send.noCandidates")}</p>
      ) : (
        <div className="min-h-0 flex-1 rounded border border-border">
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
              const rowSelectionInactive = !row.sendable;

              return (
                <li key={row.shiftId} className={cn(ROW_GRID_CLASS, "px-3 py-2")}>
                  <label className={CHECKBOX_LABEL_CLASS}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-border"
                      checked={selected.has(row.shiftId)}
                      disabled={pending || rowSelectionInactive}
                      onChange={() => toggleShift(row.shiftId)}
                      aria-label={t("shiftConfirmation.send.rowRequestConfirmation")}
                    />
                    <span className="truncate">
                      {t("shiftConfirmation.send.rowRequestConfirmation")}
                    </span>
                  </label>
                  <span
                    className={cn(
                      CELL_CLASS,
                      rowSelectionInactive
                        ? "text-muted"
                        : "font-medium text-foreground"
                    )}
                  >
                    {row.employeeName}
                  </span>
                  <span className={cn(CELL_CLASS, "text-muted")}>
                    {weekday}, {label}
                  </span>
                  <span
                    className={cn(
                      CELL_CLASS,
                      rowSelectionInactive || !hasTemplate
                        ? "text-muted"
                        : "font-medium text-foreground"
                    )}
                  >
                    {templateLabel}
                  </span>
                  <span className={cn(CELL_CLASS, "whitespace-nowrap text-muted")}>
                    {row.startTime} - {row.endTime}
                  </span>
                  <span
                    className={cn(
                      CELL_CLASS,
                      rowSelectionInactive
                        ? "text-muted"
                        : "font-medium text-foreground/80"
                    )}
                  >
                    {t(statusLabelKey(row))}
                  </span>
                </li>
              );
            })}
          </ul>

          <div
            className={cn(ROW_GRID_CLASS, "border-t border-border px-3 py-2")}
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
        <Button
          type="button"
          onClick={handleSend}
          disabled={pending || !someSendableSelected}
        >
          {selectedCount > 0
            ? `${t("shiftConfirmation.actions.requestConfirmation")} (${selectedCount})`
            : t("shiftConfirmation.actions.requestConfirmation")}
        </Button>
      </div>
    </div>
  );
}
