"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upgradeOrganizationPlanningMode } from "@/app/actions/organization";
import type { PlanningMode } from "@schichtwerk/types";
import { normalizePlanningMode } from "@schichtwerk/database";
import { Alert, Button, CloseIcon, IconButton } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useOrganization } from "@/lib/org-features-provider";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsConfirmDialogClass,
  settingsModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalOverlayClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
} from "./settings-list-ui";

type Props = {
  onClose: () => void;
  nested?: boolean;
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

export function OrganizationPlanningModeModal({ onClose, nested = false }: Props) {
  const organization = useOrganization();
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const currentMode = normalizePlanningMode(organization.planning_mode);
  const isSimple = currentMode === "simple";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || pending) return;
      if (confirmUpgrade) {
        setConfirmUpgrade(false);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmUpgrade, onClose, pending]);

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
      setSuccessMessage(t("organization.planningModeUpgradeSuccess"));
      router.refresh();
    });
  }

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="org-planning-mode-title"
      className={cn(
        nested ? settingsSubModalDialogClass("lg") : cn(settingsModalDialogClass(), "max-w-lg")
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          settingsModalHeaderPaddingClass(),
          "flex items-start justify-between gap-3 border-b border-border"
        )}
      >
        <h2 id="org-planning-mode-title" className={SETTINGS_MODAL_TITLE_CLASS}>
          {t("organization.planningModeTitle")}
        </h2>
        {!nested ? (
          <IconButton
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
            disabled={pending}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </div>

      <div className={cn(settingsModalBodyPaddingClass(), "space-y-4")}>
        {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
        {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}

        <div>
          <p className="text-xs font-medium text-muted">
            {t("organization.planningModeCurrent")}
          </p>
          <div className="mt-2 rounded-lg border border-primary bg-primary/5 px-3 py-2.5">
            <p className="text-sm font-medium text-foreground">
              {planningModeLabel(currentMode, t)}
            </p>
            <p className="mt-1 text-xs leading-snug text-muted">
              {planningModeHint(currentMode, t)}
            </p>
          </div>
        </div>

        {isSimple ? (
          <>
            <p className="text-sm leading-relaxed text-muted">
              {t("organization.planningModeUpgradeIntro")}
            </p>
            <Button
              type="button"
              onClick={() => setConfirmUpgrade(true)}
              disabled={pending || Boolean(successMessage)}
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

      {nested ? (
        <div className={settingsModalFooterClass()}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {t("common.close")}
          </Button>
        </div>
      ) : null}
    </div>
  );

  const confirmUpgradeDialog = confirmUpgrade ? (
    <div
      className={settingsNestedModalOverlayClass()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) setConfirmUpgrade(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="org-planning-mode-confirm-title"
        className={settingsConfirmDialogClass()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3
          id="org-planning-mode-confirm-title"
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
  ) : null;

  if (nested) {
    return (
      <>
        <div
          className={settingsSubModalOverlayClass()}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !pending && !confirmUpgrade) onClose();
          }}
        >
          {dialog}
        </div>
        {confirmUpgradeDialog}
      </>
    );
  }

  return (
    <div
      className={settingsModalBackdropClass()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending && !confirmUpgrade) onClose();
      }}
    >
      {dialog}
      {confirmUpgradeDialog}
    </div>
  );
}
