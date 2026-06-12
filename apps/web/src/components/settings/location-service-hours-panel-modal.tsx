"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchLocationAreaServiceHours,
  fetchLocationServiceHourSources,
  saveLocationAreaServiceHours,
  type ServiceHourSourceArea,
} from "@/app/actions/location-service-hours";
import { fetchAreaShiftTemplates } from "@/app/actions/area-shift-templates";
import type {
  AreaShiftTemplateWithBreaks,
  Location,
  LocationArea,
  LocationAreaServiceHour,
} from "@schichtwerk/types";
import {
  buildHoursFromEntries,
  buildServiceHourEntriesFromHours,
  buildServiceHourPayloadFromEntries,
  createDefaultServiceHourEntry,
  type ServiceHourEntry,
} from "@/lib/location-service-hour-entries";
import { currentServiceHoursMatchSource } from "@/lib/location-area-copy-compare";
import { useTranslations } from "@/i18n/locale-provider";
import { WeekdayChipPicker } from "./weekday-chip-picker";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsResponsiveWindowFieldsClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
} from "./settings-list-ui";
import { useDeferredSettingsModalRender } from "./use-deferred-settings-modal-render";
import {
  Alert,
  Button,
  CheckIcon,
  CloseIcon,
  IconButton,
  LabelMuted,
  PlusIcon,
  Select,
  TimeInput,
  TrashIcon,
} from "@/components/ui";
import { cn } from "@/lib/cn";

type Props = {
  location: Location;
  area: LocationArea;
  cachedHours?: LocationAreaServiceHour[];
  cachedShiftTemplates?: AreaShiftTemplateWithBreaks[];
  onClose: () => void;
  onCacheUpdate: (areaId: string, hours: LocationAreaServiceHour[]) => void;
};

const serviceHoursEntryGridClass = () =>
  settingsResponsiveWindowFieldsClass("lg:gap-y-2");

const serviceHoursDesktopGridClass =
  "hidden lg:grid lg:grid-cols-[max-content_8.5rem_9.5rem_minmax(9.5rem,auto)] lg:items-end lg:gap-x-2 lg:gap-y-2";

const serviceHoursFieldClass = "h-8 min-h-8 py-0 text-sm leading-8";

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

export function LocationServiceHoursPanelModal({
  location,
  area,
  cachedHours,
  cachedShiftTemplates,
  onClose,
  onCacheUpdate,
}: Props) {
  const t = useTranslations();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shiftTemplates, setShiftTemplates] = useState<AreaShiftTemplateWithBreaks[]>(
    () => cachedShiftTemplates ?? []
  );
  const [entries, setEntries] = useState<ServiceHourEntry[]>(() =>
    buildServiceHourEntriesFromHours(cachedHours ?? [], cachedShiftTemplates ?? [])
  );
  const [sourceAreas, setSourceAreas] = useState<ServiceHourSourceArea[]>([]);
  const [selectedSourceAreaId, setSelectedSourceAreaId] = useState("");

  const syncEntriesFromHours = useCallback(
    (hours: LocationAreaServiceHour[], templates: AreaShiftTemplateWithBreaks[]) => {
      setEntries(buildServiceHourEntriesFromHours(hours, templates));
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    void Promise.all([
      cachedHours !== undefined
        ? Promise.resolve({ ok: true as const, hours: cachedHours })
        : fetchLocationAreaServiceHours(location.id, area.id),
      cachedShiftTemplates !== undefined
        ? Promise.resolve({ ok: true as const, templates: cachedShiftTemplates })
        : fetchAreaShiftTemplates(location.id, area.id),
      fetchLocationServiceHourSources(location.id, area.id),
    ]).then(([hoursResult, templatesResult, sourcesResult]) => {
      if (cancelled) return;

      const templates =
        templatesResult.ok === true ? (templatesResult.templates ?? []) : [];
      setShiftTemplates(templates);

      if (sourcesResult.ok) {
        const sources = sourcesResult.sources ?? [];
        setSourceAreas(sources);
        setSelectedSourceAreaId(sources[0]?.id ?? "");
      } else {
        setSourceAreas([]);
        setSelectedSourceAreaId("");
      }

      if (!hoursResult.ok) {
        setErrorMessage(hoursResult.error);
        syncEntriesFromHours([], templates);
        setLoading(false);
        return;
      }

      const hours = hoursResult.hours ?? [];
      syncEntriesFromHours(hours, templates);
      if (cachedHours === undefined) {
        onCacheUpdate(area.id, hours);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    area.id,
    cachedHours,
    cachedShiftTemplates,
    location.id,
    onCacheUpdate,
    syncEntriesFromHours,
  ]);

  function updateEntry(entryId: string, patch: Partial<ServiceHourEntry>) {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry))
    );
  }

  function toggleWeekday(entryId: string, weekday: number) {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry;
        const weekdays = new Set(entry.weekdays);
        if (weekdays.has(weekday)) weekdays.delete(weekday);
        else weekdays.add(weekday);
        return { ...entry, weekdays };
      })
    );
  }

  function applyWeekdayPreset(entryId: string, weekdays: number[]) {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? { ...entry, weekdays: new Set(weekdays) }
          : entry
      )
    );
  }

  function handleTemplateChange(entryId: string, templateId: string) {
    const template = shiftTemplates.find((item) => item.id === templateId);
    if (template) {
      updateEntry(entryId, {
        templateId,
        start_time: timeFieldValue(template.start_time),
        end_time: timeFieldValue(template.end_time),
      });
      return;
    }
    updateEntry(entryId, { templateId: "" });
  }

  function addEntry() {
    setEntries((prev) => [...prev, createDefaultServiceHourEntry()]);
  }

  function applyFromSourceArea() {
    const source = sourceAreas.find((entry) => entry.id === selectedSourceAreaId);
    if (!source) return;
    setErrorMessage(null);
    syncEntriesFromHours(source.hours, shiftTemplates);
  }

  const selectedSourceArea = sourceAreas.find(
    (entry) => entry.id === selectedSourceAreaId
  );
  const copyFromSourceIsNoOp = useMemo(() => {
    if (!selectedSourceArea) return true;
    return currentServiceHoursMatchSource(entries, selectedSourceArea.hours);
  }, [entries, selectedSourceArea]);

  function removeEntry(entryId: string) {
    setEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== entryId);
      return next.length ? next : [createDefaultServiceHourEntry()];
    });
  }

  async function handleSave() {
    setErrorMessage(null);
    const payload = buildServiceHourPayloadFromEntries(entries);

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
      onCacheUpdate(area.id, buildHoursFromEntries(area.id, entries));
      onClose();
    } catch {
      setErrorMessage("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  const showModal = useDeferredSettingsModalRender(loading, onClose);
  if (!showModal) return null;

  return (
    <div
      className={cn(settingsSubModalOverlayClass(), saving && "cursor-wait")}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-service-hours-title"
        aria-busy={saving}
        className={cn(
          settingsSubModalDialogClass("3xl", "max-w-[calc(48rem+60px)]"),
          saving && "cursor-wait"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border",
            settingsModalHeaderPaddingClass()
          )}
        >
          <div className="min-w-0">
            <h3 id="location-service-hours-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              <span className="text-foreground">{t("locations.panelServiceHoursOfPrefix")} </span>
              <span className="text-cyan-600">
                {location.name} | {area.name}
              </span>
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

        <div className={cn("min-h-0 flex-1 overflow-y-auto", settingsModalBodyPaddingClass())}>
          {errorMessage ? (
            <Alert variant="error" className="mb-3">
              {errorMessage}
            </Alert>
          ) : null}
          <>
            <div className={serviceHoursDesktopGridClass}>
                <div className="flex justify-center">
                  <LabelMuted className="mb-0 block text-center">
                    {t("locations.serviceHoursColumnWeekdays")}
                  </LabelMuted>
                </div>
                <div className="text-center">
                  <LabelMuted className="mb-0 block text-center">
                    {t("locations.serviceHoursColumnTemplate")}
                  </LabelMuted>
                </div>
                <div className="text-center">
                  <LabelMuted className="mb-0 block text-center">
                    {t("locations.serviceHoursColumnFrom")}
                  </LabelMuted>
                </div>
                <div className="flex min-w-0 items-end gap-2">
                  <div className="w-[9.5rem] text-center">
                    <LabelMuted className="mb-0 block text-center">
                      {t("locations.serviceHoursColumnTo")}
                    </LabelMuted>
                  </div>
                  <span className="mb-0.5 w-8 shrink-0" aria-hidden />
                </div>

                {entries.map((entry) => (
                  <Fragment key={entry.id}>
                    <div className="flex justify-center">
                      <WeekdayChipPicker
                        selected={entry.weekdays}
                        disabled={saving}
                        onToggle={(weekday) => toggleWeekday(entry.id, weekday)}
                        onApplyPreset={(weekdays) =>
                          applyWeekdayPreset(entry.id, weekdays)
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <Select
                        className={cn(
                          serviceHoursFieldClass,
                          !entry.templateId && "text-[silver]"
                        )}
                        value={entry.templateId}
                        disabled={saving || shiftTemplates.length === 0}
                        aria-label={t("locations.serviceHoursColumnTemplate")}
                        onChange={(event) =>
                          handleTemplateChange(entry.id, event.target.value)
                        }
                      >
                        <option value="">
                          {t("locations.serviceHoursSelectTemplate")}
                        </option>
                        {shiftTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <TimeInput
                        value={entry.start_time}
                        disabled={saving}
                        aria-label={t("locations.serviceHoursColumnFrom")}
                        onChange={(event) =>
                          updateEntry(entry.id, {
                            start_time: event.target.value,
                            templateId: "",
                          })
                        }
                        className={cn(
                          serviceHoursFieldClass,
                          "min-w-[9.5rem] w-full tabular-nums"
                        )}
                      />
                    </div>
                    <div className="flex min-w-0 items-end gap-2">
                      <div className="w-[9.5rem]">
                        <TimeInput
                          value={entry.end_time}
                          disabled={saving}
                          aria-label={t("locations.serviceHoursColumnTo")}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              end_time: event.target.value,
                              templateId: "",
                            })
                          }
                          className={cn(
                          serviceHoursFieldClass,
                          "min-w-[9.5rem] w-full tabular-nums"
                        )}
                        />
                      </div>
                      <IconButton
                        size="sm"
                        type="button"
                        disabled={saving || entries.length <= 1}
                        aria-label={t("locations.serviceHoursRemoveRow")}
                        onClick={() => removeEntry(entry.id)}
                        className="mb-0.5 shrink-0 border-transparent bg-transparent hover:bg-subtle disabled:opacity-40"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </Fragment>
                ))}
              </div>

              <div className="space-y-2 lg:hidden">
                <div className={cn(serviceHoursEntryGridClass(), "mb-1")}>
                  <div className="min-w-0 text-center sm:col-span-2">
                    <LabelMuted className="mb-0 block text-center">
                      {t("locations.serviceHoursColumnWeekdays")}
                    </LabelMuted>
                  </div>
                  <div className="min-w-0 text-center">
                    <LabelMuted className="mb-0 block text-center">
                      {t("locations.serviceHoursColumnTemplate")}
                    </LabelMuted>
                  </div>
                  <div className="min-w-0 text-center">
                    <LabelMuted className="mb-0 block text-center">
                      {t("locations.serviceHoursColumnFrom")}
                    </LabelMuted>
                  </div>
                  <div className="flex min-w-0 items-end gap-2">
                    <div className="min-w-0 flex-1 text-center">
                      <LabelMuted className="mb-0 block text-center">
                        {t("locations.serviceHoursColumnTo")}
                      </LabelMuted>
                    </div>
                    <span className="mb-0.5 w-8 shrink-0" aria-hidden />
                  </div>
                </div>
                {entries.map((entry) => (
                  <div key={entry.id} className={serviceHoursEntryGridClass()}>
                    <div className="min-w-0 flex justify-center sm:col-span-2">
                      <WeekdayChipPicker
                        selected={entry.weekdays}
                        disabled={saving}
                        onToggle={(weekday) => toggleWeekday(entry.id, weekday)}
                        onApplyPreset={(weekdays) =>
                          applyWeekdayPreset(entry.id, weekdays)
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <Select
                        className={cn(
                          serviceHoursFieldClass,
                          !entry.templateId && "text-[silver]"
                        )}
                        value={entry.templateId}
                        disabled={saving || shiftTemplates.length === 0}
                        aria-label={t("locations.serviceHoursColumnTemplate")}
                        onChange={(event) =>
                          handleTemplateChange(entry.id, event.target.value)
                        }
                      >
                        <option value="">
                          {t("locations.serviceHoursSelectTemplate")}
                        </option>
                        {shiftTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <TimeInput
                        value={entry.start_time}
                        disabled={saving}
                        aria-label={t("locations.serviceHoursColumnFrom")}
                        onChange={(event) =>
                          updateEntry(entry.id, {
                            start_time: event.target.value,
                            templateId: "",
                          })
                        }
                        className={cn(
                          serviceHoursFieldClass,
                          "min-w-[9.5rem] w-full tabular-nums"
                        )}
                      />
                    </div>
                    <div className="flex min-w-0 items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <TimeInput
                          value={entry.end_time}
                          disabled={saving}
                          aria-label={t("locations.serviceHoursColumnTo")}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              end_time: event.target.value,
                              templateId: "",
                            })
                          }
                          className={cn(
                          serviceHoursFieldClass,
                          "min-w-[9.5rem] w-full tabular-nums"
                        )}
                        />
                      </div>
                      <IconButton
                        size="sm"
                        type="button"
                        disabled={saving || entries.length <= 1}
                        aria-label={t("locations.serviceHoursRemoveRow")}
                        onClick={() => removeEntry(entry.id)}
                        className="mb-0.5 shrink-0 border-transparent bg-transparent hover:bg-subtle disabled:opacity-40"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 lg:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={addEntry}
                  className="h-8 text-xs"
                >
                  <PlusIcon />
                  {t("locations.serviceHoursAddRow")}
                </Button>
                {sourceAreas.length > 0 ? (
                  <div className="flex min-w-0 items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving || !selectedSourceArea || copyFromSourceIsNoOp}
                      onClick={applyFromSourceArea}
                      className="h-8 shrink-0 text-xs"
                    >
                      {t("locations.serviceHoursCopyApply")}
                    </Button>
                    <Select
                      className={cn(
                        serviceHoursFieldClass,
                        "h-8 w-[9.5rem] min-w-[9.5rem] text-xs"
                      )}
                      value={selectedSourceAreaId}
                      disabled={saving}
                      aria-label={t("locations.serviceHoursCopySelectArea")}
                      onChange={(event) => setSelectedSourceAreaId(event.target.value)}
                    >
                      {sourceAreas.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>
              <div className={cn(serviceHoursDesktopGridClass, "mt-3 hidden lg:grid")}>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={addEntry}
                    className="h-8 text-xs"
                  >
                    <PlusIcon />
                    {t("locations.serviceHoursAddRow")}
                  </Button>
                </div>
                <div aria-hidden />
                <div aria-hidden />
                <div className="flex min-w-0 items-center justify-end gap-2">
                  {sourceAreas.length > 0 ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving || !selectedSourceArea || copyFromSourceIsNoOp}
                        onClick={applyFromSourceArea}
                        className="h-8 shrink-0 text-xs"
                      >
                        {t("locations.serviceHoursCopyApply")}
                      </Button>
                      <Select
                        className={cn(
                          serviceHoursFieldClass,
                          "h-8 w-[9.5rem] min-w-[9.5rem] text-xs"
                        )}
                        value={selectedSourceAreaId}
                        disabled={saving}
                        aria-label={t("locations.serviceHoursCopySelectArea")}
                        onChange={(event) => setSelectedSourceAreaId(event.target.value)}
                      >
                        {sourceAreas.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.name}
                          </option>
                        ))}
                      </Select>
                    </>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">{t("locations.serviceHoursHint")}</p>
          </>
        </div>

        <div className={settingsModalFooterClass()}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            <CloseIcon />
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
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
