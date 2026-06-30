"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrganizationShowCompensationInPlanningUi } from "@/app/actions/organization";
import { Alert, Checkbox } from "@/components/ui";
import { SettingsSidePanel, SettingsSidePanelCloseButton } from "@/components/settings/settings-side-panel";
import {
  settingsModalFooterClass,
} from "@/components/settings/settings-list-ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { useOrganization } from "@/lib/org-features-provider";

type Props = {
  onClose: () => void;
};

const checkboxCardClass =
  "flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 hover:bg-primary/5";

export function GeneralSettingsModal({ onClose }: Props) {
  const organization = useOrganization();
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCompensation, setShowCompensation] = useState(
    organization.show_compensation_in_planning_ui
  );

  useEffect(() => {
    setShowCompensation(organization.show_compensation_in_planning_ui);
  }, [organization.show_compensation_in_planning_ui]);

  function persist(next: boolean) {
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

        <label className={cn(checkboxCardClass, pending && "pointer-events-none opacity-60")}>
          <Checkbox
            checked={showCompensation}
            disabled={pending}
            onChange={(event) => persist(event.target.checked)}
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
