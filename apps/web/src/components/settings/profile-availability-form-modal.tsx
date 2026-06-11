"use client";

import { useMemo, useState } from "react";
import {
  createProfileRecurringAvailability,
  updateProfileRecurringAvailability,
} from "@/app/actions/profile-availability";
import { parseAvailabilityTimeRange } from "@schichtwerk/database";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";
import { weekdayLabel } from "@/lib/profile-availability-label";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalDialogClass,
  settingsNestedModalOverlayClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  LabelMuted,
  Select,
  TimeInput,
} from "@/components/ui";

type Props = {
  mode: "create" | "edit";
  profileId: string;
  currentAvailability?: ProfileRecurringAvailability;
  /** Bestehende Verfügbarkeiten — für Tag-Vorschlag beim Anlegen */
  existingAvailability?: ProfileRecurringAvailability[];
  onClose: () => void;
  onSaved: (
    availability: ProfileRecurringAvailability[],
    selectedId: string,
    scrollToSelection?: boolean
  ) => void;
};

function firstUnassignedWeekday(
  existing: readonly ProfileRecurringAvailability[]
): number {
  const assigned = new Set(existing.map((item) => item.weekday));
  for (let weekday = 0; weekday < 7; weekday++) {
    if (!assigned.has(weekday)) return weekday;
  }
  return 0;
}

export function ProfileAvailabilityFormModal({
  mode,
  profileId,
  currentAvailability,
  existingAvailability = [],
  onClose,
  onSaved,
}: Props) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekday, setWeekday] = useState(() =>
    mode === "create"
      ? firstUnassignedWeekday(existingAvailability)
      : (currentAvailability?.weekday ?? 0)
  );
  const [startTime, setStartTime] = useState(
    () => currentAvailability?.start_time.slice(0, 5) ?? "08:00"
  );
  const [endTime, setEndTime] = useState(
    () => currentAvailability?.end_time.slice(0, 5) ?? "17:00"
  );

  const overnightPreview = useMemo(() => {
    const check = parseAvailabilityTimeRange({
      start_time: startTime,
      end_time: endTime,
    });
    return check.ok && check.overnight;
  }, [endTime, startTime]);

  async function handleSubmit() {
    setError(null);

    const timeCheck = parseAvailabilityTimeRange({
      start_time: startTime,
      end_time: endTime,
    });
    if (!timeCheck.ok) {
      setError(timeCheck.error);
      return;
    }

    const payload = {
      profileId,
      weekday,
      start_time: timeCheck.start_time.slice(0, 5),
      end_time: timeCheck.end_time.slice(0, 5),
    };

    setSaving(true);
    try {
      const result =
        mode === "create"
          ? await createProfileRecurringAvailability(payload)
          : await updateProfileRecurringAvailability({
              ...payload,
              availabilityId: currentAvailability!.id,
            });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const list = result.availability ?? [];
      const savedStart = timeCheck.start_time.slice(0, 5);
      const savedEnd = timeCheck.end_time.slice(0, 5);
      const selectedId =
        mode === "edit" && currentAvailability
          ? currentAvailability.id
          : list.find(
              (item) =>
                item.weekday === weekday &&
                item.start_time.slice(0, 5) === savedStart &&
                item.end_time.slice(0, 5) === savedEnd
            )?.id ?? list[0]?.id ?? "";
      onSaved(list, selectedId, mode === "create");
      onClose();
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={settingsNestedModalOverlayClass()}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-availability-form-title"
        className={settingsNestedModalDialogClass("md")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <h3
            id="profile-availability-form-title"
            className={SETTINGS_MODAL_TITLE_CLASS}
          >
            {mode === "create"
              ? t("profiles.availabilityCreateTitle")
              : t("profiles.availabilityEditTitle")}
          </h3>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={saving}
            aria-label={t("common.close")}
            className="border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div className={cn("space-y-4", settingsModalBodyPaddingClass())}>
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <LabelMuted>{t("profiles.columnWeekday")}</LabelMuted>
            <Select
              className="mt-1"
              value={String(weekday)}
              disabled={saving}
              onChange={(e) => setWeekday(Number(e.target.value))}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i} value={i}>
                  {weekdayLabel(i, localeKey, "long")}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <LabelMuted>{t("profiles.availabilityFrom")}</LabelMuted>
              <TimeInput
                className="mt-1"
                value={startTime}
                disabled={saving}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <LabelMuted>{t("profiles.availabilityTo")}</LabelMuted>
              <TimeInput
                className="mt-1"
                value={endTime}
                disabled={saving}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {overnightPreview ? (
            <p className="text-xs text-primary">
              {t("profiles.availabilityOvernightHint")}
            </p>
          ) : null}
        </div>

        <div className={settingsModalFooterClass()}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={saving}
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
