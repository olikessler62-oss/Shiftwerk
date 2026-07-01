"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  seedSuperadminBiergartenHadrianScenario,
  seedSuperadminFriseurSalonZentraleScenario,
  seedSuperadminPflegedienstZentraleScenario,
  type SuperadminTestScenarioSeedSettings,
  type SuperadminTestScenarioShiftCoverageMode,
  type SuperadminTestScenarioShiftsPerDayMode,
} from "@/app/actions/superadmin-test-scenarios";
import { Alert, Button, Input, LabelMuted, TimeInput } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";
import {
  createDefaultSuperadminTestScenarioSeedSettings,
  resolvedShiftsForSettings,
  shiftCountForMode,
  shiftsForModeChange,
  type TestScenarioShiftDefinition,
} from "@/lib/superadmin-test-scenarios/superadmin-test-scenario-settings";

type Props = {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

type ScenarioId = "biergarten-hadrian" | "friseur-salon-zentrale" | "pflegedienst-zentrale";

const SHIFT_COVERAGE_MODES: SuperadminTestScenarioShiftCoverageMode[] = [
  "open",
  "covered",
  "mixed",
];

const SHIFTS_PER_DAY_MODES: SuperadminTestScenarioShiftsPerDayMode[] = [
  "one",
  "two",
  "three",
];

const SCENARIO_TABS: {
  id: ScenarioId;
  tabLabelKey:
    | "nav.superadminTestScenarioTabBiergarten"
    | "nav.superadminTestScenarioTabFriseur"
    | "nav.superadminTestScenarioTabPflege";
  titleKey:
    | "nav.superadminTestScenarioBiergartenHadrianTitle"
    | "nav.superadminTestScenarioFriseurSalonZentraleTitle"
    | "nav.superadminTestScenarioPflegedienstZentraleTitle";
  descriptionKey?: "nav.superadminTestScenarioBiergartenHadrianDescription";
  successKey:
    | "nav.superadminTestScenarioBiergartenHadrianSuccess"
    | "nav.superadminTestScenarioFriseurSalonZentraleSuccess"
    | "nav.superadminTestScenarioPflegedienstZentraleSuccess";
}[] = [
  {
    id: "biergarten-hadrian",
    tabLabelKey: "nav.superadminTestScenarioTabBiergarten",
    titleKey: "nav.superadminTestScenarioBiergartenHadrianTitle",
    descriptionKey: "nav.superadminTestScenarioBiergartenHadrianDescription",
    successKey: "nav.superadminTestScenarioBiergartenHadrianSuccess",
  },
  {
    id: "friseur-salon-zentrale",
    tabLabelKey: "nav.superadminTestScenarioTabFriseur",
    titleKey: "nav.superadminTestScenarioFriseurSalonZentraleTitle",
    successKey: "nav.superadminTestScenarioFriseurSalonZentraleSuccess",
  },
  {
    id: "pflegedienst-zentrale",
    tabLabelKey: "nav.superadminTestScenarioTabPflege",
    titleKey: "nav.superadminTestScenarioPflegedienstZentraleTitle",
    successKey: "nav.superadminTestScenarioPflegedienstZentraleSuccess",
  },
];

function shiftsPerDayLabelKey(
  mode: SuperadminTestScenarioShiftsPerDayMode
):
  | "nav.superadminTestScenarioShiftsPerDayOne"
  | "nav.superadminTestScenarioShiftsPerDayTwo"
  | "nav.superadminTestScenarioShiftsPerDayThree" {
  if (mode === "one") return "nav.superadminTestScenarioShiftsPerDayOne";
  if (mode === "two") return "nav.superadminTestScenarioShiftsPerDayTwo";
  return "nav.superadminTestScenarioShiftsPerDayThree";
}

function updateShift(
  shifts: TestScenarioShiftDefinition[],
  index: number,
  field: keyof TestScenarioShiftDefinition,
  value: string
): TestScenarioShiftDefinition[] {
  return shifts.map((shift, shiftIndex) =>
    shiftIndex === index ? { ...shift, [field]: value } : shift
  );
}

function SuperadminTestScenarioShiftRow({
  index,
  shift,
  disabled,
  onChange,
}: {
  index: number;
  shift: TestScenarioShiftDefinition;
  disabled: boolean;
  onChange: (field: keyof TestScenarioShiftDefinition, value: string) => void;
}) {
  const t = useTranslations();

  return (
    <div className="space-y-2 rounded-md border border-border/50 bg-background/60 px-3 py-2.5">
      <p className="text-xs font-medium text-muted">
        {t("nav.superadminTestScenarioShiftLabel", { index: String(index + 1) })}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_8rem_8rem] sm:items-end">
        <div className="min-w-0">
          <LabelMuted className="text-[11px]">{t("shiftTypes.designation")}</LabelMuted>
          <Input
            className="mt-0.5"
            value={shift.name}
            disabled={disabled}
            onChange={(event) => onChange("name", event.target.value)}
          />
        </div>
        <div className="min-w-0">
          <LabelMuted className="text-[11px]">{t("shiftTypes.timeFrom")}</LabelMuted>
          <TimeInput
            className="mt-0.5"
            value={shift.start}
            disabled={disabled}
            onChange={(event) => onChange("start", event.target.value)}
          />
        </div>
        <div className="min-w-0">
          <LabelMuted className="text-[11px]">{t("shiftTypes.timeTo")}</LabelMuted>
          <TimeInput
            className="mt-0.5"
            value={shift.end}
            disabled={disabled}
            onChange={(event) => onChange("end", event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function SuperadminTestScenarioSettingsPanel({
  disabled,
  settings,
  onSettingsChange,
}: {
  disabled: boolean;
  settings: SuperadminTestScenarioSeedSettings;
  onSettingsChange: (settings: SuperadminTestScenarioSeedSettings) => void;
}) {
  const t = useTranslations();
  const resolvedShifts = resolvedShiftsForSettings(settings);

  return (
    <div
      className={cn(
        "space-y-4 border border-border/70 bg-background/40 px-4 py-3",
        DASHBOARD_PANEL_ROUNDED_CLASS
      )}
    >
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-xs font-medium text-muted">
          {t("nav.superadminTestScenarioShiftsPerDayLabel")}
        </legend>
        <div className="space-y-2">
          {SHIFTS_PER_DAY_MODES.map((mode) => {
            const selected = settings.shiftsPerDayMode === mode;
            const shiftCount = shiftCountForMode(mode);
            return (
              <div
                key={mode}
                className={cn(
                  "rounded-lg border px-3 py-2.5 transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background",
                  disabled && "opacity-60"
                )}
              >
                <label
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2",
                    disabled && "cursor-not-allowed"
                  )}
                >
                  <input
                    type="radio"
                    name="superadmin-test-scenario-shifts-per-day"
                    value={mode}
                    checked={selected}
                    disabled={disabled}
                    onChange={() =>
                      onSettingsChange({
                        ...settings,
                        shiftsPerDayMode: mode,
                        shifts: shiftsForModeChange(settings.shifts, mode),
                      })
                    }
                    className="size-4 shrink-0"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {t(shiftsPerDayLabelKey(mode))}
                  </span>
                </label>
                {selected ? (
                  <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                    {Array.from({ length: shiftCount }, (_, index) => (
                      <SuperadminTestScenarioShiftRow
                        key={index}
                        index={index}
                        shift={resolvedShifts[index]!}
                        disabled={disabled}
                        onChange={(field, value) =>
                          onSettingsChange({
                            ...settings,
                            shifts: updateShift(settings.shifts, index, field, value),
                          })
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-xs font-medium text-muted">
          {t("nav.superadminTestScenarioShiftModeLabel")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {SHIFT_COVERAGE_MODES.map((mode) => {
            const selected = settings.shiftCoverageMode === mode;
            return (
              <label
                key={mode}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:bg-subtle/60",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                <input
                  type="radio"
                  name="superadmin-test-scenario-shift-coverage"
                  value={mode}
                  checked={selected}
                  disabled={disabled}
                  onChange={() =>
                    onSettingsChange({ ...settings, shiftCoverageMode: mode })
                  }
                  className="size-4 shrink-0"
                />
                <span className="text-sm text-foreground">
                  {t(
                    `nav.superadminTestScenarioShiftMode${
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
  );
}

export function SuperadminTestScenariosSection({
  disabled = false,
  onBusyChange,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingScenario, setPendingScenario] = useState<string | null>(null);
  const [activeScenarioTab, setActiveScenarioTab] = useState<ScenarioId>(
    "biergarten-hadrian"
  );
  const [scenarioSettings, setScenarioSettings] =
    useState<SuperadminTestScenarioSeedSettings>(
      createDefaultSuperadminTestScenarioSeedSettings
    );
  const [, startTransition] = useTransition();

  useEffect(() => {
    onBusyChange?.(pendingScenario !== null);
    return () => onBusyChange?.(false);
  }, [onBusyChange, pendingScenario]);

  const settingsDisabled = disabled || pendingScenario !== null;
  const activeScenario =
    SCENARIO_TABS.find((scenario) => scenario.id === activeScenarioTab) ??
    SCENARIO_TABS[0]!;

  function runScenario(
    scenarioId: string,
    action: () => Promise<
      | {
          ok: true;
          weekStart: string;
          locationCount: number;
          areaCount: number;
          shiftCount: number;
          openSlots: number;
          coveredSlots: number;
        }
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
  const scenarioPending = pendingScenario === activeScenario.id;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        {t("nav.superadminTestScenariosHint")}
      </p>

      {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}

      <SuperadminTestScenarioSettingsPanel
        disabled={settingsDisabled}
        settings={scenarioSettings}
        onSettingsChange={setScenarioSettings}
      />

      <div
        className="flex flex-wrap gap-1 border-b border-border"
        role="tablist"
        aria-label={t("nav.superadminTabTestScenarios")}
      >
        {SCENARIO_TABS.map((scenario) => {
          const selected = activeScenarioTab === scenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={settingsDisabled}
              onClick={() => setActiveScenarioTab(scenario.id)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:border-border hover:text-foreground"
              )}
            >
              {t(scenario.tabLabelKey)}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "space-y-3 border border-border/70 bg-background/40 px-4 py-3",
          DASHBOARD_PANEL_ROUNDED_CLASS
        )}
        role="tabpanel"
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {t(activeScenario.titleKey)}
          </p>
          {activeScenario.descriptionKey ? (
            <p className="text-xs leading-relaxed text-muted">
              {t(activeScenario.descriptionKey)}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={disabled || scenarioPending}
          onClick={() => {
            if (activeScenario.id === "biergarten-hadrian") {
              runScenario(
                activeScenario.id,
                () => seedSuperadminBiergartenHadrianScenario(scenarioSettings),
                activeScenario.successKey
              );
              return;
            }
            if (activeScenario.id === "friseur-salon-zentrale") {
              runScenario(
                activeScenario.id,
                () =>
                  seedSuperadminFriseurSalonZentraleScenario(scenarioSettings),
                activeScenario.successKey
              );
              return;
            }
            runScenario(
              activeScenario.id,
              () => seedSuperadminPflegedienstZentraleScenario(scenarioSettings),
              activeScenario.successKey
            );
          }}
        >
          {scenarioPending ? pendingLabel : runLabel}
        </Button>
      </div>
    </div>
  );
}
