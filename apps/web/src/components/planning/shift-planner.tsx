"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { assignShift, removeShift } from "@/app/actions/shifts";
import { toISODate, startOfWeek, parseISODate } from "@/lib/dates";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { useTranslations } from "@/i18n/locale-provider";
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
import type { AvailabilityStatus, Profile, Shift, ShiftType } from "@schichtwerk/types";
import {
  Alert,
  Button,
  ControlDisplay,
  Field,
  IconButton,
  Select,
  Textarea,
} from "@/components/ui";

export type ShiftWithType = Shift & {
  shift_types: { name: string; color: string; start_time?: string; end_time?: string } | null;
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
  shiftTypes: ShiftType[];
  shifts: ShiftWithType[];
  availability: AvailabilityRow[];
  orgName: string;
  defaultLocationId: string | null;
  readOnlyWeek?: boolean;
};

type Picker = { employeeId: string; date: string };

export function ShiftPlanner({
  weekStart,
  dates,
  employees,
  shiftTypes,
  shifts,
  availability,
  orgName,
  defaultLocationId,
  readOnlyWeek = false,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    shiftTypes[0]?.id ?? ""
  );
  const [note, setNote] = useState("");

  const shiftMap = useMemo(() => {
    const map = new Map<string, ShiftWithType>();
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
    () => weeklySummary(shifts, shiftTypes, employees),
    [shifts, shiftTypes, employees]
  );

  const warnings = useMemo(
    () => buildPlanningWarnings(employees, shifts, shiftTypes, dates),
    [employees, shifts, shiftTypes, dates]
  );

  const dailyCounts = useMemo(() => {
    return dates.map((date) => {
      const dayShifts = shifts.filter((s) => s.shift_date === date);
      const byType = shiftTypes.map((type) => ({
        type,
        count: dayShifts.filter((s) => s.shift_type_id === type.id).length,
      }));
      return { date, total: dayShifts.length, byType };
    });
  }, [dates, shifts, shiftTypes]);

  const pickerEmployee = picker
    ? employees.find((e) => e.id === picker.employeeId)
    : null;

  function navigateWeek(delta: number) {
    const d = parseISODate(weekStart);
    d.setDate(d.getDate() + delta * 7);
    router.push(`/planung?week=${toISODate(d)}`);
  }

  function isDayReadOnly(date: string) {
    return readOnlyWeek || isPastShiftDate(date);
  }

  function shiftTypeDisplayName(type: ShiftType) {
    if (!type.archived_at) return type.name;
    return `${type.name} (${t("common.archived")})`;
  }

  function openPicker(employeeId: string, date: string) {
    const existing = shiftMap.get(`${employeeId}:${date}`);
    if (isDayReadOnly(date) && !existing) return;
    setPicker({ employeeId, date });
    setError(null);
    if (existing) setSelectedTypeId(existing.shift_type_id);
    else if (shiftTypes[0]) setSelectedTypeId(shiftTypes[0].id);
  }

  function handleAssign() {
    if (!picker || !selectedTypeId || isDayReadOnly(picker.date)) return;
    if (!defaultLocationId) {
      setError("Bitte zuerst einen Standort unter Einstellungen anlegen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await assignShift(
        picker.employeeId,
        picker.date,
        selectedTypeId,
        defaultLocationId
      );
      if (!result.ok) setError(result.error);
      else {
        setPicker(null);
        setNote("");
        router.refresh();
      }
    });
  }

  function handleRemove(shiftId: string) {
    if (picker && isDayReadOnly(picker.date)) return;
    setError(null);
    startTransition(async () => {
      const result = await removeShift(shiftId);
      if (!result.ok) setError(result.error);
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
          Noch keine Mitarbeiter. Lege unter{" "}
          <a href="/team" className="font-medium text-primary">
            Team
          </a>{" "}
          Mitarbeiter an, um den Schichtplan zu erstellen.
        </p>
      </div>
    );
  }

  return (
    <div className="-m-6 flex min-h-[calc(100vh-4.5rem)] flex-col bg-subtle">
      {/* Header */}
      <header className="border-b border-border bg-surface px-6 py-5">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Demnächst verfügbar"
            >
              Vorlage der Vorwoche übernehmen
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Demnächst verfügbar"
            >
              Leeren Plan erstellen
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-6">
          <Field label="Zeitraum" mutedLabel>
            <div className="flex items-center gap-1">
              <IconButton
                onClick={() => navigateWeek(-1)}
                disabled={pending}
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
                  router.push(`/planung?week=${toISODate(startOfWeek(new Date()))}`)
                }
                disabled={pending}
              >
                Nächste Woche
              </Button>
            </div>
          </Field>
          <Field label="Standort" mutedLabel>
            <ControlDisplay className="min-w-[200px] py-2">{orgName}</ControlDisplay>
          </Field>
        </div>
      </header>

      {readOnlyWeek && (
        <Alert variant="info" className="mx-6 mt-4">
          {t("planning.readOnlyWeek")}
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mx-6 mt-4">
          {error}
        </Alert>
      )}

      {/* Main layout */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-border bg-surface p-4">
          <SidebarSection title="Schichten">
            <ul className="space-y-2">
              {shiftTypes.map((type) => (
                <li
                  key={type.id}
                  className="rounded-lg border border-border bg-background p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="text-sm font-medium">
                      {shiftTypeDisplayName(type)}
                    </span>
                  </div>
                  <p className="mt-1 pl-4.5 text-xs text-muted">
                    {formatTimeRange(type.start_time, type.end_time)}
                  </p>
                  <p className="pl-4.5 text-xs text-muted">
                    {shiftHours(type)} h · Pause 30 Min
                  </p>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="mt-3 w-full border-dashed text-xs opacity-60"
            >
              + Schicht hinzufügen
            </Button>
          </SidebarSection>

          <SidebarSection title="Verfügbarkeit" className="mt-6">
            <LegendDot color="#22c55e" label="Verfügbar" />
            <LegendDot color="#eab308" label="Wunschfrei" />
            <LegendDot color="#ef4444" label="Nicht verfügbar" />
            <LegendDot color="#94a3b8" label="Urlaub / Abwesend" />
          </SidebarSection>
        </aside>

        {/* Grid */}
        <main className="min-w-0 flex-1 overflow-auto p-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="sticky left-0 z-20 min-w-[200px] bg-background px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Mitarbeiter
                  </th>
                  {dates.map((date) => {
                    const { weekday, label } = formatDayHeader(date);
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
                  const weekH = employeeWeekHours(emp.id, shifts, shiftTypes);
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
                        const isSelected =
                          picker?.employeeId === emp.id && picker?.date === date;
                        const dayReadOnly = isDayReadOnly(date);

                        if (shift?.shift_types) {
                          const type = shiftTypes.find(
                            (st) => st.id === shift.shift_type_id
                          );
                          return (
                            <td key={date} className="p-1.5 align-top">
                              <button
                                type="button"
                                disabled={pending || (dayReadOnly && !shift)}
                                onClick={() => openPicker(emp.id, date)}
                                className={`w-full rounded-lg px-2 py-2 text-left text-white transition hover:opacity-90 disabled:opacity-50 ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
                                style={{
                                  backgroundColor: shift.shift_types.color,
                                }}
                              >
                                <div className="text-xs font-semibold leading-tight">
                                  {type
                                    ? shiftTypeDisplayName(type)
                                    : shift.shift_types.name}
                                </div>
                                {type && (
                                  <div className="mt-0.5 text-[10px] opacity-90">
                                    {formatTimeRange(type.start_time, type.end_time)}
                                  </div>
                                )}
                              </button>
                            </td>
                          );
                        }

                        if (avail === "unavailable") {
                          return (
                            <td key={date} className="p-1.5 align-top">
                              <div className="flex h-[52px] items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
                                Nicht verfügbar
                              </div>
                            </td>
                          );
                        }

                        if (avail === "preferred") {
                          return (
                            <td key={date} className="p-1.5 align-top">
                              <div className="flex h-[52px] items-center justify-center rounded-lg bg-amber-50 text-xs font-medium text-amber-700">
                                Wunschfrei
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={date} className="p-1.5 align-top">
                            <button
                              type="button"
                              disabled={
                                pending ||
                                shiftTypes.length === 0 ||
                                dayReadOnly
                              }
                              onClick={() => openPicker(emp.id, date)}
                              className={`flex h-[52px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-border text-muted transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-40 ${isSelected ? "border-primary bg-primary/5 text-primary" : ""}`}
                            >
                              <span className="text-lg leading-none">+</span>
                              <span className="text-[10px]">Frei</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Tagesbedarf row */}
                <tr className="border-t-2 border-border bg-background">
                  <td className="sticky left-0 z-10 bg-background px-4 py-3 text-xs font-semibold text-muted">
                    Tagesbedarf
                  </td>
                  {dailyCounts.map(({ date, total, byType }) => {
                    const staffed = total >= Math.min(employees.length, 3);
                    return (
                      <td key={date} className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${staffed ? "bg-green-500" : "bg-red-500"}`}
                          />
                          <span className="text-xs font-medium">{total}</span>
                          {byType.slice(0, 2).map(({ type, count }) => (
                            <span key={type.id} className="text-[10px] text-muted">
                              {type.name.slice(0, 4)} {count}
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

        {/* Right sidebar — assign panel */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Schicht zuweisen</h2>

          {picker && pickerEmployee ? (
            <div className="mt-4 space-y-4">
              {isDayReadOnly(picker.date) && (
                <p className="text-xs text-muted">{t("planning.readOnlyDay")}</p>
              )}
              <div className="rounded-[var(--radius-control)] bg-subtle px-3 py-2 text-sm">
                <span className="text-muted">Datum: </span>
                <span className="font-medium">
                  {new Intl.DateTimeFormat("de-DE", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(parseISODate(picker.date))}
                </span>
              </div>

              <Field label="Schicht">
                <Select
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  disabled={isDayReadOnly(picker.date)}
                >
                  {shiftTypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {shiftTypeDisplayName(st)} (
                      {formatTimeRange(st.start_time, st.end_time)})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Mitarbeiter">
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

              <Field label="Notiz (optional)">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  disabled={isDayReadOnly(picker.date)}
                  placeholder="z. B. Einarbeitung, Vertretung …"
                />
              </Field>

              {!isDayReadOnly(picker.date) && (
                <Button
                  type="button"
                  className="w-full"
                  disabled={pending || !selectedTypeId}
                  onClick={handleAssign}
                >
                  Schicht zuweisen
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
                  Schicht entfernen
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted"
                onClick={() => setPicker(null)}
              >
                Abbrechen
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Wählen Sie eine freie Zelle im Plan aus, um eine Schicht zuzuweisen.
            </p>
          )}
        </aside>
      </div>

      {/* Footer panels */}
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
            <ActionLink disabled>Mitarbeiter benachrichtigen</ActionLink>
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
