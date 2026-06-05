"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createProfileRecurringAvailability,
  updateProfileRecurringAvailability,
} from "@/app/actions/profile-availability";
import { formatActiveWeekdaysLabel } from "@schichtwerk/database";
import type {
  ProfileRecurringAvailability,
  ShiftTypeWithBreaks,
} from "@schichtwerk/types";
import { formatTimeRange } from "@/lib/planning-utils";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { SETTINGS_MODAL_TITLE_CLASS } from "./settings-list-ui";
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
  shiftTypes: ShiftTypeWithBreaks[];
  onClose: () => void;
  onSaved: (
    availability: ProfileRecurringAvailability[],
    selectedId: string
  ) => void;
};

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
  shiftTypes,
  onClose,
  onSaved,
}: Props) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>(() =>
    currentAvailability?.shift_type_id ? "shift_type" : "times"
  );
  const [weekday, setWeekday] = useState(currentAvailability?.weekday ?? 0);
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

  function handleSubmit() {
    setError(null);
    if (inputMode === "shift_type" && !shiftTypeId) {
      setError(t("profiles.selectShiftTypeRequired"));
      return;
    }

    startTransition(async () => {
      const payload = {
        profileId,
        weekday,
        start_time: startTime,
        end_time: endTime,
        shift_type_id: inputMode === "shift_type" ? shiftTypeId : null,
      };

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
      const selectedId =
        mode === "edit" && currentAvailability
          ? currentAvailability.id
          : list.find(
              (item) =>
                item.weekday === weekday &&
                item.start_time.slice(0, 5) === startTime &&
                item.end_time.slice(0, 5) === endTime
            )?.id ?? list[0]?.id ?? "";
      onSaved(list, selectedId);
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
        aria-labelledby="profile-availability-form-title"
        className="relative z-[71] flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
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
            disabled={pending}
            aria-label={t("common.close")}
            className="border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <LabelMuted>{t("profiles.columnWeekday")}</LabelMuted>
            <Select
              className="mt-1"
              value={String(weekday)}
              disabled={pending}
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
              disabled={pending}
              onClick={() => setInputMode("times")}
            >
              {t("profiles.availabilityInputTimes")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={inputMode === "shift_type" ? "primary" : "outline"}
              disabled={pending || shiftTypes.length === 0}
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
                disabled={pending || shiftTypes.length === 0}
                onChange={(e) => setShiftTypeId(e.target.value)}
              >
                {shiftTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({formatTimeRange(st.start_time, st.end_time)})
                  </option>
                ))}
              </Select>
              {selectedShiftType ? (
                <p className="mt-1 text-xs text-muted">
                  {formatTimeRange(
                    selectedShiftType.start_time,
                    selectedShiftType.end_time
                  )}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <LabelMuted>{t("profiles.availabilityFrom")}</LabelMuted>
                <TimeInput
                  className="mt-1"
                  value={startTime}
                  disabled={pending}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <LabelMuted>{t("profiles.availabilityTo")}</LabelMuted>
                <TimeInput
                  className="mt-1"
                  value={endTime}
                  disabled={pending}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}
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
