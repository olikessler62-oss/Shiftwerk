"use client";

import { useMemo, useState } from "react";
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
  Input,
  LabelMuted,
  Select,
  TimeInput,
  TrashIcon,
} from "@/components/ui";

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

  function handleWeekdayChange(nextWeekday: number) {
    setWeekday(nextWeekday);
    setError(null);
    if (mode !== "create") return;

    const suggestion = suggestStaffingCreateWindow(
      serviceHours,
      staffing,
      shiftTemplates,
      { weekday: nextWeekday, searchAllWeekdays: false }
    );
    setStartTime(suggestion.start_time);
    setEndTime(suggestion.end_time);
    setTemplateId(suggestion.templateId);
    setDayFullyBooked(suggestion.dayFullyBooked);
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
    const usedIds = new Set(rows.map((row) => row.qualification_id));
    const defaultQual = qualifications.find((qual) => !usedIds.has(qual.id));
    if (!defaultQual) return;
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
      setError(t("locations.staffingNoQualifications"));
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

    setSaving(true);
    try {
      const result = await saveServiceHourStaffing({
        locationId: location.id,
        locationAreaId: area.id,
        window: {
          weekday,
          start_time: startTime,
          end_time: endTime,
        },
        previousServiceHourId:
          mode === "edit" ? initialServiceHourId : undefined,
        rules,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(result.serviceHourId, result.staffing, result.serviceHours);
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  const usedIds = new Set(rows.map((row) => row.qualification_id));
  const canAdd = qualifications.some((qual) => !usedIds.has(qual.id));

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
        className={settingsNestedModalDialogClass("2xl")}
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

          <div
            className={cn(
              "mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(8.5rem,auto)_minmax(0,1fr)_9rem_9rem] lg:items-end"
            )}
          >
            <div className="w-full shrink-0 lg:w-auto">
              <LabelMuted className="mb-1 block">
                {t("locations.serviceHoursColumnWeekdays")}
              </LabelMuted>
              <Select
                className="h-8 min-h-8 w-full py-0 text-sm lg:w-auto lg:min-w-[8.5rem]"
                value={String(weekday)}
                disabled={saving}
                onChange={(event) => {
                  handleWeekdayChange(Number.parseInt(event.target.value, 10));
                }}
              >
                {Array.from({ length: SERVICE_HOUR_WEEKDAY_COUNT }, (_, index) => (
                  <option key={index} value={String(index)}>
                    {weekdayLabelFromIndex(index, t)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-0">
              <LabelMuted className="mb-1 block">
                {t("locations.serviceHoursColumnTemplate")}
              </LabelMuted>
              <Select
                className={cn(
                  "h-8 min-h-8 py-0 text-xs",
                  !templateId && "text-[silver]"
                )}
                value={templateId}
                disabled={saving || shiftTemplates.length === 0}
                onChange={(event) => handleTemplateChange(event.target.value)}
              >
                <option value="">
                  {t("locations.serviceHoursSelectTemplate")}
                </option>
                {shiftTemplates.map((template) => (
                  <option
                    key={template.id}
                    value={template.id}
                    disabled={
                      mode === "create" &&
                      isShiftTemplateBlockedOnWeekday(
                        template,
                        weekday,
                        serviceHours,
                        staffing
                      )
                    }
                  >
                    {template.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="shrink-0 min-w-[9rem]">
              <LabelMuted className="mb-1 block">
                {t("locations.serviceHoursColumnFrom")}
              </LabelMuted>
              <TimeInput
                value={startTime}
                disabled={saving}
                onChange={(event) => handleStartTimeChange(event.target.value)}
                className="h-8 min-w-[9rem] w-full tabular-nums"
              />
            </div>
            <div className="shrink-0 min-w-[9rem]">
              <LabelMuted className="mb-1 block">
                {t("locations.serviceHoursColumnTo")}
              </LabelMuted>
              <TimeInput
                value={endTime}
                disabled={saving}
                onChange={(event) => handleEndTimeChange(event.target.value)}
                className="h-8 min-w-[9rem] w-full tabular-nums"
              />
            </div>
          </div>

          {qualifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {t("locations.staffingNoQualifications")}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {t("locations.staffingQualificationsSection")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || !canAdd}
                  className="h-7 shrink-0 text-xs"
                  onClick={addRow}
                >
                  {t("locations.staffingAddQualification")}
                </Button>
              </div>
              {rows.length === 0 ? (
                <p className="text-xs text-muted">
                  {t("locations.staffingWindowEmpty")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {rows.map((row) => (
                    <div key={row.key} className="flex items-center gap-2">
                      <select
                        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        value={row.qualification_id}
                        disabled={saving}
                        onChange={(e) => setQualification(row.key, e.target.value)}
                      >
                        {qualifications.map((qual) => (
                          <option
                            key={qual.id}
                            value={qual.id}
                            disabled={
                              usedIds.has(qual.id) &&
                              qual.id !== row.qualification_id
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
                      <IconButton
                        size="sm"
                        disabled={saving}
                        className="border border-border"
                        aria-label={t("common.delete")}
                        onClick={() => removeRow(row.key)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
            disabled={saving || !qualifications.length}
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
