"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { seedSuperadminBiergartenHadrianScenario } from "@/app/actions/superadmin-test-scenarios";
import { Alert, Button } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";

type Props = {
  disabled?: boolean;
};

export function SuperadminTestScenariosSection({ disabled = false }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runBiergartenHadrianScenario() {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const result = await seedSuperadminBiergartenHadrianScenario();
      if (!result.ok) {
        setErrorMessage(
          result.error
            ? `${t(result.errorKey)} ${result.error}`
            : t(result.errorKey)
        );
        return;
      }
      setSuccessMessage(
        t("nav.superadminTestScenarioBiergartenHadrianSuccess", {
          weekStart: result.weekStart,
          locationCount: result.locationCount,
          areaCount: result.areaCount,
          shiftCount: result.shiftCount,
          openSlots: result.openSlots,
          coveredSlots: result.coveredSlots,
        })
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        {t("nav.superadminTestScenariosHint")}
      </p>

      {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}

      <ul className="space-y-3">
        <li
          className={cn(
            "border border-border/70 bg-background/40 px-4 py-3",
            DASHBOARD_PANEL_ROUNDED_CLASS
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("nav.superadminTestScenarioBiergartenHadrianTitle")}
              </p>
              <p className="text-sm leading-relaxed text-muted">
                {t("nav.superadminTestScenarioBiergartenHadrianDescription")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={disabled || pending}
              onClick={runBiergartenHadrianScenario}
            >
              {pending
                ? t("nav.superadminTestScenarioPending")
                : t("nav.superadminTestScenarioRun")}
            </Button>
          </div>
        </li>
      </ul>
    </div>
  );
}
