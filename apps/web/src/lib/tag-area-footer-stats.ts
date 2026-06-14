import { calculateEffectiveHourlyRate } from "@/lib/profile-compensation-calculation";
import { shiftHoursFromWindow } from "@/lib/planning-utils";
import { formatDurationHours } from "@/lib/shift-type-display";
import type { EffectiveProfileCompensationSurcharge } from "@schichtwerk/types";

export const DEFAULT_ORGANIZATION_CURRENCY = "EUR";

export type EmployeeShiftCompensationRef = {
  baseHourlyRate: number;
  currency: string;
  surcharges: EffectiveProfileCompensationSurcharge[];
};

export type DashboardShiftCompensationByKey = Record<
  string,
  EmployeeShiftCompensationRef | undefined
>;

export type TagAreaDayFooterStats = {
  totalHours: number;
  totalCost: number;
  currency: string;
};

export type TagAreaShiftRef = {
  employeeId: string;
  shift_date: string;
  startTime: string;
  endTime: string;
};

export function shiftCompensationKey(
  employeeId: string,
  dateISO: string
): string {
  return `${employeeId}:${dateISO}`;
}

export function computeTagAreaDayFooterStats(
  shifts: readonly TagAreaShiftRef[],
  compensationByKey: DashboardShiftCompensationByKey,
  defaultCurrency = DEFAULT_ORGANIZATION_CURRENCY
): TagAreaDayFooterStats {
  let totalHours = 0;
  let totalCost = 0;
  let currency = defaultCurrency;

  for (const shift of shifts) {
    const hours = shiftHoursFromWindow(shift.startTime, shift.endTime);
    totalHours += hours;

    const compensation =
      compensationByKey[
        shiftCompensationKey(shift.employeeId, shift.shift_date)
      ];
    if (!compensation) continue;

    currency = compensation.currency || defaultCurrency;
    const effectiveRate = calculateEffectiveHourlyRate({
      baseHourlyRate: compensation.baseHourlyRate,
      shiftDate: shift.shift_date,
      surcharges: compensation.surcharges,
    });
    totalCost += effectiveRate * hours;
  }

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    totalCost: Math.round(totalCost * 100) / 100,
    currency,
  };
}

export function formatTagAreaFooterMoney(
  amount: number,
  locale: "de" | "en"
): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTagAreaFooterLine(
  stats: TagAreaDayFooterStats,
  translate: (key: string, params?: Record<string, string>) => string,
  locale: "de" | "en"
): string {
  const hoursLabel = translate("dashboard.tagAreaFooterTotalHours", {
    hours: formatDurationHours(stats.totalHours),
  });
  const costLabel = translate("dashboard.tagAreaFooterTotalCost", {
    amount: formatTagAreaFooterMoney(stats.totalCost, locale),
    currency: stats.currency,
  });
  return `${hoursLabel} | ${costLabel}`;
}
