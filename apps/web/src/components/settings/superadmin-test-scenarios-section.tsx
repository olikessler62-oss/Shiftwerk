"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  seedSuperadminBiergartenHadrianScenario,
  seedSuperadminFriseurSalonZentraleScenario,
  seedSuperadminPflegedienstZentraleScenario,
  type BiergartenHadrianShiftCoverageMode,
} from "@/app/actions/superadmin-test-scenarios";
import { Alert, Button } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";

type Props = {
  disabled?: boolean;
};

type ScenarioRunner = () => void;

const BIERGARTEN_SHIFT_COVERAGE_MODES: BiergartenHadrianShiftCoverageMode[] = [
  "open",
  "covered",
  "mixed",
];

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

function BiergartenHadrianScenarioCard({
  disabled,
  pending,
  shiftCoverageMode,
  onShiftCoverageModeChange,
  onRun,
  runLabel,
  pendingLabel,
}: {
  disabled: boolean;
  pending: boolean;
  shiftCoverageMode: BiergartenHadrianShiftCoverageMode;
  onShiftCoverageModeChange: (mode: BiergartenHadrianShiftCoverageMode) => void;
  onRun: ScenarioRunner;
  runLabel: string;
  pendingLabel: string;
}) {
  const t = useTranslations();

  return (
    <li
      className={cn(
        "border border-border/70 bg-background/40 px-4 py-3",
        DASHBOARD_PANEL_ROUNDED_CLASS
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <p className="text-sm font-semibold text-foreground">
            {t("nav.superadminTestScenarioBiergartenHadrianTitle")}
          </p>
          <p className="text-xs leading-relaxed text-muted">
            {t("nav.superadminTestScenarioBiergartenHadrianDescription")}
          </p>
          <fieldset className="space-y-2" disabled={disabled || pending}>
            <legend className="text-xs font-medium text-muted">
              {t("nav.superadminTestScenarioBiergartenHadrianShiftModeLabel")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {BIERGARTEN_SHIFT_COVERAGE_MODES.map((mode) => {
                const selected = shiftCoverageMode === mode;
                return (
                  <label
                    key={mode}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-subtle/60",
                      (disabled || pending) && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <input
                      type="radio"
                      name="biergarten-shift-coverage-mode"
                      value={mode}
                      checked={selected}
                      disabled={disabled || pending}
                      onChange={() => onShiftCoverageModeChange(mode)}
                      className="size-4 shrink-0"
                    />
                    <span className="text-sm text-foreground">
                      {t(
                        `nav.superadminTestScenarioBiergartenHadrianShiftMode${
                          mode === "open"
                            ? "Open"
                            : mode === "covered"
                              ? "Covered"
                              : "Mixed"
                        }`
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 self-start"
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
  const [biergartenShiftCoverageMode, setBiergartenShiftCoverageMode] =
    useState<BiergartenHadrianShiftCoverageMode>("mixed");
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
        <BiergartenHadrianScenarioCard
          disabled={disabled}
          pending={pendingScenario === "biergarten-hadrian"}
          shiftCoverageMode={biergartenShiftCoverageMode}
          onShiftCoverageModeChange={setBiergartenShiftCoverageMode}
          onRun={() =>
            runScenario(
              "biergarten-hadrian",
              () =>
                seedSuperadminBiergartenHadrianScenario(biergartenShiftCoverageMode),
              "nav.superadminTestScenarioBiergartenHadrianSuccess"
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
