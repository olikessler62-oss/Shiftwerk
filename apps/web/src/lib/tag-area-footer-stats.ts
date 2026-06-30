import {
  calculateSurchargeAdditionPerHour,
  surchargeTriggerMatchesDate,
} from "@/lib/profile-compensation-calculation";
import {
  resolveShiftWorkBreaks,
  type ShiftWorkHoursRef,
} from "@/lib/shift-work-hours";
import { splitShiftWindowIntoCalendarDayNetWorkSegments, splitShiftWindowIntoCalendarDaySegments } from "@schichtwerk/database";
import { formatDurationHours } from "@/lib/shift-type-display";
import type {
  AreaShiftTemplateWithBreaks,
  EffectiveProfileCompensationSurcharge,
} from "@schichtwerk/types";
import type { ShiftTypeBreakInput } from "@schichtwerk/database";

export const DEFAULT_ORGANIZATION_CURRENCY = "EUR";

export type EmployeeShiftCompensationRef = {
  baseHourlyRate: number;
  currency: string;
  surcharges: EffectiveProfileCompensationSurcharge[];
};

export type AreaCalendarShiftCompensationByKey = Record<
  string,
  EmployeeShiftCompensationRef | undefined
>;

export type TagAreaDayFooterStats = {
  /** Brutto-Schichtstunden vor Pausenabzug. */
  grossHours: number;
  /** Pausenstunden (Brutto minus Netto). */
  breakHours: number;
  /** Netto-Arbeitsstunden nach Pausenabzug. */
  totalHours: number;
  totalCost: number;
  baseCost: number;
  surchargeCost: number;
  hasCompensation: boolean;
  currency: string;
};

export type TagAreaShiftRef = ShiftWorkHoursRef & {
  employeeId: string;
  shift_date: string;
};

export type TagAreaFooterStatsOptions = {
  breaksByTemplateId?: ReadonlyMap<string, readonly ShiftTypeBreakInput[]>;
  areaShiftTemplates?: readonly AreaShiftTemplateWithBreaks[];
};

export function isTagAreaShiftRef(value: unknown): value is TagAreaShiftRef {
  if (typeof value !== "object" || value === null) return false;
  const ref = value as TagAreaShiftRef;
  return (
    typeof ref.employeeId === "string" &&
    typeof ref.shift_date === "string" &&
    typeof ref.startTime === "string" &&
    typeof ref.endTime === "string"
  );
}

function resolveTagAreaShiftBreaks(
  shift: TagAreaShiftRef,
  options?: TagAreaFooterStatsOptions
): readonly ShiftTypeBreakInput[] {
  return resolveShiftWorkBreaks(
    shift,
    options?.breaksByTemplateId,
    options?.areaShiftTemplates
  );
}

export function shiftCompensationKey(
  employeeId: string,
  dateISO: string
): string {
  return `${employeeId}:${dateISO}`;
}

/** Stunden/Kosten für einen Kalendertag — Nachtschicht-Anteile nach 00:00 auf den Folgetag. */
export function computeTagAreaDayFooterStatsForDate(
  calendarDate: string,
  shifts: readonly TagAreaShiftRef[],
  compensationByKey: AreaCalendarShiftCompensationByKey,
  defaultCurrency = DEFAULT_ORGANIZATION_CURRENCY,
  options?: TagAreaFooterStatsOptions
): TagAreaDayFooterStats {
  let grossHours = 0;
  let totalHours = 0;
  let baseCost = 0;
  let surchargeCost = 0;
  let hasCompensation = false;
  let currency = defaultCurrency;

  for (const shift of shifts) {
    const breaks = resolveTagAreaShiftBreaks(shift, options);
    const grossSegments = splitShiftWindowIntoCalendarDaySegments({
      shiftDate: shift.shift_date,
      startTime: shift.startTime,
      endTime: shift.endTime,
    }).filter((segment) => segment.dateISO === calendarDate);
    const segments = splitShiftWindowIntoCalendarDayNetWorkSegments({
      shiftDate: shift.shift_date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breaks,
    }).filter((segment) => segment.dateISO === calendarDate);

    for (const segment of grossSegments) {
      grossHours += segment.minutes / 60;
    }

    for (const segment of segments) {
      const hours = segment.minutes / 60;
      totalHours += hours;

      const compensation =
        compensationByKey[
          shiftCompensationKey(shift.employeeId, segment.dateISO)
        ];
      if (!compensation) continue;

      hasCompensation = true;
      currency = compensation.currency || defaultCurrency;

      const applicableSurcharges = compensation.surcharges.filter((entry) =>
        surchargeTriggerMatchesDate(entry.trigger, segment.dateISO)
      );
      const surchargePerHour = applicableSurcharges.reduce(
        (sum, entry) =>
          sum +
          calculateSurchargeAdditionPerHour(
            compensation.baseHourlyRate,
            entry.amount,
            entry.unit
          ),
        0
      );
      baseCost += compensation.baseHourlyRate * hours;
      surchargeCost += surchargePerHour * hours;
    }
  }

  const roundedBaseCost = Math.round(baseCost * 100) / 100;
  const roundedSurchargeCost = Math.round(surchargeCost * 100) / 100;
  const roundedGrossHours = Math.round(grossHours * 10) / 10;
  const roundedTotalHours = Math.round(totalHours * 10) / 10;

  return {
    grossHours: roundedGrossHours,
    breakHours: Math.round((grossHours - totalHours) * 10) / 10,
    totalHours: roundedTotalHours,
    totalCost: Math.round((roundedBaseCost + roundedSurchargeCost) * 100) / 100,
    baseCost: roundedBaseCost,
    surchargeCost: roundedSurchargeCost,
    hasCompensation,
    currency,
  };
}

/** Standort-Woche — Stunden/Entgelt/Zuschläge aus Schichten + lazy Compensation-Map. */
export function computeLocationCompensationRollup(
  dates: readonly string[],
  shifts: readonly TagAreaShiftRef[],
  compensationByKey: AreaCalendarShiftCompensationByKey,
  defaultCurrency = DEFAULT_ORGANIZATION_CURRENCY,
  options?: TagAreaFooterStatsOptions
): TagAreaDayFooterStats {
  let grossHours = 0;
  let totalHours = 0;
  let baseCost = 0;
  let surchargeCost = 0;
  let hasCompensation = false;
  let currency = defaultCurrency;

  for (const dateISO of dates) {
    const dayStats = computeTagAreaDayFooterStatsForDate(
      dateISO,
      shifts,
      compensationByKey,
      defaultCurrency,
      options
    );
    grossHours += dayStats.grossHours;
    totalHours += dayStats.totalHours;
    baseCost += dayStats.baseCost;
    surchargeCost += dayStats.surchargeCost;
    if (dayStats.hasCompensation) {
      hasCompensation = true;
      currency = dayStats.currency;
    }
  }

  const roundedBaseCost = Math.round(baseCost * 100) / 100;
  const roundedSurchargeCost = Math.round(surchargeCost * 100) / 100;
  const roundedGrossHours = Math.round(grossHours * 10) / 10;
  const roundedTotalHours = Math.round(totalHours * 10) / 10;

  return {
    grossHours: roundedGrossHours,
    breakHours: Math.round((grossHours - totalHours) * 10) / 10,
    totalHours: roundedTotalHours,
    baseCost: roundedBaseCost,
    surchargeCost: roundedSurchargeCost,
    totalCost: Math.round((roundedBaseCost + roundedSurchargeCost) * 100) / 100,
    hasCompensation,
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

function formatTagAreaFooterMoneyWithCurrency(
  amount: number,
  locale: "de" | "en"
): string {
  return `${formatTagAreaFooterMoney(amount, locale)} €`;
}

function formatTagAreaFooterHoursLabel(
  stats: TagAreaDayFooterStats,
  translate: (key: string, params?: Record<string, string>) => string
): string {
  return translate("areaCalendar.tagAreaFooterTotalHours", {
    hours: formatDurationHours(stats.totalHours),
  });
}

export type TagAreaFooterCostTooltipPart = {
  label: string;
  amount: string;
};

export function formatTagAreaFooterCostTooltipParts(
  stats: TagAreaDayFooterStats,
  translate: (key: string, params?: Record<string, string>) => string,
  locale: "de" | "en"
): TagAreaFooterCostTooltipPart[] {
  if (!stats.hasCompensation) return [];

  const parts: TagAreaFooterCostTooltipPart[] = [];

  if (stats.surchargeCost > 0) {
    parts.push({
      label: translate("areaCalendar.tagAreaFooterTotalAmountLabel"),
      amount: formatTagAreaFooterMoneyWithCurrency(stats.totalCost, locale),
    });
  }

  parts.push({
    label: translate("areaCalendar.tagAreaFooterCompensationLabel"),
    amount: formatTagAreaFooterMoneyWithCurrency(stats.baseCost, locale),
  });

  if (stats.surchargeCost > 0) {
    parts.push({
      label: translate("areaCalendar.tagAreaFooterSurchargesLabel"),
      amount: formatTagAreaFooterMoneyWithCurrency(stats.surchargeCost, locale),
    });
  }

  return parts;
}

export type TagAreaFooterLabels = {
  line: string;
  hoursLine: string;
  costLine: string;
  shortLinePrefix: string;
  shortLineCostAmount: string;
  costTooltipParts: TagAreaFooterCostTooltipPart[];
};

export function formatTagAreaFooterLabels(
  stats: TagAreaDayFooterStats,
  translate: (key: string, params?: Record<string, string>) => string,
  locale: "de" | "en",
  options?: { showCompensation?: boolean }
): TagAreaFooterLabels {
  const showCompensation = options?.showCompensation !== false;
  const hoursLine = formatTagAreaFooterHoursLabel(stats, translate);
  const costTooltipParts =
    showCompensation && stats.hasCompensation
      ? formatTagAreaFooterCostTooltipParts(stats, translate, locale)
      : [];
  const costLine = costTooltipParts
    .map((part) => `${part.label} ${part.amount}`)
    .join("\n");
  const formattedCost = formatTagAreaFooterMoney(stats.totalCost, locale);
  const shortLinePrefix = translate("areaCalendar.tagAreaFooterShortLineHoursPart", {
    hours: formatDurationHours(stats.totalHours),
  });
  const shortLineCostAmount =
    showCompensation && stats.hasCompensation
      ? translate("areaCalendar.tagAreaFooterShortLineCostPart", {
          cost: formattedCost,
        })
      : "";
  return {
    line: showCompensation
      ? translate("areaCalendar.tagAreaFooterShortLine", {
          hours: formatDurationHours(stats.totalHours),
          cost: formattedCost,
        })
      : hoursLine,
    hoursLine,
    costLine,
    shortLinePrefix,
    shortLineCostAmount,
    costTooltipParts,
  };
}

export function formatTagAreaFooterLine(
  stats: TagAreaDayFooterStats,
  translate: (key: string, params?: Record<string, string>) => string,
  locale: "de" | "en"
): string {
  return formatTagAreaFooterLabels(stats, translate, locale).line;
}
