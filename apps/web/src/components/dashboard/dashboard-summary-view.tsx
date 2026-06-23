"use client";

import { useMemo } from "react";
import { Alert } from "@/components/ui";
import { SettingsModalsLayer } from "@/components/settings/settings-modals-layer";
import { SETTINGS_MODALS_ON_CURRENT_PAGE } from "@/lib/settings-modal-config";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { formatDayHeader } from "@/lib/planning-utils";
import {
  APP_SHELL_CONTENT_OFFSET_CLASS,
} from "@/lib/app-shell-layout";
import { useClearMainNavPendingWhenReady } from "@/lib/app-shell-main-nav-pending";
import type { DashboardSummaryShift } from "@/lib/dashboard-summary-data";
import type {
  CompensationSurchargeType,
  Location,
  Profile,
  Role,
} from "@schichtwerk/types";

/** Spalten: Zeit | Schicht | Bereich | Personal — Breite am Inhalt, rechts Platz für weitere Listen. */
const SUMMARY_SHIFT_GRID_CLASS =
  "grid w-max max-w-full grid-cols-[8rem_minmax(0,5.5rem)_minmax(0,6rem)_minmax(9rem,13rem)] items-baseline gap-x-2 pr-4 text-sm";

type Props = {
  weekStart: string;
  dates: string[];
  locations: Location[];
  selectedLocationId: string | null;
  shifts: DashboardSummaryShift[];
  readOnlyWeek?: boolean;
  settingsModals?: {
    profiles: Profile[];
    roles: Role[];
    compensationSurchargeTypes: CompensationSurchargeType[];
  };
};

export function DashboardSummaryView({
  weekStart,
  dates,
  locations,
  selectedLocationId,
  shifts,
  readOnlyWeek = false,
  settingsModals,
}: Props) {
  const { locale } = useLocale();
  const t = useTranslations();
  const intlLocale = toIntlLocale(locale);

  useClearMainNavPendingWhenReady(true);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, DashboardSummaryShift[]>();
    for (const date of dates) {
      map.set(date, []);
    }
    for (const shift of shifts) {
      const bucket = map.get(shift.shiftDate);
      if (bucket) bucket.push(shift);
    }
    return map;
  }, [dates, shifts]);

  return (
    <>
      {readOnlyWeek ? (
        <Alert variant="info" className="mx-4 mt-4 md:mx-6">
          {t("dashboard.readOnlyWeek")}
        </Alert>
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col px-4 pb-6 md:px-6",
          APP_SHELL_CONTENT_OFFSET_CLASS
        )}
      >
        {locations.length === 0 ? (
          <p className="text-sm text-muted">{t("areaCalendar.noLocations")}</p>
        ) : shifts.length === 0 ? (
          <p className="text-sm text-muted">{t("dashboard.summaryEmpty")}</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {dates.map((date) => {
              const dayShifts = shiftsByDate.get(date) ?? [];
              if (dayShifts.length === 0) return null;
              const dayHeader = formatDayHeader(date, intlLocale, "long");
              return (
                <section
                  key={date}
                  className="w-fit max-w-full rounded-xl border border-border bg-surface"
                >
                  <header className="border-b border-border px-4 py-2.5">
                    <h2 className="text-sm font-semibold text-foreground">
                      {dayHeader.weekday}
                      <span className="ml-2 font-normal text-muted">
                        {dayHeader.label}
                      </span>
                    </h2>
                  </header>
                  <div className="px-4 py-2">
                    <div
                      className={cn(
                        SUMMARY_SHIFT_GRID_CLASS,
                        "pb-1.5 text-xs font-medium uppercase tracking-wide text-muted"
                      )}
                      role="row"
                    >
                      <span role="columnheader">{t("dashboard.summaryColumnTime")}</span>
                      <span role="columnheader">{t("dashboard.summaryColumnShift")}</span>
                      <span role="columnheader">{t("dashboard.area")}</span>
                      <span role="columnheader">{t("dashboard.staffColumn")}</span>
                    </div>
                    <ul className="flex flex-col gap-1" role="rowgroup">
                      {dayShifts.map((shift) => (
                        <li
                          key={shift.id}
                          className={SUMMARY_SHIFT_GRID_CLASS}
                          role="row"
                        >
                          <span
                            className="shrink-0 whitespace-nowrap tabular-nums text-muted"
                            role="cell"
                          >
                            {shift.timeRange}
                          </span>
                          <span className="min-w-0 truncate text-muted" role="cell">
                            {shift.shiftName}
                          </span>
                          <span className="min-w-0 truncate text-muted" role="cell">
                            {shift.areaName}
                          </span>
                          <span
                            className="min-w-0 truncate font-medium text-foreground"
                            role="cell"
                          >
                            {shift.employeeName}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {SETTINGS_MODALS_ON_CURRENT_PAGE && settingsModals ? (
        <SettingsModalsLayer
          data={{
            locations,
            selectedLocationId,
            areas: [],
            serviceHours: [],
            fullStaffingRules: [],
            areaShiftTemplates: [],
            qualifications: [],
            compensationSurchargeTypes: settingsModals.compensationSurchargeTypes,
            roles: settingsModals.roles,
            profiles: settingsModals.profiles,
          }}
        />
      ) : null}
    </>
  );
}
