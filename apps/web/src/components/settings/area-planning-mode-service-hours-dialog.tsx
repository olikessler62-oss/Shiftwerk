"use client";

import type { AreaPlanningMode } from "@schichtwerk/types";
import type { SuggestedServiceHourSlot } from "@schichtwerk/database";
import { areaPlanningModeLabel } from "./area-planning-mode-field";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalDialogClass,
  settingsNestedModalOverlayClass,
} from "./settings-list-ui";
import { formatTimeRange } from "@/lib/planning-utils";
import { STAFFING_HOLIDAY_WEEKDAY } from "@/lib/location-staffing-client";
import { Button, CloseIcon, CheckIcon } from "@/components/ui";

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "holiday",
] as const;

function formatWeekdayLabels(
  weekdays: number[],
  t: (key: string) => string
): string {
  const unique = [...new Set(weekdays)].sort((a, b) => a - b);
  return unique
    .map((weekday) => {
      const key =
        weekday === STAFFING_HOLIDAY_WEEKDAY
          ? "holiday"
          : WEEKDAY_KEYS[weekday];
      return key ? t(`locations.weekdays.${key}`) : String(weekday);
    })
    .join(", ");
}

type Props = {
  previousMode: AreaPlanningMode;
  newMode: AreaPlanningMode;
  suggestedRows: SuggestedServiceHourSlot[];
  hasExistingServiceHours: boolean;
  pending?: boolean;
  onCancel: () => void;
  onApply: () => void;
  onManual: () => void;
};

export function AreaPlanningModeServiceHoursDialog({
  previousMode,
  newMode,
  suggestedRows,
  hasExistingServiceHours,
  pending = false,
  onCancel,
  onApply,
  onManual,
}: Props) {
  const t = useTranslations();

  const uniqueSlots = Array.from(
    new Map(
      suggestedRows.map((row) => [
        `${row.start_time}|${row.end_time}`,
        { start_time: row.start_time, end_time: row.end_time },
      ])
    ).values()
  );
  const weekdays = suggestedRows.map((row) => row.weekday);

  return (
    <div
      className={cn(settingsNestedModalOverlayClass(), "z-[80] bg-black/35")}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="planning-mode-switch-title"
        className={cn(settingsNestedModalDialogClass("lg"), "z-[81]")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={cn("border-b border-border", settingsModalHeaderPaddingClass())}>
          <h3
            id="planning-mode-switch-title"
            className="text-base font-semibold text-foreground"
          >
            {t("locations.planningModeSwitchTitle")}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {areaPlanningModeLabel(previousMode, t)} →{" "}
            {areaPlanningModeLabel(newMode, t)}
          </p>
        </div>

        <div className={cn("space-y-4", settingsModalBodyPaddingClass())}>
          <p className="text-sm text-foreground">
            {t("locations.planningModeSwitchApplyServiceHours")}
          </p>
          <p className="text-xs text-muted">
            {t("locations.planningModeSwitchHint")}
          </p>

          <ul className="space-y-1 rounded-lg border border-border bg-subtle/40 px-3 py-2.5 text-sm text-foreground">
            {uniqueSlots.map((slot) => (
              <li key={`${slot.start_time}-${slot.end_time}`}>
                {formatTimeRange(slot.start_time, slot.end_time)}
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted">
            {t("locations.planningModeSwitchPreviewDays", {
              days: formatWeekdayLabels(weekdays, t),
            })}
          </p>

          {hasExistingServiceHours && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {t("locations.planningModeSwitchOverwriteWarning")}
            </p>
          )}
        </div>

        <div className={settingsModalFooterClass("flex-wrap sm:flex-nowrap")}>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="outline" onClick={onManual} disabled={pending}>
            {t("locations.planningModeSwitchManual")}
          </Button>
          <Button type="button" variant="primary" onClick={onApply} disabled={pending}>
            <CheckIcon />
            {t("locations.planningModeSwitchApply")}
          </Button>
        </div>
      </div>
    </div>
  );
}
