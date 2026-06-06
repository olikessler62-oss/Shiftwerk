"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchLocationAreaServiceHours,
  saveLocationAreaServiceHours,
} from "@/app/actions/location-service-hours";
import type { Location, LocationArea, LocationAreaServiceHour } from "@schichtwerk/types";
import { STAFFING_HOLIDAY_WEEKDAY } from "@/lib/location-staffing-client";
import { useTranslations } from "@/i18n/locale-provider";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsColumnHeaderClass,
} from "./settings-list-ui";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  TimeInput,
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

const DAY_COUNT = WEEKDAY_KEYS.length + 1;
const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

type DayRow = {
  enabled: boolean;
  start_time: string;
  end_time: string;
};

function timeToInput(value: string): string {
  const parts = value.trim().split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}`;
}

function buildRowsFromHours(hours: LocationAreaServiceHour[]): DayRow[] {
  return Array.from({ length: DAY_COUNT }, (_, weekday) => {
    const rule = hours.find((h) => h.weekday === weekday);
    if (!rule) {
      return { enabled: false, start_time: DEFAULT_START, end_time: DEFAULT_END };
    }
    return {
      enabled: true,
      start_time: timeToInput(rule.start_time),
      end_time: timeToInput(rule.end_time),
    };
  });
}

function buildHoursFromRows(
  areaId: string,
  rows: DayRow[]
): LocationAreaServiceHour[] {
  return rows
    .map((row, weekday) => ({ row, weekday }))
    .filter(({ row }) => row.enabled)
    .map(({ row, weekday }) => ({
      id: `${areaId}:${weekday}`,
      location_area_id: areaId,
      weekday,
      start_time: timeToInput(row.start_time) + ":00",
      end_time: timeToInput(row.end_time) + ":00",
    }));
}

type Props = {
  location: Location;
  area: LocationArea;
  cachedHours?: LocationAreaServiceHour[];
  onClose: () => void;
  onCacheUpdate: (areaId: string, hours: LocationAreaServiceHour[]) => void;
};

export function LocationServiceHoursPanelModal({
  location,
  area,
  cachedHours,
  onClose,
  onCacheUpdate,
}: Props) {
  const t = useTranslations();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(cachedHours === undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<DayRow[]>(() =>
    buildRowsFromHours(cachedHours ?? [])
  );

  const syncRowsFromHours = useCallback((hours: LocationAreaServiceHour[]) => {
    setRows(buildRowsFromHours(hours));
  }, []);

  useEffect(() => {
    if (cachedHours === undefined) return;
    syncRowsFromHours(cachedHours);
    setLoading(false);
  }, [cachedHours, syncRowsFromHours]);

  useEffect(() => {
    if (cachedHours !== undefined) return;

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    void fetchLocationAreaServiceHours(location.id, area.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setErrorMessage(result.error);
        syncRowsFromHours([]);
        return;
      }
      const hours = result.hours ?? [];
      syncRowsFromHours(hours);
      onCacheUpdate(area.id, hours);
    });
    return () => {
      cancelled = true;
    };
  }, [area.id, cachedHours, location.id, onCacheUpdate, syncRowsFromHours]);

  function setRowEnabled(weekday: number, enabled: boolean) {
    setRows((prev) =>
      prev.map((row, index) =>
        index === weekday ? { ...row, enabled } : row
      )
    );
  }

  function setRowTime(weekday: number, field: "start_time" | "end_time", value: string) {
    setRows((prev) =>
      prev.map((row, index) =>
        index === weekday ? { ...row, [field]: value } : row
      )
    );
  }

  async function handleSave() {
    setErrorMessage(null);
    const payload = rows
      .map((row, weekday) => ({ row, weekday }))
      .filter(({ row }) => row.enabled)
      .map(({ row, weekday }) => ({
        weekday,
        start_time: row.start_time,
        end_time: row.end_time,
      }));

    setSaving(true);
    try {
      const result = await saveLocationAreaServiceHours({
        locationId: location.id,
        locationAreaId: area.id,
        rows: payload,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      onCacheUpdate(area.id, buildHoursFromRows(area.id, rows));
      onClose();
    } catch {
      setErrorMessage("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center rounded-2xl bg-black/30 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-service-hours-title"
        className="relative z-[61] flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 id="location-service-hours-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("locations.panelServiceHoursOf", {
                location: location.name,
                area: area.name,
              })}
            </h3>
          </div>
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

        <div className="overflow-x-hidden px-5 py-3">
          {errorMessage && <Alert variant="error" className="mb-3">{errorMessage}</Alert>}
          {loading ? (
            <p className="py-6 text-center text-sm text-muted">{t("common.loading")}</p>
          ) : (
            <div className="flex flex-col items-center">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <th
                      className={cn(
                        settingsColumnHeaderClass(),
                        "pr-3 pb-1 text-left"
                      )}
                    >
                      {t("locations.serviceHoursColumnDay")}
                    </th>
                    <th
                      className={cn(
                        settingsColumnHeaderClass("center"),
                        "w-12 px-2 pb-1"
                      )}
                    >
                      {t("locations.serviceHoursColumnOpen")}
                    </th>
                    <th
                      className={cn(
                        settingsColumnHeaderClass("center"),
                        "w-[9.5rem] px-2 pb-1"
                      )}
                    >
                      {t("locations.serviceHoursColumnFrom")}
                    </th>
                    <th
                      className={cn(
                        settingsColumnHeaderClass("center"),
                        "w-[9.5rem] px-2 pb-1"
                      )}
                    >
                      {t("locations.serviceHoursColumnTo")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAY_KEYS.map((key, weekday) => {
                    const row = rows[weekday]!;
                    return (
                      <DayRowFields
                        key={key}
                        label={t(`locations.weekdays.${key}`)}
                        row={row}
                        disabled={saving}
                        onToggle={(enabled) => setRowEnabled(weekday, enabled)}
                        onStartChange={(value) =>
                          setRowTime(weekday, "start_time", value)
                        }
                        onEndChange={(value) =>
                          setRowTime(weekday, "end_time", value)
                        }
                      />
                    );
                  })}
                  {(() => {
                    const weekday = STAFFING_HOLIDAY_WEEKDAY;
                    const row = rows[weekday]!;
                    return (
                      <DayRowFields
                        key="holiday"
                        label={t("locations.weekdays.holiday")}
                        row={row}
                        disabled={saving}
                        onToggle={(enabled) => setRowEnabled(weekday, enabled)}
                        onStartChange={(value) =>
                          setRowTime(weekday, "start_time", value)
                        }
                        onEndChange={(value) =>
                          setRowTime(weekday, "end_time", value)
                        }
                      />
                    );
                  })()}
                </tbody>
              </table>
              <p className="mt-2 max-w-[28rem] text-center text-xs text-muted">
                {t("locations.serviceHoursHint")}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            <CheckIcon />
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DayRowFields({
  label,
  row,
  disabled,
  onToggle,
  onStartChange,
  onEndChange,
}: {
  label: string;
  row: DayRow;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const timeDisabled = disabled || !row.enabled;

  return (
    <tr>
      <td className="py-0.5 pr-3 text-sm text-foreground">{label}</td>
      <td className="px-2 py-0.5 text-center">
        <input
          type="checkbox"
          checked={row.enabled}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-4 rounded border-border"
          aria-label={label}
        />
      </td>
      <td className="px-2 py-0.5">
        <TimeInput
          value={row.start_time}
          disabled={timeDisabled}
          onChange={(e) => onStartChange(e.target.value)}
          className={cn(
            "h-8 w-[9.5rem] tabular-nums",
            timeDisabled && "opacity-50"
          )}
        />
      </td>
      <td className="px-2 py-0.5">
        <TimeInput
          value={row.end_time}
          disabled={timeDisabled}
          onChange={(e) => onEndChange(e.target.value)}
          className={cn(
            "h-8 w-[9.5rem] tabular-nums",
            timeDisabled && "opacity-50"
          )}
        />
      </td>
    </tr>
  );
}
