"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createProfileRecurringAvailability,
  updateProfileRecurringAvailability,
} from "@/app/actions/profile-availability";
import {
  formatActiveWeekdaysLabel,
  parseAvailabilityTimeRange,
} from "@schichtwerk/database";
import type {
  ProfileRecurringAvailability,
  ShiftTypeWithBreaks,
} from "@schichtwerk/types";
import { formatAvailabilityTimeRange } from "@/lib/profile-availability-label";
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

type InputMode = "times" | "shift_type";

type Props = {
  mode: "create" | "edit";
  profileId: string;
  currentAvailability?: ProfileRecurringAvailability;
  /** Bestehende Verfügbarkeiten — für Tag-Vorschlag beim Anlegen */
  existingAvailability?: ProfileRecurringAvailability[];
  shiftTypes: ShiftTypeWithBreaks[];
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

function weekdayLabel(weekday: number, locale: "de" | "en"): string {
  const mask = Array.from({ length: 7 }, (_, i) => (i === weekday ? "1" : "0")).join(
    ""
  );
  return formatActiveWeekdaysLabel(mask, locale);
}

export function ProfileAvailabilityFormModal({
  mode,
  profileId,
  currentAvailability,
  existingAvailability = [],
  shiftTypes,
  onClose,
  onSaved,
}: Props) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>(() =>
    currentAvailability?.shift_type_id ? "shift_type" : "times"
  );
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
  const [shiftTypeId, setShiftTypeId] = useState(
    () =>
      currentAvailability?.shift_type_id ?? shiftTypes[0]?.id ?? ""
  );

  const selectedShiftType = useMemo(
    () => shiftTypes.find((st) => st.id === shiftTypeId) ?? null,
    [shiftTypeId, shiftTypes]
  );

  useEffect(() => {
    if (inputMode !== "shift_type" || !selectedShiftType) return;
    setStartTime(selectedShiftType.start_time.slice(0, 5));
    setEndTime(selectedShiftType.end_time.slice(0, 5));
  }, [inputMode, selectedShiftType]);

  const previewTimes = useMemo(() => {
    if (inputMode === "shift_type" && selectedShiftType) {
      return {
        start_time: selectedShiftType.start_time,
        end_time: selectedShiftType.end_time,
      };
    }
    return { start_time: startTime, end_time: endTime };
  }, [endTime, inputMode, selectedShiftType, startTime]);

  const overnightPreview = useMemo(() => {
    const check = parseAvailabilityTimeRange(previewTimes);
    return check.ok && check.overnight;
  }, [previewTimes]);

  async function handleSubmit() {
    setError(null);
    if (inputMode === "shift_type" && !shiftTypeId) {
      setError(t("profiles.selectShiftTypeRequired"));
      return;
    }

    const effectiveTimes =
      inputMode === "shift_type" && selectedShiftType
        ? {
            start_time: selectedShiftType.start_time,
            end_time: selectedShiftType.end_time,
          }
        : { start_time: startTime, end_time: endTime };
    const timeCheck = parseAvailabilityTimeRange(effectiveTimes);
    if (!timeCheck.ok) {
      setError(timeCheck.error);
      return;
    }

    const payload = {
      profileId,
      weekday,
      start_time: timeCheck.start_time.slice(0, 5),
      end_time: timeCheck.end_time.slice(0, 5),
      shift_type_id: inputMode === "shift_type" ? shiftTypeId : null,
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
                  {weekdayLabel(i, localeKey)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={inputMode === "times" ? "primary" : "outline"}
              disabled={saving}
              onClick={() => setInputMode("times")}
            >
              {t("profiles.availabilityInputTimes")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={inputMode === "shift_type" ? "primary" : "outline"}
              disabled={saving || shiftTypes.length === 0}
              onClick={() => setInputMode("shift_type")}
            >
              {t("profiles.availabilityInputShiftType")}
            </Button>
          </div>

          {inputMode === "shift_type" ? (
            <div>
              <LabelMuted>{t("profiles.columnShiftType")}</LabelMuted>
              <Select
                className="mt-1"
                value={shiftTypeId}
                disabled={saving || shiftTypes.length === 0}
                onChange={(e) => setShiftTypeId(e.target.value)}
              >
                {shiftTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} (
                    {formatAvailabilityTimeRange(
                      st.start_time,
                      st.end_time,
                      localeKey
                    )}
                    )
                  </option>
                ))}
              </Select>
              {selectedShiftType ? (
                <p className="mt-1 text-xs text-muted">
                  {formatAvailabilityTimeRange(
                    selectedShiftType.start_time,
                    selectedShiftType.end_time,
                    localeKey
                  )}
                </p>
              ) : null}
            </div>
          ) : (
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
          )}
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
