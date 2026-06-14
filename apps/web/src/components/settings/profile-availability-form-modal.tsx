"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createProfileRecurringAvailability,
  updateProfileRecurringAvailability,
} from "@/app/actions/profile-availability";
import { parseAvailabilityTimeRange } from "@schichtwerk/database";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";
import {
  findBulkEditEntryForWeekday,
  weekdaysWithListedAvailability,
} from "@/lib/profile-availability-bulk";
import {
  formatOvernightAvailabilitySpan,
  weekdayLabel,
} from "@/lib/profile-availability-label";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { SERVICE_HOUR_WEEKDAY_COUNT } from "@/lib/location-service-hour-entries";
import { WeekdayChipPicker } from "./weekday-chip-picker";
import { cn } from "@/lib/cn";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsConfirmDialogClass,
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

type FormMode = "create" | "edit" | "bulk-edit";

type Props = {
  mode: FormMode;
  profileId: string;
  currentAvailability?: ProfileRecurringAvailability;
  existingAvailability?: ProfileRecurringAvailability[];
  onClose: () => void;
  onSaved: (
    availability: ProfileRecurringAvailability[],
    selectedId: string,
    scrollToSelection?: boolean
  ) => void;
};

type ParsedAvailabilityTimeRange = Extract<
  ReturnType<typeof parseAvailabilityTimeRange>,
  { ok: true }
>;

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
  const [overnightConfirmOpen, setOvernightConfirmOpen] = useState(false);

  const referenceEntry = useMemo(() => {
    if (mode !== "bulk-edit" || !currentAvailability) return null;
    return (
      existingAvailability.find((entry) => entry.id === currentAvailability.id) ??
      currentAvailability
    );
  }, [currentAvailability, existingAvailability, mode]);

  const referenceWindow = useMemo(
    () =>
      referenceEntry
        ? {
            start: referenceEntry.start_time.slice(0, 5),
            end: referenceEntry.end_time.slice(0, 5),
          }
        : null,
    [referenceEntry]
  );

  const listedWeekdays = useMemo(
    () => new Set(weekdaysWithListedAvailability(existingAvailability)),
    [existingAvailability]
  );

  const [weekday, setWeekday] = useState(
    () => currentAvailability?.weekday ?? 0
  );
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(() => {
    if (mode === "bulk-edit") {
      const listed = weekdaysWithListedAvailability(existingAvailability);
      if (listed.length > 0) {
        return new Set(listed);
      }
      return new Set(referenceEntry ? [referenceEntry.weekday] : []);
    }
    if (mode === "create") {
      return new Set([0, 1, 2, 3, 4]);
    }
    return new Set([currentAvailability?.weekday ?? 0]);
  });
  const [startTime, setStartTime] = useState(
    () => referenceEntry?.start_time.slice(0, 5) ?? currentAvailability?.start_time.slice(0, 5) ?? "08:00"
  );
  const [endTime, setEndTime] = useState(
    () => referenceEntry?.end_time.slice(0, 5) ?? currentAvailability?.end_time.slice(0, 5) ?? "17:00"
  );

  const usesMultiDayPicker = mode === "create" || mode === "bulk-edit";

  useEffect(() => {
    if (!saving) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previous;
    };
  }, [saving]);

  function parseCurrentTimeRange():
    | ParsedAvailabilityTimeRange
    | { ok: false; error: string } {
    return parseAvailabilityTimeRange({
      start_time: startTime,
      end_time: endTime,
    });
  }

  async function performSave(timeCheck: ParsedAvailabilityTimeRange) {
    const savedStart = timeCheck.start_time.slice(0, 5);
    const savedEnd = timeCheck.end_time.slice(0, 5);

    setSaving(true);
    try {
      if (mode === "edit" && currentAvailability) {
        const result = await updateProfileRecurringAvailability({
          profileId,
          availabilityId: currentAvailability.id,
          weekday,
          start_time: savedStart,
          end_time: savedEnd,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const list = result.availability ?? [];
        onSaved(list, currentAvailability.id);
        onClose();
        return;
      }

      const weekdaysToSave = usesMultiDayPicker
        ? [...selectedWeekdays]
            .filter((day) =>
              mode === "bulk-edit" ? listedWeekdays.has(day) : true
            )
            .sort((a, b) => a - b)
        : [weekday];

      if (weekdaysToSave.length === 0) {
        setError(t("profiles.availabilitySelectWeekdays"));
        return;
      }

      let latestList = existingAvailability;
      let lastSelectedId = "";
      let bulkEditUpdatedCount = 0;

      for (const saveWeekday of weekdaysToSave) {
        if (mode === "bulk-edit") {
          const existing = findBulkEditEntryForWeekday(
            saveWeekday,
            latestList,
            referenceWindow ?? undefined,
            referenceEntry?.id
          );
          if (!existing) {
            continue;
          }
          const result = await updateProfileRecurringAvailability({
            profileId,
            availabilityId: existing.id,
            weekday: saveWeekday,
            start_time: savedStart,
            end_time: savedEnd,
          });
          if (!result.ok) {
            setError(
              weekdaysToSave.length > 1
                ? `${weekdayLabel(saveWeekday, localeKey, "long")}: ${result.error}`
                : result.error
            );
            return;
          }
          latestList = result.availability ?? latestList;
          lastSelectedId =
            latestList.find(
              (item) =>
                item.weekday === saveWeekday &&
                item.start_time.slice(0, 5) === savedStart &&
                item.end_time.slice(0, 5) === savedEnd
            )?.id ?? existing.id;
          bulkEditUpdatedCount += 1;
          continue;
        }

        const result = await createProfileRecurringAvailability({
          profileId,
          weekday: saveWeekday,
          start_time: savedStart,
          end_time: savedEnd,
        });
        if (!result.ok) {
          setError(
            weekdaysToSave.length > 1
              ? `${weekdayLabel(saveWeekday, localeKey, "long")}: ${result.error}`
              : result.error
          );
          return;
        }
        latestList = result.availability ?? latestList;
        lastSelectedId =
          latestList.find(
            (item) =>
              item.weekday === saveWeekday &&
              item.start_time.slice(0, 5) === savedStart &&
              item.end_time.slice(0, 5) === savedEnd
          )?.id ??
          lastSelectedId ??
          latestList[0]?.id ??
          "";
      }

      if (mode === "bulk-edit") {
        if (bulkEditUpdatedCount === 0) {
          setError(t("profiles.availabilityBulkEditNoMatchingDays"));
          return;
        }
        onSaved(latestList, lastSelectedId, false);
        onClose();
        return;
      }

      onSaved(latestList, lastSelectedId, mode === "create");
      onClose();
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setOvernightConfirmOpen(false);

    const timeCheck = parseCurrentTimeRange();
    if (!timeCheck.ok) {
      setError(timeCheck.error);
      return;
    }

    if (timeCheck.overnight) {
      setOvernightConfirmOpen(true);
      return;
    }

    await performSave(timeCheck);
  }

  async function confirmOvernightSave() {
    setOvernightConfirmOpen(false);
    const timeCheck = parseCurrentTimeRange();
    if (!timeCheck.ok) {
      setError(timeCheck.error);
      return;
    }
    await performSave(timeCheck);
  }

  const overnightConfirmRange =
    overnightConfirmOpen &&
    (() => {
      const timeCheck = parseCurrentTimeRange();
      if (!timeCheck.ok || !timeCheck.overnight) return null;
      const confirmWeekday = usesMultiDayPicker
        ? [...selectedWeekdays].sort((a, b) => a - b)[0] ?? 0
        : weekday;
      return formatOvernightAvailabilitySpan(
        confirmWeekday,
        timeCheck.start_time,
        timeCheck.end_time,
        localeKey
      );
    })();

  const title =
    mode === "create"
      ? t("profiles.availabilityCreateTitle")
      : mode === "bulk-edit"
        ? t("profiles.availabilityBulkEditTitle")
        : t("profiles.availabilityEditTitle");

  return (
    <>
      <div
        className={cn(settingsNestedModalOverlayClass(), saving && "cursor-wait")}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving && !overnightConfirmOpen) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-availability-form-title"
          aria-busy={saving}
          className={cn(
            settingsNestedModalDialogClass("md"),
            saving && "[&_*]:cursor-wait"
          )}
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
              {title}
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
              <LabelMuted className="mb-1 block text-center sm:text-left">
                {t("profiles.columnWeekday")}
              </LabelMuted>
              {usesMultiDayPicker ? (
                <WeekdayChipPicker
                  weekdayCount={SERVICE_HOUR_WEEKDAY_COUNT}
                  selected={selectedWeekdays}
                  disabled={saving}
                  selectableWeekdays={
                    mode === "bulk-edit" ? listedWeekdays : undefined
                  }
                  onToggle={(nextWeekday) => {
                    setSelectedWeekdays((prev) => {
                      const next = new Set(prev);
                      if (next.has(nextWeekday)) next.delete(nextWeekday);
                      else next.add(nextWeekday);
                      return next;
                    });
                    setError(null);
                  }}
                  onApplyPreset={(weekdays) => {
                    setSelectedWeekdays(
                      new Set(
                        weekdays.filter((day) =>
                          mode === "bulk-edit" ? listedWeekdays.has(day) : true
                        )
                      )
                    );
                    setError(null);
                  }}
                />
              ) : (
                <Select
                  className="mt-1"
                  value={String(weekday)}
                  disabled={saving}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                >
                  {Array.from({ length: SERVICE_HOUR_WEEKDAY_COUNT }, (_, i) => (
                    <option key={i} value={i}>
                      {weekdayLabel(i, localeKey, "long")}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <LabelMuted>{t("profiles.availabilityFrom")}</LabelMuted>
                <TimeInput
                  className="mt-1"
                  value={startTime}
                  disabled={saving}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setError(null);
                  }}
                />
              </div>
              <div>
                <LabelMuted>{t("profiles.availabilityTo")}</LabelMuted>
                <TimeInput
                  className="mt-1"
                  value={endTime}
                  disabled={saving}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setError(null);
                  }}
                />
              </div>
            </div>
          </div>

          <div className={settingsModalFooterClass()}>
            {saving ? (
              <p className="text-xs text-muted sm:mr-auto">{t("common.saving")}</p>
            ) : null}
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

      {overnightConfirmOpen && overnightConfirmRange ? (
        <div
          className={settingsNestedModalOverlayClass()}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setOvernightConfirmOpen(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="profile-availability-overnight-desc"
            className={settingsConfirmDialogClass()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p
              id="profile-availability-overnight-desc"
              className="text-sm leading-relaxed text-foreground"
            >
              {t("profiles.availabilityOvernightConfirm", {
                range: overnightConfirmRange,
              })}
            </p>
            <div className={settingsModalFooterClass("mt-5 border-0 px-0 pb-0 pt-0")}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOvernightConfirmOpen(false)}
                disabled={saving}
              >
                <CloseIcon />
                {t("common.no")}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void confirmOvernightSave()}
                disabled={saving}
              >
                <CheckIcon />
                {t("common.yes")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
