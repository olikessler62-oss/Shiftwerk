"use client";

import { formatDayHeader, formatTimeRange } from "@/lib/planning-utils";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import type { Location, LocationArea } from "@schichtwerk/types";
import {
  requiredStaffForAreaOnDate,
  type StaffingRule,
} from "@/lib/location-staffing-client";
import { LocationSelect } from "./location-select";
import { cn } from "@/lib/cn";

export type DashboardShiftCard = {
  id: string;
  shift_date: string;
  locationAreaId: string | null;
  shiftName: string;
  color: string;
  startTime: string;
  endTime: string;
  employeeName: string;
};

type Props = {
  dates: string[];
  locations: Location[];
  selectedLocationId: string | null;
  selectedLocation: Location | null;
  areas: LocationArea[];
  staffingRules: StaffingRule[];
  shifts: DashboardShiftCard[];
};

export function DashboardCalendar({
  dates,
  locations,
  selectedLocationId,
  selectedLocation,
  areas,
  staffingRules,
  shifts,
}: Props) {
  const { locale } = useLocale();
  const t = useTranslations();
  const intlLocale = toIntlLocale(locale);
  const activeWeekdays = selectedLocation?.active_weekdays ?? "0000000";

  const byAreaDate = new Map<string, DashboardShiftCard[]>();
  for (const shift of shifts) {
    if (!shift.locationAreaId) continue;
    const key = `${shift.locationAreaId}:${shift.shift_date}`;
    const list = byAreaDate.get(key) ?? [];
    list.push(shift);
    byAreaDate.set(key, list);
  }

  const rowCount = Math.max(areas.length, 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="h-full w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="sticky left-0 z-20 min-w-[200px] border-r border-border bg-background px-4 py-3 text-left align-bottom">
                <p className="text-xs font-medium text-muted">{t("dashboard.location")}</p>
                <LocationSelect
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                />
              </th>
              {dates.map((date) => {
                const { weekday, label } = formatDayHeader(date, intlLocale);
                return (
                  <th
                    key={date}
                    className="min-w-[120px] px-2 py-3 text-center align-bottom"
                  >
                    <div className="text-xs font-semibold text-muted">{weekday}</div>
                    <div className="text-sm font-medium">{label}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="h-full">
            {areas.length === 0 ? (
              <tr className="h-full">
                <td
                  colSpan={dates.length + 1}
                  className="px-4 py-12 text-center text-muted"
                >
                  {t("dashboard.noAreas")}
                </td>
              </tr>
            ) : (
              areas.map((area) => (
                <tr
                  key={area.id}
                  className="border-b border-border last:border-0"
                  style={{ height: `${100 / rowCount}%` }}
                >
                  <td className="sticky left-0 z-10 border-r border-border bg-surface px-4 py-3 align-top font-semibold">
                    {area.name}
                    {area.archived_at ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted">
                        ({t("common.archived")})
                      </span>
                    ) : null}
                  </td>
                  {dates.map((date) => {
                    const dayShifts = byAreaDate.get(`${area.id}:${date}`) ?? [];
                    const assigned = dayShifts.length;
                    const required = requiredStaffForAreaOnDate(
                      staffingRules,
                      area.id,
                      date,
                      activeWeekdays
                    );
                    const understaffed = required > 0 && assigned < required;

                    return (
                      <td key={date} className="h-full align-top p-2">
                        <div className="flex h-full min-h-[80px] flex-col gap-1.5">
                          {required > 0 && (
                            <p
                              className={cn(
                                "text-center text-xs font-medium tabular-nums",
                                understaffed ? "text-red-600" : "text-muted"
                              )}
                            >
                              {t("dashboard.staffingCount", {
                                assigned: String(assigned),
                                required: String(required),
                              })}
                            </p>
                          )}
                          <div className="flex flex-1 flex-col gap-1.5">
                            {dayShifts.length === 0 ? (
                              <span className="block flex-1 rounded-lg border border-dashed border-border/60" />
                            ) : (
                              dayShifts.map((shift) => (
                                <div
                                  key={shift.id}
                                  className="rounded-lg px-2.5 py-2 text-white shadow-sm"
                                  style={{ backgroundColor: shift.color }}
                                >
                                  <p className="text-xs font-semibold leading-tight">
                                    {shift.shiftName}{" "}
                                    {formatTimeRange(shift.startTime, shift.endTime)}
                                  </p>
                                  <p className="mt-1 text-xs leading-tight opacity-95">
                                    {shift.employeeName}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
