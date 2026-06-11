"use client";

import {
  SERVICE_HOUR_WEEKDAY_COUNT,
  SERVICE_HOUR_WEEKDAY_PRESETS,
  weekdayChipLabel,
  weekdayChipTooltipLabel,
} from "@/lib/location-service-hour-entries";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";

const presetButtonClass =
  "rounded border border-border/80 bg-surface px-1.5 py-0 text-[10px] font-medium leading-5 text-muted transition-colors hover:bg-subtle hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  selected: Set<number>;
  disabled?: boolean;
  onToggle: (weekday: number) => void;
  onApplyPreset: (weekdays: number[]) => void;
};

export function WeekdayChipPicker({
  selected,
  disabled,
  onToggle,
  onApplyPreset,
}: Props) {
  const t = useTranslations();

  const presets: { key: string; label: string; days: readonly number[] }[] = [
    {
      key: "monFri",
      label: t("locations.serviceHoursPresetMonFri"),
      days: SERVICE_HOUR_WEEKDAY_PRESETS.monFri,
    },
    {
      key: "monSat",
      label: t("locations.serviceHoursPresetMonSat"),
      days: SERVICE_HOUR_WEEKDAY_PRESETS.monSat,
    },
    {
      key: "monSun",
      label: t("locations.serviceHoursPresetMonSun"),
      days: SERVICE_HOUR_WEEKDAY_PRESETS.monSun,
    },
    {
      key: "satSun",
      label: t("locations.serviceHoursPresetSatSun"),
      days: SERVICE_HOUR_WEEKDAY_PRESETS.satSun,
    },
    {
      key: "all",
      label: t("locations.serviceHoursPresetAll"),
      days: SERVICE_HOUR_WEEKDAY_PRESETS.all,
    },
    {
      key: "none",
      label: t("locations.serviceHoursPresetNone"),
      days: [],
    },
  ];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap justify-center gap-0.5">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            disabled={disabled}
            title={preset.label}
            onClick={() => onApplyPreset([...preset.days])}
            className={presetButtonClass}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {Array.from({ length: SERVICE_HOUR_WEEKDAY_COUNT }, (_, weekday) => {
          const active = selected.has(weekday);
          const tooltip = weekdayChipTooltipLabel(weekday, t);
          return (
            <button
              key={weekday}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              aria-label={tooltip}
              title={tooltip}
              onClick={() => onToggle(weekday)}
              className={cn(
                "min-w-[2rem] rounded-md border px-1.5 py-0.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-surface text-muted hover:bg-subtle",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {weekdayChipLabel(weekday, t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
