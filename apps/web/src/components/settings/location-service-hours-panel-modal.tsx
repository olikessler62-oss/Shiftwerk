"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchLocationAreaServiceHours,
  saveLocationAreaServiceHours,
} from "@/app/actions/location-service-hours";
import type { Location, LocationArea, LocationAreaServiceHour } from "@schichtwerk/types";
import {
  canAddServiceHourSlot,
  suggestNextServiceHourSlot,
} from "@schichtwerk/database";
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
  PlusIcon,
  TimeInput,
  TrashIcon,
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

type TimeSlot = {
  id: string;
  start_time: string;
  end_time: string;
};

type DayRow = {
  enabled: boolean;
  slots: TimeSlot[];
};

function createDefaultSlot(): TimeSlot {
  return {
    id: crypto.randomUUID(),
    start_time: DEFAULT_START,
    end_time: DEFAULT_END,
  };
}

function timeToInput(value: string): string {
  const parts = value.trim().split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}`;
}

function buildRowsFromHours(hours: LocationAreaServiceHour[]): DayRow[] {
  return Array.from({ length: DAY_COUNT }, (_, weekday) => {
    const dayHours = hours
      .filter((hour) => hour.weekday === weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (dayHours.length === 0) {
      return { enabled: false, slots: [createDefaultSlot()] };
    }

    return {
      enabled: true,
      slots: dayHours.map((hour) => ({
        id: hour.id,
        start_time: timeToInput(hour.start_time),
        end_time: timeToInput(hour.end_time),
      })),
    };
  });
}

function buildHoursFromRows(
  areaId: string,
  rows: DayRow[]
): LocationAreaServiceHour[] {
  return rows.flatMap((row, weekday) => {
    if (!row.enabled) return [];
    return row.slots.map((slot) => ({
      id: slot.id,
      location_area_id: areaId,
      weekday,
      start_time: timeToInput(slot.start_time) + ":00",
      end_time: timeToInput(slot.end_time) + ":00",
    }));
  });
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
      prev.map((row, index) => {
        if (index !== weekday) return row;
        if (enabled) {
          return {
            enabled: true,
            slots: row.slots.length ? row.slots : [createDefaultSlot()],
          };
        }
        return { ...row, enabled: false };
      })
    );
  }

  function setSlotTime(
    weekday: number,
    slotIndex: number,
    field: "start_time" | "end_time",
    value: string
  ) {
    setRows((prev) =>
      prev.map((row, index) => {
        if (index !== weekday) return row;
        return {
          ...row,
          slots: row.slots.map((slot, currentIndex) =>
            currentIndex === slotIndex ? { ...slot, [field]: value } : slot
          ),
        };
      })
    );
  }

  function addSlot(weekday: number) {
    setRows((prev) =>
      prev.map((row, index) => {
        if (index !== weekday) return row;
        const nextSlot = suggestNextServiceHourSlot(row.slots);
        if (!nextSlot) return row;
        return {
          ...row,
          enabled: true,
          slots: [
            ...row.slots,
            {
              id: crypto.randomUUID(),
              start_time: nextSlot.start_time,
              end_time: nextSlot.end_time,
            },
          ],
        };
      })
    );
  }

  function removeSlot(weekday: number, slotIndex: number) {
    setRows((prev) =>
      prev.map((row, index) => {
        if (index !== weekday) return row;
        const nextSlots = row.slots.filter((_, currentIndex) => currentIndex !== slotIndex);
        if (nextSlots.length === 0) {
          return { enabled: false, slots: [createDefaultSlot()] };
        }
        return { ...row, slots: nextSlots };
      })
    );
  }

  async function handleSave() {
    setErrorMessage(null);
    const payload = rows.flatMap((row, weekday) =>
      row.enabled
        ? row.slots.map((slot) => ({
            weekday,
            start_time: slot.start_time,
            end_time: slot.end_time,
          }))
        : []
    );

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

  function renderDayRows(label: string, weekday: number) {
    const row = rows[weekday]!;
    const visibleSlots = row.enabled ? row.slots : [row.slots[0]!];
    const canAddSlot = row.enabled && canAddServiceHourSlot(row.slots);

    return visibleSlots.map((slot, slotIndex) => (
      <tr key={slot.id}>
        {slotIndex === 0 ? (
          <>
            <td
              rowSpan={visibleSlots.length}
              className="py-0.5 pr-3 align-top text-sm text-foreground"
            >
              {label}
            </td>
            <td rowSpan={visibleSlots.length} className="px-2 py-0.5 text-center align-top">
              <input
                type="checkbox"
                checked={row.enabled}
                disabled={saving}
                onChange={(event) => setRowEnabled(weekday, event.target.checked)}
                className="mt-1 size-4 rounded border-border"
                aria-label={label}
              />
            </td>
          </>
        ) : null}
        <td className="px-2 py-0.5">
          <TimeInput
            value={slot.start_time}
            disabled={saving || !row.enabled}
            onChange={(event) =>
              setSlotTime(weekday, slotIndex, "start_time", event.target.value)
            }
            className={cn(
              "h-8 w-[9.5rem] tabular-nums",
              !row.enabled && "opacity-50"
            )}
          />
        </td>
        <td className="px-2 py-0.5">
          <TimeInput
            value={slot.end_time}
            disabled={saving || !row.enabled}
            onChange={(event) =>
              setSlotTime(weekday, slotIndex, "end_time", event.target.value)
            }
            className={cn(
              "h-8 w-[9.5rem] tabular-nums",
              !row.enabled && "opacity-50"
            )}
          />
        </td>
        <td className="px-1 py-0.5">
          <div className="flex items-center justify-end gap-0.5">
            {row.enabled && row.slots.length > 1 ? (
              <IconButton
                size="sm"
                type="button"
                disabled={saving}
                aria-label={t("locations.serviceHoursRemoveSlot")}
                onClick={() => removeSlot(weekday, slotIndex)}
                className="border-transparent bg-transparent hover:bg-subtle"
              >
                <TrashIcon className="h-4 w-4" />
              </IconButton>
            ) : (
              <span className="inline-block h-8 w-8" aria-hidden />
            )}
            {row.enabled && slotIndex === visibleSlots.length - 1 ? (
              <IconButton
                size="sm"
                type="button"
                disabled={saving || !canAddSlot}
                aria-label={t("locations.serviceHoursAddSlot")}
                onClick={() => addSlot(weekday)}
                className="border-transparent bg-transparent hover:bg-subtle disabled:opacity-40"
              >
                <PlusIcon className="h-4 w-4" />
              </IconButton>
            ) : null}
          </div>
        </td>
      </tr>
    ));
  }

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center rounded-2xl bg-black/30 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-service-hours-title"
        className="relative z-[61] flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
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
          {errorMessage ? (
            <Alert variant="error" className="mb-3">
              {errorMessage}
            </Alert>
          ) : null}
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
                    <th className="w-20 pb-1" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAY_KEYS.flatMap((key, weekday) =>
                    renderDayRows(t(`locations.weekdays.${key}`), weekday)
                  )}
                  {renderDayRows(
                    t("locations.weekdays.holiday"),
                    STAFFING_HOLIDAY_WEEKDAY
                  )}
                </tbody>
              </table>
              <p className="mt-2 max-w-[32rem] text-center text-xs text-muted">
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
