"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createProfileShiftPreferences,
  fetchProfileShiftPreferenceFormOptions,
  updateProfileShiftPreference,
  type ProfileShiftPreferenceFormOptionsResult,
} from "@/app/actions/profile-shift-preferences";
import { parseAvailabilityTimeRange } from "@schichtwerk/database";
import type {
  Location,
  LocationArea,
  ProfileRecurringAvailability,
  ProfileShiftPreference,
  Qualification,
} from "@schichtwerk/types";
import {
  formatAvailabilityTimeRange,
  formatOvernightAvailabilitySpan,
} from "@/lib/profile-availability-label";
import {
  filterWeekdaysWithProfileAvailability,
  groupProfileAvailabilityByWeekday,
  weekdaysWithProfileAvailability,
} from "@/lib/profile-shift-preference-weekday-availability";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { SERVICE_HOUR_WEEKDAY_COUNT } from "@/lib/location-service-hour-entries";
import { WeekdayChipPicker } from "./weekday-chip-picker";
import { cn } from "@/lib/cn";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsConfirmDialogClass,
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
import {
  buildShiftPreferencePlacementLookups,
  resolveShiftPreferenceLocationId,
} from "@/lib/profile-shift-preference-display";
import { profileShiftPreferenceHasTimeDimension } from "@/lib/profile-shift-preference-availability";

type PreferenceDimension = "time" | "location" | "area" | "job";

const dimensionChipClass = (active: boolean, disabled: boolean) =>
  cn(
    "rounded border px-2 py-0.5 text-xs font-medium transition-colors",
    active
      ? "border-primary bg-primary/10 text-primary"
      : "border-border/80 bg-surface text-muted hover:bg-subtle hover:text-foreground",
    disabled && "cursor-not-allowed opacity-50"
  );

function initialDimensionEnabled(
  preference: ProfileShiftPreference | undefined,
  dimension: PreferenceDimension
): boolean {
  if (!preference) return dimension === "time";
  switch (dimension) {
    case "time":
      return profileShiftPreferenceHasTimeDimension(preference);
    case "location":
      return (
        preference.location_id != null ||
        preference.location_area_id != null
      );
    case "area":
      return preference.location_area_id != null;
    case "job":
      return preference.qualification_id != null;
    default:
      return false;
  }
}

function defaultCreateWeekdays(
  availability: readonly ProfileRecurringAvailability[]
): Set<number> {
  const allowed = weekdaysWithProfileAvailability(
    availability,
    SERVICE_HOUR_WEEKDAY_COUNT
  );
  const preferred = [0, 1, 2, 3, 4].filter((weekday) => allowed.has(weekday));
  return new Set(preferred.length > 0 ? preferred : [...allowed]);
}

type FormMode = "create" | "edit";

type FormOptions = Extract<
  ProfileShiftPreferenceFormOptionsResult,
  { ok: true }
>;

type Props = {
  mode: FormMode;
  profileId: string;
  profileAvailability: ProfileRecurringAvailability[];
  currentPreference?: ProfileShiftPreference;
  formOptions?: FormOptions;
  onClose: () => void;
  onSaved: (
    preferences: ProfileShiftPreference[],
    selectedId: string,
    scrollToSelection?: boolean
  ) => void;
};

type ParsedAvailabilityTimeRange = Extract<
  ReturnType<typeof parseAvailabilityTimeRange>,
  { ok: true }
>;

export function ProfileShiftPreferencesFormModal({
  mode,
  profileId,
  profileAvailability,
  currentPreference,
  formOptions: formOptionsProp,
  onClose,
  onSaved,
}: Props) {
  const { locale } = useLocale();
  const localeKey = locale === "en" ? "en" : "de";
  const t = useTranslations();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overnightConfirmOpen, setOvernightConfirmOpen] = useState(false);
  const savingRef = useRef(false);

  const availabilityByWeekday = useMemo(
    () => groupProfileAvailabilityByWeekday(profileAvailability),
    [profileAvailability]
  );
  const weekdaysWithAvailability = useMemo(
    () =>
      weekdaysWithProfileAvailability(
        profileAvailability,
        SERVICE_HOUR_WEEKDAY_COUNT
      ),
    [profileAvailability]
  );
  const disabledWeekdays = useMemo(() => {
    const disabled = new Set<number>();
    for (let weekday = 0; weekday < SERVICE_HOUR_WEEKDAY_COUNT; weekday += 1) {
      if (!weekdaysWithAvailability.has(weekday)) {
        disabled.add(weekday);
      }
    }
    if (mode === "edit" && currentPreference?.weekday != null) {
      disabled.delete(currentPreference.weekday);
    }
    return disabled;
  }, [currentPreference, mode, weekdaysWithAvailability]);

  const [weekday, setWeekday] = useState(
    () => currentPreference?.weekday ?? 0
  );
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(() =>
    mode === "create"
      ? defaultCreateWeekdays(profileAvailability)
      : new Set(
          currentPreference?.weekday != null ? [currentPreference.weekday] : []
        )
  );
  const [startTime, setStartTime] = useState(
    () => currentPreference?.start_time?.slice(0, 5) ?? "08:00"
  );
  const [endTime, setEndTime] = useState(
    () => currentPreference?.end_time?.slice(0, 5) ?? "12:00"
  );
  const [timeEnabled, setTimeEnabled] = useState(() =>
    initialDimensionEnabled(currentPreference, "time")
  );
  const [locationEnabled, setLocationEnabled] = useState(() =>
    initialDimensionEnabled(currentPreference, "location")
  );
  const [areaEnabled, setAreaEnabled] = useState(() =>
    initialDimensionEnabled(currentPreference, "area")
  );
  const [jobEnabled, setJobEnabled] = useState(() =>
    initialDimensionEnabled(currentPreference, "job")
  );
  const [formOptions, setFormOptions] = useState<FormOptions | null>(
    formOptionsProp ?? null
  );
  const [optionsLoading, setOptionsLoading] = useState(!formOptionsProp);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [qualificationId, setQualificationId] = useState<string | null>(null);

  const usesMultiDayPicker = mode === "create";

  const placementLookups = useMemo(
    () =>
      formOptions
        ? buildShiftPreferencePlacementLookups(formOptions)
        : null,
    [formOptions]
  );

  const areasForLocation = useMemo(() => {
    if (!formOptions || !locationId) return [] as LocationArea[];
    return formOptions.areas.filter((area) => area.location_id === locationId);
  }, [formOptions, locationId]);

  useEffect(() => {
    if (formOptionsProp) {
      setFormOptions(formOptionsProp);
      setOptionsLoading(false);
      return;
    }

    let cancelled = false;
    setOptionsLoading(true);
    void fetchProfileShiftPreferenceFormOptions(profileId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setFormOptions({
          locations: result.locations,
          areas: result.areas,
          qualifications: result.qualifications,
        });
      }
      setOptionsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [formOptionsProp, profileId]);

  useEffect(() => {
    if (!currentPreference || !placementLookups) return;
    setLocationId(
      resolveShiftPreferenceLocationId(currentPreference, placementLookups)
    );
    setAreaId(currentPreference.location_area_id);
    setQualificationId(currentPreference.qualification_id);
  }, [currentPreference, placementLookups]);

  function renderWeekdayAvailabilityTooltip(day: number) {
    const slots = availabilityByWeekday.get(day) ?? [];
    if (slots.length === 0) {
      return t("profiles.shiftPreferenceTooltipNoAvailability");
    }
    return (
      <div className="flex flex-col gap-0.5">
        {slots.map((slot) => (
          <span key={slot.id} className="tabular-nums">
            {formatAvailabilityTimeRange(
              slot.start_time,
              slot.end_time,
              localeKey
            )}
          </span>
        ))}
      </div>
    );
  }

  function applyAvailableWeekdayPreset(days: readonly number[]) {
    const next = filterWeekdaysWithProfileAvailability(
      days,
      profileAvailability,
      SERVICE_HOUR_WEEKDAY_COUNT
    );
    if (mode === "create") {
      setSelectedWeekdays(new Set(next));
    } else if (next[0] !== undefined) {
      setWeekday(next[0]);
      setSelectedWeekdays(new Set([next[0]]));
    } else {
      setSelectedWeekdays(new Set());
    }
    setError(null);
  }

  function handleWeekdayToggle(nextWeekday: number) {
    if (mode === "edit") {
      setWeekday(nextWeekday);
      setSelectedWeekdays(new Set([nextWeekday]));
      setError(null);
      return;
    }
    setSelectedWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(nextWeekday)) next.delete(nextWeekday);
      else next.add(nextWeekday);
      return next;
    });
    setError(null);
  }

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

  function toggleDimension(dimension: PreferenceDimension) {
    setError(null);
    switch (dimension) {
      case "time":
        setTimeEnabled((current) => !current);
        break;
      case "location":
        setLocationEnabled((current) => {
          if (current) setLocationId(null);
          return !current;
        });
        break;
      case "area":
        setAreaEnabled((current) => {
          if (current) {
            setAreaId(null);
            return false;
          }
          setLocationEnabled(true);
          return true;
        });
        break;
      case "job":
        setJobEnabled((current) => {
          if (current) setQualificationId(null);
          return !current;
        });
        break;
      default:
        break;
    }
  }

  function hasFilledDimension(): boolean {
    const hasTime =
      timeEnabled &&
      (mode === "edit"
        ? weekday != null
        : selectedWeekdays.size > 0) &&
      startTime.trim() !== "" &&
      endTime.trim() !== "";
    const hasLocation = locationEnabled && locationId != null;
    const hasArea = areaEnabled && areaId != null;
    const hasJob = jobEnabled && qualificationId != null;
    return hasTime || hasLocation || hasArea || hasJob;
  }

  async function performSave(timeCheck: ParsedAvailabilityTimeRange | null) {
    if (savingRef.current) return;

    if (!hasFilledDimension()) {
      setError(t("profiles.shiftPreferenceSelectDimension"));
      return;
    }

    const savedStart = timeCheck?.start_time.slice(0, 5) ?? null;
    const savedEnd = timeCheck?.end_time.slice(0, 5) ?? null;
    const placement = {
      location_id: locationEnabled ? locationId : null,
      location_area_id: areaEnabled ? areaId : null,
      qualification_id: jobEnabled ? qualificationId : null,
    };

    savingRef.current = true;
    setSaving(true);
    try {
      if (mode === "edit" && currentPreference) {
        const result = await updateProfileShiftPreference({
          profileId,
          preferenceId: currentPreference.id,
          weekday: timeEnabled ? weekday : null,
          start_time: timeEnabled ? savedStart : null,
          end_time: timeEnabled ? savedEnd : null,
          ...placement,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const list = result.preferences ?? [];
        onSaved(list, currentPreference.id);
        onClose();
        return;
      }

      if (timeEnabled) {
        const weekdaysToSave = [...selectedWeekdays].sort((a, b) => a - b);
        if (weekdaysToSave.length === 0) {
          setError(t("profiles.shiftPreferenceSelectWeekdays"));
          return;
        }

        const result = await createProfileShiftPreferences({
          profileId,
          weekdays: weekdaysToSave,
          start_time: savedStart,
          end_time: savedEnd,
          ...placement,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }

        const latestList = result.preferences ?? [];
        const lastSelectedId =
          latestList.find(
            (item) =>
              item.weekday != null &&
              weekdaysToSave.includes(item.weekday) &&
              item.start_time?.slice(0, 5) === savedStart &&
              item.end_time?.slice(0, 5) === savedEnd
          )?.id ??
          latestList[0]?.id ??
          "";

        onSaved(latestList, lastSelectedId, true);
        onClose();
        return;
      }

      const result = await createProfileShiftPreferences({
        profileId,
        weekdays: [],
        start_time: null,
        end_time: null,
        ...placement,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const latestList = result.preferences ?? [];
      onSaved(latestList, latestList[0]?.id ?? "", true);
      onClose();
    } catch {
      setError(t("profiles.shiftPreferenceSaveFailed"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setOvernightConfirmOpen(false);

    if (!hasFilledDimension()) {
      setError(t("profiles.shiftPreferenceSelectDimension"));
      return;
    }

    if (!timeEnabled) {
      await performSave(null);
      return;
    }

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
      ? t("profiles.shiftPreferenceCreateTitle")
      : t("profiles.shiftPreferenceEditTitle");

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
          aria-labelledby="profile-shift-preference-form-title"
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
              id="profile-shift-preference-form-title"
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

          <div className="space-y-3 px-4 py-2 sm:px-5 sm:py-3">
            {error && <Alert variant="error">{error}</Alert>}

            <p className="text-center text-xs text-muted sm:text-left">
              {t("profiles.shiftPreferenceFormIntro")}
            </p>

            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {(
                [
                  ["time", "profiles.shiftPreferenceDimensionTime"],
                  ["location", "profiles.shiftPreferenceDimensionLocation"],
                  ["area", "profiles.shiftPreferenceDimensionArea"],
                  ["job", "profiles.shiftPreferenceDimensionJob"],
                ] as const
              ).map(([dimension, labelKey]) => (
                <button
                  key={dimension}
                  type="button"
                  disabled={saving}
                  className={dimensionChipClass(
                    dimension === "time"
                      ? timeEnabled
                      : dimension === "location"
                        ? locationEnabled
                        : dimension === "area"
                          ? areaEnabled
                          : jobEnabled,
                    saving
                  )}
                  onClick={() => toggleDimension(dimension)}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>

            {timeEnabled ? (
              <>
                <div>
                  <LabelMuted className="!mb-0.5 block text-center sm:text-left">
                    {t("profiles.columnWeekday")}
                  </LabelMuted>
                  <WeekdayChipPicker
                    weekdayCount={SERVICE_HOUR_WEEKDAY_COUNT}
                    selected={
                      usesMultiDayPicker ? selectedWeekdays : new Set([weekday])
                    }
                    disabled={saving}
                    disabledWeekdays={disabledWeekdays}
                    getWeekdayTooltip={renderWeekdayAvailabilityTooltip}
                    showPresets={usesMultiDayPicker}
                    onToggle={handleWeekdayToggle}
                    onApplyPreset={applyAvailableWeekdayPreset}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <LabelMuted className="!mb-0.5">{t("profiles.availabilityFrom")}</LabelMuted>
                    <TimeInput
                      value={startTime}
                      disabled={saving || optionsLoading}
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        setError(null);
                      }}
                    />
                  </div>
                  <div>
                    <LabelMuted className="!mb-0.5">{t("profiles.availabilityTo")}</LabelMuted>
                    <TimeInput
                      value={endTime}
                      disabled={saving || optionsLoading}
                      onChange={(e) => {
                        setEndTime(e.target.value);
                        setError(null);
                      }}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {locationEnabled || areaEnabled || jobEnabled ? (
              <div className="grid grid-cols-1 gap-2">
                {locationEnabled ? (
                  <div>
                    <LabelMuted className="!mb-0.5">{t("profiles.shiftPreferenceLocation")}</LabelMuted>
                    <Select
                      value={locationId ?? ""}
                      disabled={saving || optionsLoading}
                      onChange={(event) => {
                        const nextLocationId = event.target.value || null;
                        setLocationId(nextLocationId);
                        if (
                          areaId &&
                          !formOptions?.areas.some(
                            (area) =>
                              area.id === areaId && area.location_id === nextLocationId
                          )
                        ) {
                          setAreaId(null);
                        }
                        setError(null);
                      }}
                    >
                      <option value="">{t("profiles.shiftPreferenceNone")}</option>
                      {(formOptions?.locations ?? []).map((location: Location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
                {areaEnabled ? (
                  <div>
                    <LabelMuted className="!mb-0.5">{t("profiles.shiftPreferenceArea")}</LabelMuted>
                    <Select
                      value={areaId ?? ""}
                      disabled={saving || optionsLoading || !locationId}
                      onChange={(event) => {
                        setAreaId(event.target.value || null);
                        setError(null);
                      }}
                    >
                      <option value="">
                        {!locationId
                          ? t("profiles.shiftPreferenceSelectLocationFirst")
                          : t("profiles.shiftPreferenceNone")}
                      </option>
                      {areasForLocation.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
                {jobEnabled ? (
                  <div>
                    <LabelMuted className="!mb-0.5">{t("profiles.shiftPreferenceJob")}</LabelMuted>
                    <Select
                      value={qualificationId ?? ""}
                      disabled={saving || optionsLoading}
                      onChange={(event) => {
                        setQualificationId(event.target.value || null);
                        setError(null);
                      }}
                    >
                      <option value="">{t("profiles.shiftPreferenceNone")}</option>
                      {(formOptions?.qualifications ?? []).map(
                        (qualification: Qualification) => (
                          <option key={qualification.id} value={qualification.id}>
                            {qualification.name}
                          </option>
                        )
                      )}
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}
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
            aria-labelledby="profile-shift-preference-overnight-desc"
            className={settingsConfirmDialogClass()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p
              id="profile-shift-preference-overnight-desc"
              className="text-sm text-foreground"
            >
              {t("profiles.availabilityOvernightConfirm", {
                range: overnightConfirmRange,
              })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOvernightConfirmOpen(false)}
                disabled={saving}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => void confirmOvernightSave()}
                disabled={saving}
              >
                {t("common.ok")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
