"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { assignShiftWithTimes, removeShift } from "@/app/actions/shifts";
import { toISODate, startOfWeek, parseISODate } from "@/lib/dates";
import { isPlanningWeekAtEarliest } from "@schichtwerk/database";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { useOrgFeatures } from "@/lib/org-features-provider";
import { translateActionError } from "@/lib/translate-action-error";
import { toIntlLocale } from "@/i18n/intl-locale";
import {
  avatarColor,
  buildPlanningWarnings,
  employeeWeekHours,
  formatDayHeader,
  formatTimeRange,
  formatWeekRange,
  initials,
  shiftHours,
  weeklySummary,
} from "@/lib/planning-utils";
import {
  areaShiftTemplatesForArea,
  dashboardAssignmentPresetsForArea,
  resolvePresetIdFromTimes,
  areaShiftTemplateIdForAssign,
  type DashboardAssignmentPreset,
} from "@/lib/dashboard-assignment-presets";
import { validateDashboardShiftServiceHours } from "@/lib/service-hours-shift-validation";
import {
  areDashboardShiftTimesComplete,
  profileAvailabilityWeekdayFromDashboardDate,
} from "@/lib/available-employees-for-shift";
import {
  employeeHasRecurringAvailabilityOnWeekday,
  employeeMatchesShiftAvailability,
  isEmployeeAbsentOnDate,
} from "@schichtwerk/database";
import type { AreaServiceHourRef } from "@/lib/location-staffing-client";
import type {
  AbsenceRequest,
  AreaShiftTemplateWithBreaks,
  AvailabilityStatus,
  Location,
  LocationArea,
  Profile,
  ProfileRecurringAvailability,
} from "@schichtwerk/types";
import { LocationSelect } from "@/components/dashboard/location-select";
import {
  DashboardShiftTypeCombobox,
} from "@/components/dashboard/dashboard-add-shift-modal";
import {
  Alert,
  Button,
  ControlDisplay,
  Field,
  IconButton,
  Select,
  Textarea,
  TimeInput,
  LabelMuted,
} from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";

export type PlanningShift = {
  id: string;
  employee_id: string;
  shift_date: string;
  shiftName: string;
  color: string;
  startTime: string;
  endTime: string;
};

type AvailabilityRow = {
  employee_id: string;
  available_date: string;
  status: AvailabilityStatus;
};

type Props = {
  weekStart: string;
  dates: string[];
  employees: Profile[];
  shifts: PlanningShift[];
  availability: AvailabilityRow[];
  recurringAvailability: ProfileRecurringAvailability[];
  absences: AbsenceRequest[];
  locations: Location[];
  selectedLocationId: string | null;
  areas: LocationArea[];
  selectedAreaId: string | null;
  areaShiftTemplates: AreaShiftTemplateWithBreaks[];
  serviceHours: AreaServiceHourRef[];
  readOnlyWeek?: boolean;
};

type Picker = { employeeId: string; date: string };

type DayAssignBlockReason = "absent" | "no_availability";

function getDayAssignBlockReason(
  employeeId: string,
  date: string,
  recurringAvailability: ProfileRecurringAvailability[],
  absences: AbsenceRequest[]
): DayAssignBlockReason | null {
  if (isEmployeeAbsentOnDate(employeeId, absences, date)) return "absent";
  const weekday = profileAvailabilityWeekdayFromDashboardDate(date);
  if (
    !employeeHasRecurringAvailabilityOnWeekday(
      employeeId,
      recurringAvailability,
      weekday
    )
  ) {
    return "no_availability";
  }
  return null;
}

function timeFieldValue(time: string): string {
  return time.slice(0, 5);
}

export function ShiftPlanner({
  weekStart,
  dates,
  employees,
  shifts,
  availability,
  recurringAvailability,
  absences,
  locations,
  selectedLocationId,
  areas,
  selectedAreaId,
  areaShiftTemplates,
  serviceHours,
  readOnlyWeek = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const features = useOrgFeatures();
  const atEarliestWeek = isPlanningWeekAtEarliest(weekStart);
  const simplePlanning = !features.areas;
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [complianceNotice, setComplianceNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:00");
  const [note, setNote] = useState("");
  const skipPresetFromTimesSyncRef = useRef(false);

  const templatesForArea = useMemo(
    () =>
      selectedAreaId
        ? areaShiftTemplatesForArea(selectedAreaId, areaShiftTemplates)
        : [],
    [areaShiftTemplates, selectedAreaId]
  );

  const assignmentPresets = useMemo(
    () => dashboardAssignmentPresetsForArea(templatesForArea),
    [templatesForArea]
  );

  const timesComplete = areDashboardShiftTimesComplete(startTime, endTime);

  const shiftMap = useMemo(() => {
    const map = new Map<string, PlanningShift>();
    for (const s of shifts) map.set(`${s.employee_id}:${s.shift_date}`, s);
    return map;
  }, [shifts]);

  const availabilityMap = useMemo(() => {
    const map = new Map<string, AvailabilityStatus>();
    for (const a of availability) {
      map.set(`${a.employee_id}:${a.available_date}`, a.status);
    }
    return map;
  }, [availability]);

  const summary = useMemo(
    () => weeklySummary(shifts, employees),
    [shifts, employees]
  );

  const warnings = useMemo(
    () => buildPlanningWarnings(employees, shifts, dates),
    [employees, shifts, dates]
  );

  const dailyCounts = useMemo(() => {
    return dates.map((date) => {
      const dayShifts = shifts.filter((s) => s.shift_date === date);
      const byPreset = assignmentPresets.map((preset) => ({
        preset,
        count: dayShifts.filter(
          (shift) =>
            resolvePresetIdFromTimes(
              shift.startTime,
              shift.endTime,
              assignmentPresets
            ) === preset.id
        ).length,
      }));
      return { date, total: dayShifts.length, byPreset };
    });
  }, [dates, shifts, assignmentPresets]);

  const pickerEmployee = picker
    ? employees.find((e) => e.id === picker.employeeId)
    : null;

  const pushPlanungQuery = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      router.push(`/planung?${params.toString()}`);
    },
    [router, searchParams]
  );

  function navigateWeek(delta: number) {
    if (delta < 0 && atEarliestWeek) return;
    const d = parseISODate(weekStart);
    d.setDate(d.getDate() + delta * 7);
    pushPlanungQuery({ week: toISODate(d) });
  }

  function isDayReadOnly(date: string) {
    return readOnlyWeek || isPastShiftDate(date);
  }

  function applyPreset(preset: DashboardAssignmentPreset) {
    setSelectedPresetId(preset.id);
    setStartTime(timeFieldValue(preset.start_time));
    setEndTime(timeFieldValue(preset.end_time));
  }

  function openPicker(employeeId: string, date: string) {
    const existing = shiftMap.get(`${employeeId}:${date}`);
    if (isDayReadOnly(date) && !existing) return;
    if (
      !existing &&
      getDayAssignBlockReason(employeeId, date, recurringAvailability, absences)
    ) {
      return;
    }
    setPicker({ employeeId, date });
    setError(null);
    if (existing) {
      setStartTime(existing.startTime);
      setEndTime(existing.endTime);
      const matchedPresetId =
        resolvePresetIdFromTimes(
          existing.startTime,
          existing.endTime,
          assignmentPresets
        ) ?? "";
      setSelectedPresetId(matchedPresetId);
    } else if (assignmentPresets[0]) {
      applyPreset(assignmentPresets[0]);
    } else {
      setSelectedPresetId("");
      setStartTime("00:00");
      setEndTime("00:00");
    }
  }

  useEffect(() => {
    if (skipPresetFromTimesSyncRef.current) {
      skipPresetFromTimesSyncRef.current = false;
      return;
    }
    if (!timesComplete) {
      if (selectedPresetId) setSelectedPresetId("");
      return;
    }
    const matchedPresetId = resolvePresetIdFromTimes(
      startTime,
      endTime,
      assignmentPresets
    );
    if (matchedPresetId !== selectedPresetId) {
      setSelectedPresetId(matchedPresetId ?? "");
    }
  }, [startTime, endTime, assignmentPresets, selectedPresetId, timesComplete]);

  function handlePresetChange(presetId: string) {
    const preset = assignmentPresets.find((entry) => entry.id === presetId);
    if (preset) {
      skipPresetFromTimesSyncRef.current = true;
      applyPreset(preset);
    } else {
      setSelectedPresetId(presetId);
    }
  }

  function handleAssign() {
    if (!picker || isDayReadOnly(picker.date)) return;
    if (!selectedLocationId) {
      setError(t("dashboard.noLocations"));
      return;
    }
    if (!simplePlanning && !selectedAreaId) {
      setError(t("planning.noAreas"));
      return;
    }
    if (!timesComplete) {
      setError(t("dashboard.bulkShiftValidationTimesRequired"));
      return;
    }

    if (!simplePlanning) {
      const serviceHoursCheck = validateDashboardShiftServiceHours(
        serviceHours,
        selectedAreaId!,
        picker.date,
        startTime,
        endTime
      );
      if (!serviceHoursCheck.ok) {
        setError(translateActionError(serviceHoursCheck.error, t));
        return;
      }
    }

    const weekday = profileAvailabilityWeekdayFromDashboardDate(picker.date);
    if (isEmployeeAbsentOnDate(picker.employeeId, absences, picker.date)) {
      setError(t("shiftAssign.employeeAbsent"));
      return;
    }
    if (
      !employeeMatchesShiftAvailability(
        picker.employeeId,
        recurringAvailability,
        weekday,
        startTime,
        endTime
      )
    ) {
      setError(t("shiftAssign.shiftOutsideAvailability"));
      return;
    }

    setError(null);
    setComplianceNotice(null);
    startTransition(async () => {
      const result = await assignShiftWithTimes({
        employeeId: picker.employeeId,
        shiftDate: picker.date,
        startTime,
        endTime,
        areaShiftTemplateId: simplePlanning
          ? null
          : areaShiftTemplateIdForAssign(selectedPresetId),
        locationId: selectedLocationId,
        locationAreaId: simplePlanning ? null : selectedAreaId,
      });
      if (!result.ok) {
        setError(translateActionError(result.error, t));
        setComplianceNotice(null);
        return;
      }
      setPicker(null);
      setNote("");
      router.refresh();
      if (result.warnings?.length) {
        setComplianceNotice(result.warnings.join(" "));
      }
    });
  }

  function handleRemove(shiftId: string) {
    if (picker && isDayReadOnly(picker.date)) return;
    setError(null);
    startTransition(async () => {
      const result = await removeShift(shiftId);
      if (!result.ok) setError(translateActionError(result.error, t));
      else {
        setPicker(null);
        router.refresh();
      }
    });
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-muted">
          {t("planning.noEmployeesPrefix")}{" "}
          <a href="/dashboard?profiles=1" className="font-medium text-primary">
            {t("planning.noEmployeesProfilesLink")}
          </a>{" "}
          {t("planning.noEmployeesSuffix")}
        </p>
      </div>
    );
  }

  const canAssign =
    Boolean(selectedLocationId) &&
    (simplePlanning ||
      (Boolean(selectedAreaId) && assignmentPresets.length > 0));

  return (
    <div className="-m-4 flex min-h-[calc(100vh-4.5rem)] flex-col bg-subtle md:-m-6">
      <header className="border-b border-border bg-surface px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Schichtplan erstellen
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              Erstellen Sie den Schichtplan für die nächste Woche.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip content="Demnächst verfügbar">
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                >
                  Vorlage der Vorwoche übernehmen
                </Button>
              </span>
            </Tooltip>
            <Tooltip content="Demnächst verfügbar">
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                >
                  Leeren Plan erstellen
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-6">
          <Field label="Zeitraum" mutedLabel>
            <div className="flex items-center gap-1">
              <IconButton
                onClick={() => navigateWeek(-1)}
                disabled={pending || atEarliestWeek}
                aria-label="Vorherige Woche"
              >
                ‹
              </IconButton>
              <ControlDisplay className="min-w-[220px] py-2">
                {formatWeekRange(weekStart)}
              </ControlDisplay>
              <IconButton
                onClick={() => navigateWeek(1)}
                disabled={pending}
                aria-label="Nächste Woche"
              >
                ›
              </IconButton>
              <Button
                type="button"
                size="sm"
                className="ml-1"
                onClick={() =>
                  pushPlanungQuery({
                    week: toISODate(startOfWeek(new Date())),
                  })
                }
                disabled={pending}
              >
                Nächste Woche
              </Button>
            </div>
          </Field>
          {features.areas ? (
            <>
              <Field label={t("dashboard.location")} mutedLabel>
                <LocationSelect
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                  basePath="/planung"
                  className="min-w-[200px] py-2"
                />
              </Field>
              <Field label={t("planning.area")} mutedLabel>
                {areas.length === 0 ? (
                  <ControlDisplay className="min-w-[200px] py-2 text-muted">
                    {t("planning.noAreas")}
                  </ControlDisplay>
                ) : (
                  <Select
                    value={selectedAreaId ?? areas[0].id}
                    disabled={pending || areas.length === 0}
                    aria-label={t("planning.selectArea")}
                    className="min-w-[200px]"
                    onChange={(event) =>
                      pushPlanungQuery({ area: event.target.value })
                    }
                  >
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                        {area.archived_at ? ` (${t("common.archived")})` : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </>
          ) : null}
        </div>
      </header>

      {readOnlyWeek && (
        <Alert variant="info" className="mx-4 mt-4 md:mx-6">
          {t("planning.readOnlyWeek")}
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mx-4 mt-4 md:mx-6">
          {error}
        </Alert>
      )}

      {complianceNotice && (
        <Alert variant="info" className="mx-4 mt-4 md:mx-6">
          {complianceNotice}
        </Alert>
      )}

      <div className="flex flex-1 flex-col gap-0 overflow-hidden xl:flex-row">
        <aside className="hidden shrink-0 overflow-y-auto border-b border-border bg-surface p-4 xl:block xl:w-56 xl:border-b-0 xl:border-r">
          {!simplePlanning ? (
            <SidebarSection title={t("dashboard.shiftTemplateLabel")}>
              {assignmentPresets.length === 0 ? (
                <p className="text-xs text-muted">
                  {t("dashboard.noShiftTemplatesForArea")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {assignmentPresets.map((preset) => (
                    <li
                      key={preset.id}
                      className="rounded-lg border border-border bg-background p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span className="text-sm font-medium">{preset.name}</span>
                      </div>
                      <p className="mt-1 pl-4.5 text-xs text-muted">
                        {formatTimeRange(preset.start_time, preset.end_time)}
                      </p>
                      <p className="pl-4.5 text-xs text-muted">
                        {shiftHours({
                          start_time: preset.start_time,
                          end_time: preset.end_time,
                        })}{" "}
                        h
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SidebarSection>
          ) : null}

          <SidebarSection title={t("planning.legendAvailability")} className={simplePlanning ? "" : "mt-6"}>
            <LegendDot color="#22c55e" label={t("planning.legendAvailable")} />
            <LegendDot color="#eab308" label={t("planning.legendPreferred")} />
            <LegendDot color="#ef4444" label={t("planning.legendUnavailable")} />
            <LegendDot color="#94a3b8" label={t("planning.legendAbsent")} />
          </SidebarSection>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto p-3 md:p-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="sticky left-0 z-20 min-w-[200px] bg-background px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    {t("planning.staffColumn")}
                  </th>
                  {dates.map((date) => {
                    const { weekday, label } = formatDayHeader(date, intlLocale);
                    return (
                      <th
                        key={date}
                        className="min-w-[110px] px-2 py-3 text-center"
                      >
                        <div className="text-xs font-semibold text-muted">
                          {weekday}
                        </div>
                        <div className="text-sm font-medium">{label}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const weekH = employeeWeekHours(emp.id, shifts);
                  const targetH = emp.weekly_hours ?? 40;
                  const overHours = weekH > targetH;

                  return (
                    <tr
                      key={emp.id}
                      className="border-b border-border last:border-0 hover:bg-hover"
                    >
                      <td className="sticky left-0 z-10 border-r border-border bg-surface px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: avatarColor(emp.full_name) }}
                          >
                            {initials(emp.full_name)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {emp.full_name}
                            </div>
                            <div className="text-xs text-muted">Mitarbeiter</div>
                            <div
                              className={`text-xs ${overHours ? "font-medium text-amber-600" : "text-muted"}`}
                            >
                              {weekH} h / {targetH} h
                            </div>
                          </div>
                        </div>
                      </td>
                      {dates.map((date) => {
                        const key = `${emp.id}:${date}`;
                        const shift = shiftMap.get(key);
                        const avail = availabilityMap.get(key);
                        const blockReason = shift
                          ? null
                          : getDayAssignBlockReason(
                              emp.id,
                              date,
                              recurringAvailability,
                              absences
                            );
                        const isSelected =
                          picker?.employeeId === emp.id && picker?.date === date;
                        const dayReadOnly = isDayReadOnly(date);

                        if (shift) {
                          return (
                            <td key={date} className="p-1.5 align-top">
                              <button
                                type="button"
                                disabled={pending || (dayReadOnly && !shift)}
                                onClick={() => openPicker(emp.id, date)}
                                className={`w-full rounded-lg px-2 py-2 text-left text-white transition hover:opacity-90 disabled:opacity-50 ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
                                style={{ backgroundColor: shift.color }}
                              >
                                <div className="text-xs font-semibold leading-tight">
                                  {shift.shiftName || formatTimeRange(shift.startTime, shift.endTime)}
                                </div>
                                <div className="mt-0.5 text-[10px] opacity-90">
                                  {formatTimeRange(shift.startTime, shift.endTime)}
                                </div>
                              </button>
                            </td>
                          );
                        }

                        if (blockReason === "absent") {
                          return (
                            <td key={date} className="p-1.5 align-top">
                              <div className="flex h-[52px] items-center justify-center rounded-lg bg-rose-50 text-xs font-medium text-rose-700">
                                {t("planning.cellAbsent")}
                              </div>
                            </td>
                          );
                        }

                        if (blockReason === "no_availability") {
                          return (
                            <td key={date} className="p-1.5 align-top">
                              <div className="flex h-[52px] items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
                                {t("planning.cellNoAvailability")}
                              </div>
                            </td>
                          );
                        }

                        if (avail === "unavailable") {
                          return (
                            <td key={date} className="p-1.5 align-top">
                              <div className="flex h-[52px] items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
                                {t("planning.cellUnavailable")}
                              </div>
                            </td>
                          );
                        }

                        if (avail === "preferred") {
                          return (
                            <td key={date} className="p-1.5 align-top">
                              <div className="flex h-[52px] items-center justify-center rounded-lg bg-amber-50 text-xs font-medium text-amber-700">
                                {t("planning.cellPreferred")}
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={date} className="p-1.5 align-top">
                            <button
                              type="button"
                              disabled={pending || !canAssign || dayReadOnly}
                              onClick={() => openPicker(emp.id, date)}
                              className={`flex h-[52px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-border text-muted transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-40 ${isSelected ? "border-primary bg-primary/5 text-primary" : ""}`}
                            >
                              <span className="text-lg leading-none">+</span>
                              <span className="text-[10px]">{t("planning.cellFree")}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                <tr className="border-t-2 border-border bg-background">
                  <td className="sticky left-0 z-10 bg-background px-4 py-3 text-xs font-semibold text-muted">
                    Tagesbedarf
                  </td>
                  {dailyCounts.map(({ date, total, byPreset }) => {
                    const staffed = total >= Math.min(employees.length, 3);
                    return (
                      <td key={date} className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${staffed ? "bg-green-500" : "bg-red-500"}`}
                          />
                          <span className="text-xs font-medium">{total}</span>
                          {byPreset.slice(0, 2).map(({ preset, count }) => (
                            <span key={preset.id} className="text-[10px] text-muted">
                              {preset.name.slice(0, 4)} {count}
                            </span>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </main>

        <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-surface p-4 xl:w-72 xl:border-t-0 xl:border-l">
          <h2 className="text-sm font-semibold">{t("planning.assignTitle")}</h2>

          {picker && pickerEmployee ? (
            <div className="mt-4 space-y-4">
              {isDayReadOnly(picker.date) && (
                <p className="text-xs text-muted">{t("planning.readOnlyDay")}</p>
              )}
              {!simplePlanning && assignmentPresets.length === 0 ? (
                <Alert variant="info">{t("dashboard.noShiftTemplatesForArea")}</Alert>
              ) : null}

              <div className="rounded-[var(--radius-control)] bg-subtle px-3 py-2 text-sm">
                <span className="text-muted">{t("planning.assignDateLabel")}: </span>
                <span className="font-medium">
                  {new Intl.DateTimeFormat(intlLocale, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(parseISODate(picker.date))}
                </span>
              </div>

              {!simplePlanning ? (
                <div>
                  <LabelMuted>{t("dashboard.shiftTemplateLabel")}</LabelMuted>
                  <DashboardShiftTypeCombobox
                    value={selectedPresetId}
                    presets={assignmentPresets}
                    placeholder={t("dashboard.selectShiftTemplate")}
                    disabled={
                      isDayReadOnly(picker.date) || assignmentPresets.length === 0
                    }
                    onChange={handlePresetChange}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <LabelMuted>{t("shiftTypes.timeFrom")}</LabelMuted>
                  <TimeInput
                    className="mt-1"
                    value={startTime}
                    disabled={isDayReadOnly(picker.date)}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </div>
                <div>
                  <LabelMuted>{t("shiftTypes.timeTo")}</LabelMuted>
                  <TimeInput
                    className="mt-1"
                    value={endTime}
                    disabled={isDayReadOnly(picker.date)}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </div>
              </div>

              <Field label="Personal">
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  <label className="flex cursor-pointer items-center gap-2 border-b border-border bg-primary/5 px-3 py-2.5">
                    <input type="radio" checked readOnly className="accent-primary" />
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{
                        backgroundColor: avatarColor(pickerEmployee.full_name),
                      }}
                    >
                      {initials(pickerEmployee.full_name)}
                    </span>
                    <span className="text-sm font-medium">
                      {pickerEmployee.full_name}
                    </span>
                  </label>
                </div>
              </Field>

              <Field label={t("planning.assignNoteLabel")}>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  disabled={isDayReadOnly(picker.date)}
                  placeholder={t("planning.assignNotePlaceholder")}
                />
              </Field>

              {!isDayReadOnly(picker.date) && (
                <Button
                  type="button"
                  className="w-full"
                  disabled={pending || !timesComplete || !canAssign}
                  onClick={handleAssign}
                >
                  {t("planning.assignSubmit")}
                </Button>
              )}

              {shiftMap.get(`${picker.employeeId}:${picker.date}`) &&
                !isDayReadOnly(picker.date) && (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={pending}
                  onClick={() => {
                    const shift = shiftMap.get(`${picker.employeeId}:${picker.date}`);
                    if (shift) handleRemove(shift.id);
                  }}
                >
                  {t("planning.assignRemove")}
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted"
                onClick={() => setPicker(null)}
              >
                {t("planning.assignCancel")}
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              {t("planning.assignPickCellHint")}
            </p>
          )}
        </aside>
      </div>

      <footer className="grid gap-4 border-t border-border bg-surface p-4 lg:grid-cols-3">
        <FooterPanel title="Wochenzusammenfassung">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Geplante Stunden" value={`${summary.plannedHours} h`} />
            <Stat label="Gesamtstunden Soll" value={`${summary.targetHours} h`} />
            <Stat label="Offene Schichten" value={String(summary.openShifts)} />
            <Stat
              label="Geschätzte Personalkosten"
              value={`${summary.estimatedCost} €`}
            />
          </div>
        </FooterPanel>

        <FooterPanel title="Warnungen">
          {warnings.length === 0 ? (
            <p className="text-sm text-muted">Keine Warnungen für diese Woche.</p>
          ) : (
            <ul className="space-y-2">
              {warnings.map((w) => (
                <li
                  key={w.id}
                  className="flex gap-2 text-sm text-amber-800"
                >
                  <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
                  {w.message}
                </li>
              ))}
            </ul>
          )}
        </FooterPanel>

        <FooterPanel title="Aktionen">
          <div className="space-y-2">
            <ActionLink disabled>PDF exportieren</ActionLink>
            <ActionLink disabled>Excel exportieren</ActionLink>
            <ActionLink disabled>Personal benachrichtigen</ActionLink>
          </div>
        </FooterPanel>
      </footer>
    </div>
  );
}

function SidebarSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs text-muted">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </div>
  );
}

function FooterPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function ActionLink({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="block cursor-not-allowed text-sm text-muted opacity-60">
        {children}
      </span>
    );
  }
  return (
    <Button type="button" variant="ghost" size="sm" className="h-auto justify-start px-0 text-primary">
      {children}
    </Button>
  );
}

/** @deprecated Use ShiftPlanner */
export const WeekCalendar = ShiftPlanner;