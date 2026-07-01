"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateOrganizationName,
  updateOrganizationShiftConfirmationPendingAfterMinutes,
  updateOrganizationShowCompensationInPlanningUi,
} from "@/app/actions/organization";
import { Alert, Checkbox, Input, LabelMuted, Select } from "@/components/ui";
import { SettingsSidePanel, SettingsSidePanelCloseButton } from "@/components/settings/settings-side-panel";
import {
  settingsModalFooterClass,
} from "@/components/settings/settings-list-ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  useOrganization,
  useShiftConfirmationPendingAfterMinutes,
} from "@/lib/org-features-provider";
import {
  formatShiftConfirmationPendingAfterDuration,
  SHIFT_CONFIRMATION_PENDING_AFTER_DURATION_OPTIONS_MINUTES,
} from "@schichtwerk/database";

type Props = {
  onClose: () => void;
};

const checkboxCardClass =
  "flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 hover:bg-primary/5";

const fieldCardClass = "rounded-lg border border-border px-3 py-3";

export function GeneralSettingsModal({ onClose }: Props) {
  const organization = useOrganization();
  const pendingAfterMinutes = useShiftConfirmationPendingAfterMinutes();
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState(organization.name);
  const [pendingAfterValue, setPendingAfterValue] = useState(
    String(pendingAfterMinutes)
  );
  const [showCompensation, setShowCompensation] = useState(
    organization.show_compensation_in_planning_ui
  );

  useEffect(() => {
    setOrganizationName(organization.name);
  }, [organization.name]);

  useEffect(() => {
    setPendingAfterValue(String(pendingAfterMinutes));
  }, [pendingAfterMinutes]);

  useEffect(() => {
    setShowCompensation(organization.show_compensation_in_planning_ui);
  }, [organization.show_compensation_in_planning_ui]);

  function persistCompensation(next: boolean) {
    setShowCompensation(next);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await updateOrganizationShowCompensationInPlanningUi(next);
      if (!result.ok) {
        setShowCompensation(organization.show_compensation_in_planning_ui);
        setErrorMessage(t(result.errorKey));
        return;
      }
      router.refresh();
    });
  }

  function persistOrganizationName() {
    const trimmed = organizationName.trim();
    if (!trimmed || trimmed === organization.name) return;

    setErrorMessage(null);
    startTransition(async () => {
      const result = await updateOrganizationName(trimmed);
      if (!result.ok) {
        setOrganizationName(organization.name);
        setErrorMessage(t(result.errorKey));
        return;
      }
      router.refresh();
    });
  }

  function persistPendingAfterMinutes(nextMinutes: number) {
    if (nextMinutes === pendingAfterMinutes) return;

    setPendingAfterValue(String(nextMinutes));
    setErrorMessage(null);
    startTransition(async () => {
      const result =
        await updateOrganizationShiftConfirmationPendingAfterMinutes(
          nextMinutes
        );
      if (!result.ok) {
        setPendingAfterValue(String(pendingAfterMinutes));
        setErrorMessage(t(result.errorKey));
        return;
      }
      router.refresh();
    });
  }

  return (
    <SettingsSidePanel
      title={t("settings.generalTitle")}
      titleId="general-settings-modal-title"
      onClose={onClose}
      closeDisabled={pending}
      closeAriaLabel={t("common.close")}
      footer={
        <div
          className={settingsModalFooterClass(
            "border-t-0 pt-4 sm:justify-end sm:pt-5"
          )}
        >
          <SettingsSidePanelCloseButton disabled={pending} />
        </div>
      }
    >
      <div className="space-y-4">
        {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}

        <div className={cn(fieldCardClass, pending && "pointer-events-none opacity-60")}>
          <LabelMuted>{t("settings.organizationNameLabel")}</LabelMuted>
          <Input
            value={organizationName}
            disabled={pending}
            onChange={(event) => setOrganizationName(event.target.value)}
            onBlur={persistOrganizationName}
            className="mt-2"
            maxLength={30}
          />
          <p className="mt-2 text-sm leading-snug text-muted">
            {t("settings.organizationNameHint")}
          </p>
        </div>

        <div className={cn(fieldCardClass, pending && "pointer-events-none opacity-60")}>
          <LabelMuted>{t("settings.shiftConfirmationPendingAfterLabel")}</LabelMuted>
          <Select
            value={pendingAfterValue}
            disabled={pending}
            onChange={(event) => {
              const minutes = Number(event.target.value);
              if (!Number.isFinite(minutes)) return;
              persistPendingAfterMinutes(minutes);
            }}
            className="mt-2 !w-[5.5rem]"
          >
            {SHIFT_CONFIRMATION_PENDING_AFTER_DURATION_OPTIONS_MINUTES.map(
              (minutes) => (
                <option key={minutes} value={minutes}>
                  {formatShiftConfirmationPendingAfterDuration(minutes)}
                </option>
              )
            )}
          </Select>
          <p className="mt-2 text-sm leading-snug text-muted">
            {t("settings.shiftConfirmationPendingAfterHint")}
          </p>
        </div>

        <label className={cn(checkboxCardClass, pending && "pointer-events-none opacity-60")}>
          <Checkbox
            checked={showCompensation}
            disabled={pending}
            onChange={(event) => persistCompensation(event.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              {t("settings.showCompensationInPlanningLabel")}
            </span>
            <span className="mt-1 block text-sm leading-snug text-muted">
              {t("settings.showCompensationInPlanningHint")}
            </span>
          </span>
        </label>
      </div>
    </SettingsSidePanel>
  );
}
