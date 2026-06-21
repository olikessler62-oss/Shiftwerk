"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  confirmAllSuperadminShiftStatuses,
  getSuperadminShiftSnapshotMeta,
  listSuperadminShifts,
  saveSuperadminShiftSnapshot,
  updateSuperadminShiftConfirmationStatus,
} from "@/app/actions/superadmin-shifts";
import { Alert, Button, Select } from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { formatTimeRange } from "@/lib/planning-utils";
import { shiftConfirmationStatusLabelKey } from "@/lib/shift-confirmation-display";
import {
  SUPERADMIN_SHIFT_CONFIRMATION_STATUSES,
  type SuperadminShiftListRow,
} from "@schichtwerk/database";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
import {
  SETTINGS_PROFILES_LIST_SCROLL_CLASS,
  settingsResponsiveTableWrapClass,
} from "./settings-list-ui";

type Props = {
  disabled?: boolean;
};

type SnapshotMeta = {
  savedAt: string;
  shiftCount: number;
};

export function SuperadminShiftsSection({ disabled = false }: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = locale === "en" ? "en-GB" : "de-DE";
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [snapshotMeta, setSnapshotMeta] = useState<SnapshotMeta | null>(null);
  const [shifts, setShifts] = useState<SuperadminShiftListRow[]>([]);
  const [savingShiftId, setSavingShiftId] = useState<string | null>(null);
  const [loading, startLoadTransition] = useTransition();
  const [snapshotPending, startSnapshotTransition] = useTransition();
  const [confirmAllPending, startConfirmAllTransition] = useTransition();

  const loadSnapshotMeta = useCallback(async () => {
    const result = await getSuperadminShiftSnapshotMeta();
    if ("ok" in result) {
      setSnapshotMeta(null);
      return;
    }
    if (result.shiftCount > 0 && result.savedAt) {
      setSnapshotMeta({ savedAt: result.savedAt, shiftCount: result.shiftCount });
    } else {
      setSnapshotMeta(null);
    }
  }, []);

  const loadShifts = useCallback(() => {
    startLoadTransition(async () => {
      const result = await listSuperadminShifts();
      if (Array.isArray(result)) {
        setShifts(result);
        setLoadError(null);
        return;
      }
      setLoadError(t(result.errorKey));
    });
  }, [t]);

  useEffect(() => {
    loadShifts();
    void loadSnapshotMeta();
  }, [loadShifts, loadSnapshotMeta]);

  const updateStatus = useCallback(
    async (shiftId: string, confirmationStatus: ShiftConfirmationStatus) => {
      setSaveError(null);
      setSavingShiftId(shiftId);
      const result = await updateSuperadminShiftConfirmationStatus({
        shiftId,
        confirmationStatus,
      });
      setSavingShiftId(null);
      if (!result.ok) {
        setSaveError(t(result.errorKey));
        return false;
      }
      setShifts((current) =>
        current.map((shift) =>
          shift.shiftId === shiftId ? { ...shift, confirmationStatus } : shift
        )
      );
      return true;
    },
    [t]
  );

  async function handleStatusChange(
    shift: SuperadminShiftListRow,
    nextStatus: ShiftConfirmationStatus
  ) {
    if (nextStatus === shift.confirmationStatus) return;
    const previousStatus = shift.confirmationStatus;
    setShifts((current) =>
      current.map((entry) =>
        entry.shiftId === shift.shiftId
          ? { ...entry, confirmationStatus: nextStatus }
          : entry
      )
    );
    const ok = await updateStatus(shift.shiftId, nextStatus);
    if (!ok) {
      setShifts((current) =>
        current.map((entry) =>
          entry.shiftId === shift.shiftId
            ? { ...entry, confirmationStatus: previousStatus }
            : entry
        )
      );
    }
  }

  function handleConfirmAllStatuses() {
    setSaveError(null);
    setSnapshotMessage(null);
    startConfirmAllTransition(async () => {
      const result = await confirmAllSuperadminShiftStatuses();
      if (!result.ok) {
        setSaveError(
          result.error
            ? `${t(result.errorKey)} ${result.error}`
            : t(result.errorKey)
        );
        return;
      }
      const updatedCount = result.updatedCount ?? 0;
      setShifts((current) =>
        current.map((shift) =>
          shift.confirmationStatus === "confirmed"
            ? shift
            : { ...shift, confirmationStatus: "confirmed" }
        )
      );
      if (updatedCount > 0) {
        setSnapshotMessage(
          t("nav.superadminConfirmAllShiftStatusesDone", { count: updatedCount })
        );
      }
    });
  }

  function handleSaveSnapshot() {
    setSaveError(null);
    setSnapshotMessage(null);
    startSnapshotTransition(async () => {
      const result = await saveSuperadminShiftSnapshot();
      if (!result.ok) {
        setSaveError(
          result.error
            ? `${t(result.errorKey)} ${result.error}`
            : t(result.errorKey)
        );
        return;
      }
      const count = result.shiftCount ?? 0;
      if (count === 0) {
        setSnapshotMeta(null);
        setSnapshotMessage(t("nav.superadminShiftsSnapshotEmpty"));
        return;
      }
      if (result.savedAt) {
        setSnapshotMeta({ savedAt: result.savedAt, shiftCount: count });
        setSnapshotMessage(
          t("nav.superadminShiftsSnapshotSaved", {
            count,
            savedAt: new Intl.DateTimeFormat(intlLocale, {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(result.savedAt)),
          })
        );
      }
    });
  }

  const controlsDisabled =
    disabled ||
    loading ||
    savingShiftId != null ||
    snapshotPending ||
    confirmAllPending;

  const snapshotSavedLabel =
    snapshotMeta && snapshotMeta.shiftCount > 0
      ? t("nav.superadminShiftsSnapshotStatus", {
          count: snapshotMeta.shiftCount,
          savedAt: new Intl.DateTimeFormat(intlLocale, {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(snapshotMeta.savedAt)),
        })
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="max-w-prose text-xs leading-snug text-muted">
            {t("nav.superadminShiftsHint")}
          </p>
          {snapshotSavedLabel ? (
            <p className="text-xs text-muted">{snapshotSavedLabel}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={controlsDisabled}
            onClick={handleSaveSnapshot}
          >
            {snapshotPending
              ? t("nav.superadminSaveShiftsSnapshotPending")
              : t("nav.superadminSaveShiftsSnapshot")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={controlsDisabled || shifts.length === 0}
            onClick={handleConfirmAllStatuses}
          >
            {confirmAllPending
              ? t("nav.superadminConfirmAllShiftStatusesPending")
              : t("nav.superadminConfirmAllShiftStatuses")}
          </Button>
        </div>
      </div>

      {loadError ? <Alert variant="error">{loadError}</Alert> : null}
      {saveError ? <Alert variant="error">{saveError}</Alert> : null}
      {snapshotMessage ? <Alert variant="info">{snapshotMessage}</Alert> : null}

      {loading && shifts.length === 0 ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : null}

      {!loading && shifts.length === 0 ? (
        <p className="text-sm text-muted">{t("nav.superadminShiftEmpty")}</p>
      ) : null}

      {shifts.length > 0 ? (
        <div
          className={cn(
            settingsResponsiveTableWrapClass(),
            SETTINGS_PROFILES_LIST_SCROLL_CLASS,
            "overflow-auto"
          )}
        >
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-surface text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="px-2 py-2 font-semibold">
                  {t("nav.superadminShiftColumnLocationArea")}
                </th>
                <th className="px-2 py-2 font-semibold">
                  {t("nav.superadminShiftColumnDate")}
                </th>
                <th className="px-2 py-2 font-semibold">
                  {t("nav.superadminShiftColumnTemplate")}
                </th>
                <th className="px-2 py-2 font-semibold">
                  {t("nav.superadminShiftColumnTime")}
                </th>
                <th className="px-2 py-2 font-semibold">
                  {t("nav.superadminShiftColumnEmployee")}
                </th>
                <th className="px-2 py-2 font-semibold">
                  {t("nav.superadminShiftColumnStatus")}
                </th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => {
                const rowDisabled = controlsDisabled || savingShiftId === shift.shiftId;

                return (
                  <tr key={shift.shiftId} className="border-b border-border/70">
                    <td className="px-2 py-2 text-foreground">
                      {shift.locationAreaLabel}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-foreground">
                      {shift.shiftDate}
                    </td>
                    <td className="px-2 py-2 text-foreground">
                      {shift.templateName ?? "—"}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-foreground">
                      {formatTimeRange(shift.startTime, shift.endTime)}
                    </td>
                    <td className="px-2 py-2 text-foreground">{shift.employeeName}</td>
                    <td className="px-2 py-2">
                      <Select
                        className="min-w-[10.5rem] text-sm"
                        value={shift.confirmationStatus}
                        disabled={rowDisabled}
                        aria-label={`${t("nav.superadminShiftColumnStatus")} — ${shift.employeeName}`}
                        onChange={(event) =>
                          handleStatusChange(
                            shift,
                            event.target.value as ShiftConfirmationStatus
                          )
                        }
                      >
                        {SUPERADMIN_SHIFT_CONFIRMATION_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t(shiftConfirmationStatusLabelKey(status))}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
