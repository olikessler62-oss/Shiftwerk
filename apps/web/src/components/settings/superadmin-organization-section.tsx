"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateOrganizationAllowRetroactiveCompensationEntries,
  updateOrganizationShiftConfirmationDisclaimer,
  updateOrganizationShiftConfirmationEnabled,
  upgradeOrganizationPlanningMode,
} from "@/app/actions/organization";
import type { PlanningMode } from "@schichtwerk/types";
import { normalizePlanningMode } from "@schichtwerk/database";
import { Alert, Button, CloseIcon, Textarea } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useOrganization } from "@/lib/org-features-provider";
import { useSimpleCalendarDisplay } from "@/lib/simple-calendar-display-context";
import { useShiftConfirmationSimulation } from "@/lib/shift-confirmation-simulation-context";
import {
  settingsConfirmDialogClass,
  settingsModalFooterClass,
  settingsNestedModalOverlayClass,
} from "./settings-list-ui";

type Props = {
  disabled?: boolean;
  onSaveStateChange?: (state: {
    hasChanges: boolean;
    pending: boolean;
    save: () => void;
  }) => void;
};

function planningModeLabel(mode: PlanningMode, t: (key: string) => string): string {
  const normalized = normalizePlanningMode(mode);
  return t(
    `locations.planningMode${normalized === "simple" ? "Simple" : "Advanced"}`
  );
}

function planningModeHint(mode: PlanningMode, t: (key: string) => string): string {
  const normalized = normalizePlanningMode(mode);
  return t(
    `locations.planningMode${normalized === "simple" ? "Simple" : "Advanced"}Hint`
  );
}

const checkboxCardClass =
  "flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 hover:bg-primary/5";

export function SuperadminOrganizationSection({ disabled = false, onSaveStateChange }: Props) {
  const organization = useOrganization();
  const router = useRouter();
  const t = useTranslations();
  const { simpleCalendarFirstShiftOnly, setSimpleCalendarFirstShiftOnly } =
    useSimpleCalendarDisplay();
  const {
    shiftConfirmationEnabled: shiftConfirmationSimulationEnabled,
    setShiftConfirmationEnabled: setShiftConfirmationSimulationEnabled,
    simulatedProposedOnAssign,
    setSimulatedProposedOnAssign,
    relaxAppRegistrationGate,
    setRelaxAppRegistrationGate,
  } = useShiftConfirmationSimulation();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [planningSuccessMessage, setPlanningSuccessMessage] = useState<string | null>(null);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [allowed, setAllowed] = useState(
    organization.allow_retroactive_compensation_entries
  );
  const [shiftConfirmationEnabled, setShiftConfirmationEnabled] = useState(
    organization.shift_confirmation_enabled
  );
  const [shiftConfirmationDisclaimer, setShiftConfirmationDisclaimer] = useState(
    organization.shift_confirmation_disclaimer ?? ""
  );

  const currentMode = normalizePlanningMode(organization.planning_mode);
  const isSimple = currentMode === "simple";
  const controlsDisabled = disabled || pending;

  useEffect(() => {
    setAllowed(organization.allow_retroactive_compensation_entries);
    setShiftConfirmationEnabled(organization.shift_confirmation_enabled);
    setShiftConfirmationDisclaimer(organization.shift_confirmation_disclaimer ?? "");
  }, [
    organization.allow_retroactive_compensation_entries,
    organization.shift_confirmation_enabled,
    organization.shift_confirmation_disclaimer,
  ]);

  const normalizedDisclaimer = shiftConfirmationDisclaimer.trim();
  const savedDisclaimer = organization.shift_confirmation_disclaimer?.trim() ?? "";

  const hasChanges =
    allowed !== organization.allow_retroactive_compensation_entries ||
    shiftConfirmationEnabled !== organization.shift_confirmation_enabled ||
    normalizedDisclaimer !== savedDisclaimer;

  const handleSave = useCallback(() => {
    setErrorMessage(null);
    startTransition(async () => {
      const retroResult = await updateOrganizationAllowRetroactiveCompensationEntries(
        allowed
      );
      if (!retroResult.ok) {
        setErrorMessage(t(retroResult.errorKey));
        return;
      }

      const confirmResult = await updateOrganizationShiftConfirmationEnabled(
        shiftConfirmationEnabled
      );
      if (!confirmResult.ok) {
        setErrorMessage(t(confirmResult.errorKey));
        return;
      }

      const disclaimerResult = await updateOrganizationShiftConfirmationDisclaimer(
        shiftConfirmationDisclaimer
      );
      if (!disclaimerResult.ok) {
        setErrorMessage(t(disclaimerResult.errorKey));
        return;
      }

      router.refresh();
    });
  }, [allowed, router, shiftConfirmationDisclaimer, shiftConfirmationEnabled, t]);

  function handleUpgrade() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await upgradeOrganizationPlanningMode();
      if (!result.ok) {
        setErrorMessage(t(result.errorKey));
        setConfirmUpgrade(false);
        return;
      }
      setConfirmUpgrade(false);
      setPlanningSuccessMessage(t("organization.planningModeUpgradeSuccess"));
      router.refresh();
    });
  }

  useEffect(() => {
    onSaveStateChange?.({ hasChanges, pending, save: handleSave });
  }, [handleSave, hasChanges, onSaveStateChange, pending]);

  useEffect(() => {
    if (!confirmUpgrade) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        setConfirmUpgrade(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmUpgrade, pending]);

  return (
    <>
      {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
      {planningSuccessMessage ? (
        <Alert variant="success">{planningSuccessMessage}</Alert>
      ) : null}

      <p className="text-xs leading-snug text-muted">{t("nav.superadminOrganizationHint")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={cn(checkboxCardClass, controlsDisabled && "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={allowed}
            disabled={controlsDisabled}
            onChange={(event) => setAllowed(event.target.checked)}
          />
          <span>
            <span className="text-sm font-medium text-foreground">
              {t("organization.allowRetroactiveCompensationLabel")}
            </span>
            <span className="mt-1 block text-xs leading-snug text-muted">
              {t("organization.allowRetroactiveCompensationHint")}
            </span>
          </span>
        </label>

        <label className={cn(checkboxCardClass, controlsDisabled && "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={shiftConfirmationEnabled}
            disabled={controlsDisabled}
            onChange={(event) => setShiftConfirmationEnabled(event.target.checked)}
          />
          <span>
            <span className="text-sm font-medium text-foreground">
              {t("organization.shiftConfirmationEnabledLabel")}
            </span>
            <span className="mt-1 block text-xs leading-snug text-muted">
              {t("organization.shiftConfirmationEnabledHint")}
            </span>
          </span>
        </label>

        <label className={cn(checkboxCardClass, controlsDisabled && "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={simpleCalendarFirstShiftOnly}
            disabled={controlsDisabled}
            onChange={(event) => setSimpleCalendarFirstShiftOnly(event.target.checked)}
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

        <label className={cn(checkboxCardClass, controlsDisabled && "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={shiftConfirmationSimulationEnabled}
            disabled={controlsDisabled}
            onChange={(event) =>
              setShiftConfirmationSimulationEnabled(event.target.checked)
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

        {shiftConfirmationSimulationEnabled ? (
          <label
            className={cn(
              checkboxCardClass,
              "sm:col-span-2",
              controlsDisabled && "cursor-not-allowed opacity-60"
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={simulatedProposedOnAssign}
              disabled={controlsDisabled}
              onChange={(event) => setSimulatedProposedOnAssign(event.target.checked)}
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

        <label className={cn(checkboxCardClass, controlsDisabled && "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={relaxAppRegistrationGate}
            disabled={controlsDisabled}
            onChange={(event) => setRelaxAppRegistrationGate(event.target.checked)}
          />
          <span>
            <span className="text-sm font-medium text-foreground">
              {t("nav.superadminRelaxAppRegistrationGate")}
            </span>
            <span className="mt-1 block text-xs leading-snug text-muted">
              {t("nav.superadminRelaxAppRegistrationGateHint")}
            </span>
          </span>
        </label>
      </div>

      {shiftConfirmationEnabled ? (
        <div className="space-y-1.5">
          <label
            htmlFor="superadmin-shift-confirmation-disclaimer"
            className="block text-sm font-medium text-foreground"
          >
            {t("organization.shiftConfirmationDisclaimerLabel")}
          </label>
          <Textarea
            id="superadmin-shift-confirmation-disclaimer"
            value={shiftConfirmationDisclaimer}
            onChange={(event) => setShiftConfirmationDisclaimer(event.target.value)}
            disabled={controlsDisabled}
            rows={3}
            placeholder={t("shiftConfirmation.disclaimer.default")}
          />
          <p className="text-xs leading-snug text-muted">
            {t("organization.shiftConfirmationDisclaimerHint")}
          </p>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t("organization.planningModeTitle")}
        </p>

        <div className="rounded-lg border border-primary bg-primary/5 px-3 py-2.5">
          <p className="text-xs font-medium text-muted">
            {t("organization.planningModeCurrent")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {planningModeLabel(currentMode, t)}
          </p>
          <p className="mt-1 text-xs leading-snug text-muted">
            {planningModeHint(currentMode, t)}
          </p>
        </div>

        {isSimple ? (
          <>
            <p className="text-sm leading-relaxed text-muted">
              {t("organization.planningModeUpgradeIntro")}
            </p>
            <Button
              type="button"
              onClick={() => setConfirmUpgrade(true)}
              disabled={controlsDisabled || Boolean(planningSuccessMessage)}
            >
              {t("organization.planningModeUpgradeAction")}
            </Button>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            {t("organization.planningModeDowngradeHint")}
          </p>
        )}
      </div>

      <p className="text-xs leading-snug text-muted">
        {t("organization.compensationPlanningDisclaimer")}
      </p>

      {confirmUpgrade ? (
        <div
          className={settingsNestedModalOverlayClass()}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setConfirmUpgrade(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="superadmin-planning-mode-confirm-title"
            className={settingsConfirmDialogClass()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3
              id="superadmin-planning-mode-confirm-title"
              className="text-base font-semibold text-foreground"
            >
              {t("organization.planningModeUpgradeConfirmTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {t("organization.planningModeUpgradeConfirmBody")}
            </p>
            <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmUpgrade(false)}
                disabled={pending}
              >
                <CloseIcon />
                {t("common.cancel")}
              </Button>
              <Button type="button" onClick={handleUpgrade} disabled={pending}>
                {t("organization.planningModeUpgradeAction")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
