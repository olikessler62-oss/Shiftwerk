"use client";

import type { AreaPlanningMode } from "@schichtwerk/types";
import { normalizeAreaPlanningMode } from "@schichtwerk/database";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/i18n/locale-provider";

const MODES: AreaPlanningMode[] = ["simple", "advanced"];

type Props = {
  value: AreaPlanningMode;
  onChange: (value: AreaPlanningMode) => void;
  disabled?: boolean;
};

export function AreaPlanningModeField({ value, onChange, disabled = false }: Props) {
  const t = useTranslations();
  const current = normalizeAreaPlanningMode(value);

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-xs font-medium text-muted">
        {t("locations.planningModeLabel")}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODES.map((mode) => {
          const selected = current === mode;
          return (
            <label
              key={mode}
              className={cn(
                "flex cursor-pointer gap-2 rounded-lg border px-3 py-2.5 transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:bg-subtle/60",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="radio"
                name="area-planning-mode"
                value={mode}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(mode)}
                className="mt-0.5 size-4 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {t(`locations.planningMode${mode === "simple" ? "Simple" : "Advanced"}`)}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">
                  {t(
                    `locations.planningMode${mode === "simple" ? "Simple" : "Advanced"}Hint`
                  )}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function areaPlanningModeLabel(
  mode: AreaPlanningMode | undefined,
  t: (key: string) => string
): string {
  const normalized = normalizeAreaPlanningMode(mode);
  return t(
    `locations.planningMode${normalized === "simple" ? "Simple" : "Advanced"}`
  );
}
