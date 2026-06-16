"use client";

import { useEffect, useState, useTransition } from "react";
import { resetOrganizationDatabase } from "@/app/actions/db-reset";
import { OrganizationPlanningModeModal } from "@/components/settings/organization-planning-mode-modal";
import { Alert, Button } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useSimpleCalendarDisplay } from "@/lib/simple-calendar-display-context";
import { useShiftConfirmationSimulation } from "@/lib/shift-confirmation-simulation-context";
import {
  SETTINGS_MODAL_MAX_WIDTH,
  SETTINGS_MODAL_TITLE_CLASS,
  dashboardModalBackdropClass,
  settingsConfirmDialogClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalOverlayClass,
} from "@/components/settings/settings-list-ui";

type Props = {
  onClose: () => void;
};

export function SuperadminModal({ onClose }: Props) {
  const t = useTranslations();
  const [planningModeOpen, setPlanningModeOpen] = useState(false);
  const [dbResetConfirmOpen, setDbResetConfirmOpen] = useState(false);
  const [dbResetError, setDbResetError] = useState<string | null>(null);
  const [dbResetPending, startDbResetTransition] = useTransition();
  const { simpleCalendarFirstShiftOnly, setSimpleCalendarFirstShiftOnly } =
    useSimpleCalendarDisplay();
  const {
    shiftConfirmationEnabled,
    setShiftConfirmationEnabled,
    simulatedProposedOnAssign,
    setSimulatedProposedOnAssign,
  } = useShiftConfirmationSimulation();

  const overlayOpen = planningModeOpen || dbResetConfirmOpen || dbResetPending;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || dbResetPending) return;
      if (dbResetConfirmOpen) {
        setDbResetConfirmOpen(false);
        return;
      }
      if (planningModeOpen) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dbResetConfirmOpen, dbResetPending, onClose, planningModeOpen]);

  function handleDbResetConfirm() {
    setDbResetError(null);
    startDbResetTransition(async () => {
      const result = await resetOrganizationDatabase();
      if (!result.ok) {
        setDbResetError(result.error);
        setDbResetConfirmOpen(false);
      }
    });
  }

  return (
    <div
      className={dashboardModalBackdropClass()}
      role="presentation"
      aria-busy={dbResetPending}
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !overlayOpen &&
          !dbResetPending
        ) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex w-full min-w-0 flex-col"
        style={{ maxWidth: SETTINGS_MODAL_MAX_WIDTH }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="superadmin-modal-title"
          aria-hidden={overlayOpen}
          className={cn(
            settingsModalDialogClass(),
            overlayOpen ? "pointer-events-none" : undefined,
            dbResetPending && "[&_*]:cursor-wait"
          )}
        >
          <div
            className={cn("shrink-0 border-b border-border", settingsModalHeaderPaddingClass())}
          >
            <h2 id="superadmin-modal-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("nav.superadmin")}
            </h2>
          </div>

          <div className={cn(settingsModalBodyPaddingClass(), "space-y-6")}>
            {dbResetError ? <Alert variant="error">{dbResetError}</Alert> : null}

            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("nav.superadminActionsTitle")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={dbResetPending}
                  onClick={() => setPlanningModeOpen(true)}
                >
                  {t("nav.planningMode")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={dbResetPending}
                  className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => setDbResetConfirmOpen(true)}
                >
                  {t("nav.dbReset")}
                </Button>
              </div>
            </section>

            <section className="space-y-4 border-t border-border pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("nav.superadminSimulationTitle")}
              </p>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 hover:bg-primary/5">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={simpleCalendarFirstShiftOnly}
                  disabled={dbResetPending}
                  onChange={(event) =>
                    setSimpleCalendarFirstShiftOnly(event.target.checked)
                  }
                />
                <span>
                  <span className="text-sm font-medium text-foreground">
                    {t("nav.superadminSimpleCalendar")}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted">
                    {t("nav.superadminSimpleCalendarHint")}
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 hover:bg-primary/5">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={shiftConfirmationEnabled}
                  disabled={dbResetPending}
                  onChange={(event) =>
                    setShiftConfirmationEnabled(event.target.checked)
                  }
                />
                <span>
                  <span className="text-sm font-medium text-foreground">
                    {t("nav.superadminShiftConfirmation")}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted">
                    {t("nav.superadminShiftConfirmationHint")}
                  </span>
                </span>
              </label>

              {shiftConfirmationEnabled ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 hover:bg-primary/5">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={simulatedProposedOnAssign}
                    disabled={dbResetPending}
                    onChange={(event) =>
                      setSimulatedProposedOnAssign(event.target.checked)
                    }
                  />
                  <span>
                    <span className="text-sm font-medium text-foreground">
                      {t("nav.superadminShiftConfirmationProposedOnAssign")}
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-muted">
                      {t("nav.superadminShiftConfirmationProposedOnAssignHint")}
                    </span>
                  </span>
                </label>
              ) : null}
            </section>
          </div>

          <div className={settingsModalFooterClass()}>
            <Button type="button" variant="outline" disabled={dbResetPending} onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        </div>

        {planningModeOpen ? (
          <OrganizationPlanningModeModal
            nested
            onClose={() => setPlanningModeOpen(false)}
          />
        ) : null}

        {dbResetConfirmOpen ? (
          <div
            className={settingsNestedModalOverlayClass()}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !dbResetPending) {
                setDbResetConfirmOpen(false);
              }
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="superadmin-db-reset-title"
              className={settingsConfirmDialogClass()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <h3
                id="superadmin-db-reset-title"
                className="text-base font-semibold text-foreground"
              >
                {t("nav.dbResetConfirmTitle")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {t("nav.dbResetConfirmBody")}
              </p>
              <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={dbResetPending}
                  onClick={() => setDbResetConfirmOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={dbResetPending}
                  onClick={handleDbResetConfirm}
                >
                  {dbResetPending ? t("nav.dbResetPending") : t("nav.dbReset")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
