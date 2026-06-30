"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  seedSuperadminBiergartenHadrianCurrentWeekCoveredScenario,
  seedSuperadminBiergartenHadrianScenario,
  seedSuperadminFriseurSalonZentraleScenario,
  seedSuperadminPflegedienstZentraleScenario,
} from "@/app/actions/superadmin-test-scenarios";
import { Alert, Button } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";

type Props = {
  disabled?: boolean;
};

type ScenarioRunner = () => void;

function ScenarioCard({
  title,
  disabled,
  pending,
  onRun,
  runLabel,
  pendingLabel,
}: {
  title: string;
  disabled: boolean;
  pending: boolean;
  onRun: ScenarioRunner;
  runLabel: string;
  pendingLabel: string;
}) {
  return (
    <li
      className={cn(
        "border border-border/70 bg-background/40 px-4 py-2.5",
        DASHBOARD_PANEL_ROUNDED_CLASS
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold text-foreground">{title}</p>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={disabled || pending}
          onClick={onRun}
        >
          {pending ? pendingLabel : runLabel}
        </Button>
      </div>
    </li>
  );
}

export function SuperadminTestScenariosSection({ disabled = false }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingScenario, setPendingScenario] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function runScenario(
    scenarioId: string,
    action: () => Promise<
      | { ok: true; weekStart: string; locationCount: number; areaCount: number; shiftCount: number; openSlots: number; coveredSlots: number }
      | { ok: false; errorKey: string; error?: string }
    >,
    successKey: string
  ) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingScenario(scenarioId);
    startTransition(async () => {
      const result = await action();
      setPendingScenario(null);
      if (!result.ok) {
        setErrorMessage(
          result.error
            ? `${t(result.errorKey)} ${result.error}`
            : t(result.errorKey)
        );
        return;
      }
      setSuccessMessage(
        t(successKey, {
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

  const runLabel = t("nav.superadminTestScenarioRun");
  const pendingLabel = t("nav.superadminTestScenarioPending");

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        {t("nav.superadminTestScenariosHint")}
      </p>

      {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}

      <ul className="space-y-2">
        <ScenarioCard
          title={t("nav.superadminTestScenarioBiergartenHadrianTitle")}
          disabled={disabled}
          pending={pendingScenario === "biergarten-hadrian"}
          onRun={() =>
            runScenario(
              "biergarten-hadrian",
              seedSuperadminBiergartenHadrianScenario,
              "nav.superadminTestScenarioBiergartenHadrianSuccess"
            )
          }
          runLabel={runLabel}
          pendingLabel={pendingLabel}
        />
        <ScenarioCard
          title={t("nav.superadminTestScenarioBiergartenHadrianCurrentWeekTitle")}
          disabled={disabled}
          pending={pendingScenario === "biergarten-hadrian-current-week"}
          onRun={() =>
            runScenario(
              "biergarten-hadrian-current-week",
              seedSuperadminBiergartenHadrianCurrentWeekCoveredScenario,
              "nav.superadminTestScenarioBiergartenHadrianCurrentWeekSuccess"
            )
          }
          runLabel={runLabel}
          pendingLabel={pendingLabel}
        />
        <ScenarioCard
          title={t("nav.superadminTestScenarioFriseurSalonZentraleTitle")}
          disabled={disabled}
          pending={pendingScenario === "friseur-salon-zentrale"}
          onRun={() =>
            runScenario(
              "friseur-salon-zentrale",
              seedSuperadminFriseurSalonZentraleScenario,
              "nav.superadminTestScenarioFriseurSalonZentraleSuccess"
            )
          }
          runLabel={runLabel}
          pendingLabel={pendingLabel}
        />
        <ScenarioCard
          title={t("nav.superadminTestScenarioPflegedienstZentraleTitle")}
          disabled={disabled}
          pending={pendingScenario === "pflegedienst-zentrale"}
          onRun={() =>
            runScenario(
              "pflegedienst-zentrale",
              seedSuperadminPflegedienstZentraleScenario,
              "nav.superadminTestScenarioPflegedienstZentraleSuccess"
            )
          }
          runLabel={runLabel}
          pendingLabel={pendingLabel}
        />
      </ul>
    </div>
  );
}
