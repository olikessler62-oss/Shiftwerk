"use client";

import { useState, useTransition } from "react";
import { createLocation, updateLocation } from "@/app/actions/locations";
import {
  activeWeekdaysToBooleans,
  booleansToActiveWeekdays,
  validateLocationInput,
  validateLocationUniqueness,
} from "@schichtwerk/database";
import type { Location } from "@schichtwerk/types";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  Input,
  LabelMuted,
} from "@/components/ui";
import { cn } from "@/lib/cn";

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type Props = {
  mode: "create" | "edit";
  location?: Location;
  existingLocations: Location[];
  onClose: () => void;
  onSaved: () => void;
};

const DEFAULT_WEEKDAYS = "1111100";

export function LocationFormModal({
  mode,
  location,
  existingLocations,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(location?.name ?? "");
  const [weekdays, setWeekdays] = useState<boolean[]>(() =>
    activeWeekdaysToBooleans(location?.active_weekdays ?? DEFAULT_WEEKDAYS)
  );
  const [onHolidayOpen, setOnHolidayOpen] = useState(
    location?.on_holiday_open ?? false
  );

  function setWeekday(index: number, checked: boolean) {
    setWeekdays((prev) => {
      const next = [...prev];
      next[index] = checked;
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    const payload = {
      name: name.trim(),
      active_weekdays: booleansToActiveWeekdays(weekdays),
      on_holiday_open: onHolidayOpen,
    };

    const validated = validateLocationInput(payload);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    const unique = validateLocationUniqueness(existingLocations, {
      name: validated.data.name,
      excludeId: mode === "edit" ? location?.id : undefined,
    });
    if (!unique.ok) {
      setError(unique.error);
      return;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createLocation(validated.data)
          : await updateLocation({ id: location!.id, ...validated.data });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  }

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center rounded-2xl bg-black/30 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-form-title"
        className="relative z-[71] flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="location-form-title" className="text-lg font-semibold text-foreground">
            {mode === "create"
              ? t("locations.createTitle")
              : t("locations.editTitle")}
          </h3>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={pending}
            aria-label={t("common.close")}
            className="border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <LabelMuted>{t("locations.siteName")}</LabelMuted>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={25}
              placeholder={t("locations.siteNamePlaceholder")}
            />
          </div>

          <div className="flex gap-[50px]">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {WEEKDAY_KEYS.map((key, index) => (
                <label
                  key={key}
                  className="flex cursor-pointer select-none items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={weekdays[index] ?? false}
                    disabled={pending}
                    onChange={(e) => setWeekday(index, e.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                  {t(`locations.weekdays.${key}`)}
                </label>
              ))}
            </div>
            <label
              className={cn(
                "flex shrink-0 cursor-pointer select-none items-center gap-2 self-start text-sm text-foreground",
                locale === "en" ? "max-w-[140px]" : "max-w-[180px]"
              )}
            >
              <input
                type="checkbox"
                checked={onHolidayOpen}
                disabled={pending}
                onChange={(e) => setOnHolidayOpen(e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              />
              <span className="leading-snug">{t("locations.openOnHolidays")}</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={pending}>
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
