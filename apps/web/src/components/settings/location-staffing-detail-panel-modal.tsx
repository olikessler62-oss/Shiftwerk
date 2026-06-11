"use client";

import { useEffect, useMemo, useState } from "react";
import { saveServiceHourStaffing } from "@/app/actions/location-staffing";
import { resolvePresetIdFromTimes } from "@/lib/dashboard-assignment-presets";
import { SERVICE_HOUR_WEEKDAY_COUNT } from "@/lib/location-service-hour-entries";
import {
  isShiftTemplateBlockedOnWeekday,
  suggestStaffingCreateWindow,
} from "@/lib/location-staffing-create-suggest";
import {
  formatServiceHourStaffingListLabel,
  weekdayLabelFromIndex,
} from "@/lib/location-staffing-client";
import type {
  AreaShiftTemplateWithBreaks,
  Location,
  LocationArea,
  LocationAreaServiceHour,
  LocationAreaStaffing,
  Qualification,
} from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { WeekdayChipPicker } from "./weekday-chip-picker";
import { SettingsMessageModal } from "./settings-message-modal";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsListRowDeleteButton,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalDialogClass,
  settingsNestedModalOverlayClass,
  settingsResponsiveWindowFieldsClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  Input,
  LabelMuted,
  Select,
  TimeInput,
} from "@/components/ui";

const STAFFING_FIELD_CLASS = "h-8 min-h-8 py-0 text-sm leading-8";
const STAFFING_TIME_INPUT_CLASS =
  "h-8 w-full min-w-[9.5rem] shrink-0 px-2 tabular-nums";

const staffingDesktopGridClass = (mode: "create" | "edit") =>
  mode === "edit"
    ? "hidden lg:grid lg:grid-cols-[minmax(7.5rem,auto)_minmax(0,15.5rem)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)] lg:items-end lg:gap-x-2 lg:gap-y-2"
    : "hidden lg:grid lg:grid-cols-[max-content_minmax(0,15.5rem)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)] lg:items-end lg:gap-x-2 lg:gap-y-2";

const staffingMobileFieldsClass = () =>
  settingsResponsiveWindowFieldsClass("lg:gap-y-2");

type QualRow = {
  key: string;
  qualification_id: string;
  count: string;
};

let rowKeyCounter = 0;
function nextRowKey() {
  rowKeyCounter += 1;
  return `staff-row-${rowKeyCounter}`;
}

function buildInitialRows(
  serviceHourId: string,
  staffing: LocationAreaStaffing[]
): QualRow[] {
  return staffing
    .filter((rule) => rule.service_hour_id === serviceHourId)
    .map((rule) => ({
      key: rule.id,
      qualification_id: rule.qualification_id,
      count: String(rule.required_count),
    }));
}

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

function initialWindowState(
  mode: "create" | "edit",
  serviceHours: LocationAreaServiceHour[],
  initialServiceHourId: string | undefined,
  shiftTemplates: readonly AreaShiftTemplateWithBreaks[],
  staffing: LocationAreaStaffing[]
) {
  if (mode === "edit" && initialServiceHourId) {
    const hour = serviceHours.find((entry) => entry.id === initialServiceHourId);
    if (hour) {
      const start_time = timeFieldValue(hour.start_time);
      const end_time = timeFieldValue(hour.end_time);
      return {
        weekday: hour.weekday,
        start_time,
        end_time,
        templateId:
          resolvePresetIdFromTimes(start_time, end_time, shiftTemplates) ?? "",
        dayFullyBooked: false,
      };
    }
  }

  const suggestion = suggestStaffingCreateWindow(
    serviceHours,
    staffing,
    shiftTemplates,
    { searchAllWeekdays: true }
  );
  return {
    weekday: suggestion.weekday,
    start_time: suggestion.start_time,
    end_time: suggestion.end_time,
    templateId: suggestion.templateId,
    dayFullyBooked: suggestion.dayFullyBooked,
  };
}

const COUNT_INPUT_CLASS =
  "h-8 !w-[3.25rem] shrink-0 px-0 text-center text-sm tabular-nums";

type Props = {
  mode: "create" | "edit";
  location: Location;
  area: LocationArea;
  serviceHours: LocationAreaServiceHour[];
  shiftTemplates: AreaShiftTemplateWithBreaks[];
  qualifications: Qualification[];
  staffing: LocationAreaStaffing[];
  initialServiceHourId?: string;
  onClose: () => void;
  onSaved: (
    createdServiceHourId?: string,
    staffing?: LocationAreaStaffing[],
    serviceHours?: LocationAreaServiceHour[]
  ) => void;
};

export function LocationStaffingDetailPanelModal({
  mode,
  location,
  area,
  serviceHours,
  shiftTemplates,
  qualifications,
  staffing,
  initialServiceHourId,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const initialWindow = useMemo(
    () =>
      initialWindowState(
        mode,
        serviceHours,
        initialServiceHourId,
        shiftTemplates,
        staffing
      ),
    [mode, serviceHours, initialServiceHourId, shiftTemplates, staffing]
  );

  const [weekday, setWeekday] = useState(initialWindow.weekday);
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(
    () => new Set([initialWindow.weekday])
  );
  const [templateId, setTemplateId] = useState(initialWindow.templateId);
  const [startTime, setStartTime] = useState(initialWindow.start_time);
  const [endTime, setEndTime] = useState(initialWindow.end_time);
  const [dayFullyBooked, setDayFullyBooked] = useState(
    initialWindow.dayFullyBooked
  );
  const [rows, setRows] = useState<QualRow[]>(() =>
    mode === "create"
      ? qualifications[0]
        ? [
            {
              key: nextRowKey(),
              qualification_id: qualifications[0].id,
              count: "1",
            },
          ]
        : []
      : buildInitialRows(initialServiceHourId ?? "", staffing)
  );

  const windowLabel = formatServiceHourStaffingListLabel(
    { weekday, start_time: startTime, end_time: endTime },
    (value) => weekdayLabelFromIndex(value, t),
    shiftTemplates
  );

  const title =
    mode === "create"
      ? t("locations.staffingCreateTitle")
      : t("locations.staffingDetailTitle", { window: windowLabel });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || saving) return;
      if (infoMessage) {
        setInfoMessage(null);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [infoMessage, onClose, saving]);

  function handleEditWeekdayChange(nextWeekday: number) {
    setWeekday(nextWeekday);
    setError(null);
  }

  function toggleWeekday(nextWeekday: number) {
    setSelectedWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(nextWeekday)) next.delete(nextWeekday);
      else next.add(nextWeekday);
      return next;
    });
    setDayFullyBooked(false);
    setError(null);
  }

  function applyWeekdayPreset(weekdays: number[]) {
    setSelectedWeekdays(new Set(weekdays));
    setDayFullyBooked(false);
    setError(null);
  }

  function handleTemplateChange(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    if (!nextTemplateId) return;
    const template = shiftTemplates.find((entry) => entry.id === nextTemplateId);
    if (!template) return;
    setStartTime(timeFieldValue(template.start_time));
    setEndTime(timeFieldValue(template.end_time));
    setDayFullyBooked(false);
    setError(null);
  }

  function handleStartTimeChange(value: string) {
    setStartTime(value);
    setDayFullyBooked(false);
    setTemplateId(
      resolvePresetIdFromTimes(value, endTime, shiftTemplates) ?? ""
    );
    setError(null);
  }

  function handleEndTimeChange(value: string) {
    setEndTime(value);
    setDayFullyBooked(false);
    setTemplateId(
      resolvePresetIdFromTimes(startTime, value, shiftTemplates) ?? ""
    );
    setError(null);
  }

  function addRow() {
    if (!qualifications.length) {
      setError(t("locations.staffingNoAreaQualificationTemplates"));
      return;
    }
    const usedIds = new Set(rows.map((row) => row.qualification_id));
    const defaultQual = qualifications.find((qual) => !usedIds.has(qual.id));
    if (!defaultQual) {
      setInfoMessage(t("locations.staffingAllQualificationsAssigned"));
      return;
    }
    setError(null);
    setRows((prev) => [
      ...prev,
      {
        key: nextRowKey(),
        qualification_id: defaultQual.id,
        count: "1",
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function setQualification(key: string, qualificationId: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, qualification_id: qualificationId } : row
      )
    );
  }

  function setCount(key: string, value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, count: digits } : row))
    );
  }

  async function handleSubmit() {
    setError(null);
    if (!qualifications.length) {
      setError(t("locations.staffingNoAreaQualificationTemplates"));
      return;
    }

    const rules: {
      qualification_id: string;
      required_count: number;
    }[] = [];
    const seenQualifications = new Set<string>();

    for (const row of rows) {
      const trimmed = row.count.trim();
      if (!trimmed) {
        setError(t("locations.staffingEnterCount"));
        return;
      }
      const count = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(count) || count < 1 || count > 99) {
        setError(t("locations.staffingInvalidCount"));
        return;
      }
      if (!row.qualification_id) {
        setError(t("locations.staffingSelectQualification"));
        return;
      }
      if (seenQualifications.has(row.qualification_id)) {
        setError(t("locations.staffingDuplicateQualification"));
        return;
      }
      seenQualifications.add(row.qualification_id);
      rules.push({
        qualification_id: row.qualification_id,
        required_count: count,
      });
    }

    if (mode === "create" && rules.length === 0) {
      setError(t("locations.staffingCreateRequiresRows"));
      return;
    }

    const weekdaysToSave =
      mode === "create"
        ? [...selectedWeekdays].sort((a, b) => a - b)
        : [weekday];

    if (mode === "create" && weekdaysToSave.length === 0) {
      setError(t("locations.staffingSelectWeekdays"));
      return;
    }

    setSaving(true);
    try {
      let lastServiceHourId: string | undefined;
      let nextServiceHours = serviceHours;
      let nextStaffing = staffing;

      for (const saveWeekday of weekdaysToSave) {
        const result = await saveServiceHourStaffing({
          locationId: location.id,
          locationAreaId: area.id,
          window: {
            weekday: saveWeekday,
            start_time: startTime,
            end_time: endTime,
          },
          previousServiceHourId:
            mode === "edit" ? initialServiceHourId : undefined,
          rules,
        });
        if (!result.ok) {
          setError(
            mode === "create" && weekdaysToSave.length > 1
              ? `${weekdayLabelFromIndex(saveWeekday, t)}: ${result.error}`
              : result.error
          );
          return;
        }
        lastServiceHourId = result.serviceHourId;
        nextServiceHours = result.serviceHours ?? nextServiceHours;
        nextStaffing = result.staffing ?? nextStaffing;
      }

      onSaved(lastServiceHourId, nextStaffing, nextServiceHours);
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  const usedIds = new Set(rows.map((row) => row.qualification_id));

  const templateSelect = (
    <Select
      className={cn(
        STAFFING_FIELD_CLASS,
        "w-full min-w-0",
        !templateId && "text-[silver]"
      )}
      value={templateId}
      disabled={saving || shiftTemplates.length === 0}
      aria-label={t("locations.serviceHoursColumnTemplate")}
      onChange={(event) => handleTemplateChange(event.target.value)}
    >
      <option value="">{t("locations.serviceHoursSelectTemplate")}</option>
      {shiftTemplates.map((template) => (
        <option
          key={template.id}
          value={template.id}
          disabled={
            mode === "create" &&
            [...selectedWeekdays].some((entry) =>
              isShiftTemplateBlockedOnWeekday(
                template,
                entry,
                serviceHours,
                staffing
              )
            )
          }
        >
          {template.name}
        </option>
      ))}
    </Select>
  );

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
        aria-labelledby="location-staffing-detail-title"
        className={settingsNestedModalDialogClass(
          "5xl",
          "max-w-[min(64rem,calc(100vw-1rem))]"
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-3 border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <div className="min-w-0">
            <h3 id="location-staffing-detail-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {title}
            </h3>
            <p className="mt-1 text-base font-semibold text-info-foreground">
              {t("locations.staffingFormFor", {
                location: location.name,
                area: area.name,
              })}
            </p>
          </div>
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={saving}
            aria-label={t("common.close")}
            className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto", settingsModalBodyPaddingClass())}>
          {error && <Alert variant="error" className="mb-3">{error}</Alert>}
          {mode === "create" && dayFullyBooked && (
            <Alert variant="info" className="mb-3">
              {t("locations.staffingCreateDayFullyBooked")}
            </Alert>
          )}

          <div className={cn(staffingDesktopGridClass(mode), "mb-[20px]")}>
            <div className="flex justify-center">
              <LabelMuted className="mb-0 block text-center">
                {t("locations.serviceHoursColumnWeekdays")}
              </LabelMuted>
            </div>
            <div className="min-w-0">
              <LabelMuted className="mb-0 block">
                {t("locations.serviceHoursColumnTemplate")}
              </LabelMuted>
            </div>
            <div className="text-center">
              <LabelMuted className="mb-0 block text-center">
                {t("locations.serviceHoursColumnFrom")}
              </LabelMuted>
            </div>
            <div className="text-center">
              <LabelMuted className="mb-0 block text-center">
                {t("locations.serviceHoursColumnTo")}
              </LabelMuted>
            </div>

            {mode === "create" ? (
              <div className="flex justify-center">
                <WeekdayChipPicker
                  selected={selectedWeekdays}
                  disabled={saving}
                  onToggle={toggleWeekday}
                  onApplyPreset={applyWeekdayPreset}
                />
              </div>
            ) : (
              <Select
                className={cn(STAFFING_FIELD_CLASS, "w-full min-w-[7.5rem]")}
                value={String(weekday)}
                disabled={saving}
                aria-label={t("locations.serviceHoursColumnWeekdays")}
                onChange={(event) => {
                  handleEditWeekdayChange(Number.parseInt(event.target.value, 10));
                }}
              >
                {Array.from({ length: SERVICE_HOUR_WEEKDAY_COUNT }, (_, index) => (
                  <option key={index} value={String(index)}>
                    {weekdayLabelFromIndex(index, t)}
                  </option>
                ))}
              </Select>
            )}

            <div className="min-w-0">{templateSelect}</div>

            <TimeInput
              value={startTime}
              disabled={saving}
              aria-label={t("locations.serviceHoursColumnFrom")}
              onChange={(event) => handleStartTimeChange(event.target.value)}
              className={STAFFING_TIME_INPUT_CLASS}
            />

            <TimeInput
              value={endTime}
              disabled={saving}
              aria-label={t("locations.serviceHoursColumnTo")}
              onChange={(event) => handleEndTimeChange(event.target.value)}
              className={STAFFING_TIME_INPUT_CLASS}
            />
          </div>

          <div className="mb-[20px] space-y-3 lg:hidden">
            <div className={staffingMobileFieldsClass()}>
              <div className="min-w-0 text-center sm:col-span-2">
                <LabelMuted className="mb-1 block text-center">
                  {t("locations.serviceHoursColumnWeekdays")}
                </LabelMuted>
                {mode === "create" ? (
                  <WeekdayChipPicker
                    selected={selectedWeekdays}
                    disabled={saving}
                    onToggle={toggleWeekday}
                    onApplyPreset={applyWeekdayPreset}
                  />
                ) : (
                  <Select
                    className={cn(STAFFING_FIELD_CLASS, "w-full")}
                    value={String(weekday)}
                    disabled={saving}
                    onChange={(event) => {
                      handleEditWeekdayChange(Number.parseInt(event.target.value, 10));
                    }}
                  >
                    {Array.from({ length: SERVICE_HOUR_WEEKDAY_COUNT }, (_, index) => (
                      <option key={index} value={String(index)}>
                        {weekdayLabelFromIndex(index, t)}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <div className="min-w-0 text-center">
                <LabelMuted className="mb-1 block text-center">
                  {t("locations.serviceHoursColumnTemplate")}
                </LabelMuted>
                {templateSelect}
              </div>
              <div className="flex justify-center">
                <div>
                  <LabelMuted className="mb-1 block text-center">
                    {t("locations.serviceHoursColumnFrom")}
                  </LabelMuted>
                  <TimeInput
                    value={startTime}
                    disabled={saving}
                    onChange={(event) => handleStartTimeChange(event.target.value)}
                    className={STAFFING_TIME_INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="flex justify-center">
                <div>
                  <LabelMuted className="mb-1 block text-center">
                    {t("locations.serviceHoursColumnTo")}
                  </LabelMuted>
                  <TimeInput
                    value={endTime}
                    disabled={saving}
                    onChange={(event) => handleEndTimeChange(event.target.value)}
                    className={STAFFING_TIME_INPUT_CLASS}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {t("locations.staffingQualificationsSection")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                className="h-7 shrink-0 text-xs"
                onClick={addRow}
              >
                {t("locations.staffingAddQualification")}
              </Button>
            </div>

            {!qualifications.length ? (
              <Alert variant="info">
                {t("locations.staffingNoAreaQualificationTemplates")}
              </Alert>
            ) : rows.length === 0 ? (
              <p className="text-xs text-muted">
                {t("locations.staffingWindowEmpty")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                {rows.map((row) => (
                  <div
                    key={row.key}
                    className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-1.5 py-1"
                  >
                    <select
                      className="h-8 min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 text-sm"
                      value={row.qualification_id}
                      disabled={saving}
                      title={
                        qualifications.find((qual) => qual.id === row.qualification_id)
                          ?.name
                      }
                      onChange={(e) => setQualification(row.key, e.target.value)}
                    >
                      {qualifications.map((qual) => (
                        <option
                          key={qual.id}
                          value={qual.id}
                          disabled={
                            usedIds.has(qual.id) && qual.id !== row.qualification_id
                          }
                        >
                          {qual.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={row.count}
                      disabled={saving}
                      onChange={(e) => setCount(row.key, e.target.value)}
                      inputMode="numeric"
                      maxLength={2}
                      className={COUNT_INPUT_CLASS}
                      aria-label={t("locations.staffingFormColumnCount")}
                    />
                    <SettingsListRowDeleteButton
                      label={t("common.delete")}
                      disabled={saving}
                      onClick={() => removeRow(row.key)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={settingsModalFooterClass()}>
          <div className="flex w-full flex-col-reverse gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:gap-2">
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

      {infoMessage && (
        <SettingsMessageModal message={infoMessage} onClose={() => setInfoMessage(null)} />
      )}
    </div>
  );
}
