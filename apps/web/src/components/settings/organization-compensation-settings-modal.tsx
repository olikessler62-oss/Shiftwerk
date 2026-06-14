"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateOrganizationAllowRetroactiveCompensationEntries,
  updateOrganizationShiftConfirmationDisclaimer,
  updateOrganizationShiftConfirmationEnabled,
} from "@/app/actions/organization";
import { Alert, Button, CloseIcon, IconButton, Textarea } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useOrganization } from "@/lib/org-features-provider";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalHeaderPaddingClass,
} from "./settings-list-ui";

type Props = {
  onClose: () => void;
};

export function OrganizationCompensationSettingsModal({ onClose }: Props) {
  const organization = useOrganization();
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(
    organization.allow_retroactive_compensation_entries
  );
  const [shiftConfirmationEnabled, setShiftConfirmationEnabled] = useState(
    organization.shift_confirmation_enabled
  );
  const [shiftConfirmationDisclaimer, setShiftConfirmationDisclaimer] = useState(
    organization.shift_confirmation_disclaimer ?? ""
  );

  useEffect(() => {
    setAllowed(organization.allow_retroactive_compensation_entries);
    setShiftConfirmationEnabled(organization.shift_confirmation_enabled);
    setShiftConfirmationDisclaimer(organization.shift_confirmation_disclaimer ?? "");
  }, [
    organization.allow_retroactive_compensation_entries,
    organization.shift_confirmation_enabled,
    organization.shift_confirmation_disclaimer,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  function handleSave() {
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
      onClose();
    });
  }

  const normalizedDisclaimer = shiftConfirmationDisclaimer.trim();
  const savedDisclaimer = organization.shift_confirmation_disclaimer?.trim() ?? "";

  const hasChanges =
    allowed !== organization.allow_retroactive_compensation_entries ||
    shiftConfirmationEnabled !== organization.shift_confirmation_enabled ||
    normalizedDisclaimer !== savedDisclaimer;

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
        aria-labelledby="org-compensation-settings-title"
        className={cn(settingsModalDialogClass(), "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            settingsModalHeaderPaddingClass(),
            "flex items-start justify-between gap-3 border-b border-border"
          )}
        >
          <h2 id="org-compensation-settings-title" className={SETTINGS_MODAL_TITLE_CLASS}>
            {t("organization.compensationSettingsTitle")}
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

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={allowed}
              onChange={(e) => setAllowed(e.target.checked)}
              disabled={pending}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {t("organization.allowRetroactiveCompensationLabel")}
              </span>
              <span className="mt-1 block text-xs leading-snug text-muted">
                {t("organization.allowRetroactiveCompensationHint")}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={shiftConfirmationEnabled}
              onChange={(e) => setShiftConfirmationEnabled(e.target.checked)}
              disabled={pending}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {t("organization.shiftConfirmationEnabledLabel")}
              </span>
              <span className="mt-1 block text-xs leading-snug text-muted">
                {t("organization.shiftConfirmationEnabledHint")}
              </span>
            </span>
          </label>

          {shiftConfirmationEnabled ? (
            <div className="space-y-1.5">
              <label
                htmlFor="shift-confirmation-disclaimer"
                className="block text-sm font-medium text-foreground"
              >
                {t("organization.shiftConfirmationDisclaimerLabel")}
              </label>
              <Textarea
                id="shift-confirmation-disclaimer"
                value={shiftConfirmationDisclaimer}
                onChange={(e) => setShiftConfirmationDisclaimer(e.target.value)}
                disabled={pending}
                rows={4}
                placeholder={t("shiftConfirmation.disclaimer.default")}
              />
              <p className="text-xs leading-snug text-muted">
                {t("organization.shiftConfirmationDisclaimerHint")}
              </p>
            </div>
          ) : null}

          <p className="text-xs leading-snug text-muted">
            {t("organization.compensationPlanningDisclaimer")}
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              <CloseIcon />
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={pending || !hasChanges}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
