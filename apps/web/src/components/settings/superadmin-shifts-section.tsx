"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  listSuperadminShifts,
  resetOrganizationShifts,
  updateSuperadminShiftConfirmationStatus,
} from "@/app/actions/superadmin-shifts";
import { Alert, Button, Select } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
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
  settingsConfirmDialogClass,
  settingsModalFooterClass,
  settingsNestedModalOverlayClass,
  settingsResponsiveTableWrapClass,
} from "./settings-list-ui";

type Props = {
  disabled?: boolean;
};

export function SuperadminShiftsSection({ disabled = false }: Props) {
  const t = useTranslations();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [shifts, setShifts] = useState<SuperadminShiftListRow[]>([]);
  const [savingShiftId, setSavingShiftId] = useState<string | null>(null);
  const [loading, startLoadTransition] = useTransition();
  const [resetPending, startResetTransition] = useTransition();

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
  }, [loadShifts]);

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

  function handleResetConfirm() {
    setResetError(null);
    startResetTransition(async () => {
      const result = await resetOrganizationShifts();
      if (!result.ok) {
        setResetError(t(result.errorKey));
        setResetConfirmOpen(false);
        return;
      }
      setShifts([]);
      setResetConfirmOpen(false);
    });
  }

  const controlsDisabled = disabled || loading || savingShiftId != null || resetPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-xs leading-snug text-muted">
          {t("nav.superadminShiftsHint")}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={controlsDisabled}
          className="shrink-0 text-destructive hover:bg-destructive/5 hover:text-destructive"
          onClick={() => setResetConfirmOpen(true)}
        >
          {resetPending ? t("nav.shiftsResetPending") : t("nav.shiftsReset")}
        </Button>
      </div>

      {loadError ? <Alert variant="error">{loadError}</Alert> : null}
      {saveError ? <Alert variant="error">{saveError}</Alert> : null}
      {resetError ? <Alert variant="error">{resetError}</Alert> : null}

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

      {resetConfirmOpen ? (
        <div
          className={settingsNestedModalOverlayClass()}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !resetPending) {
              setResetConfirmOpen(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="superadmin-shifts-reset-title"
            className={settingsConfirmDialogClass()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3
              id="superadmin-shifts-reset-title"
              className="text-base font-semibold text-foreground"
            >
              {t("nav.shiftsResetConfirmTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t("nav.shiftsResetConfirmBody")}
            </p>
            <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
              <Button
                type="button"
                variant="outline"
                disabled={resetPending}
                onClick={() => setResetConfirmOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={resetPending}
                onClick={handleResetConfirm}
              >
                {resetPending ? t("nav.shiftsResetPending") : t("nav.shiftsReset")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
