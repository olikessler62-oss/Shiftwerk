import { describe, expect, it } from "vitest";
import {
  computeTagAreaDayFooterStatsForDate,
  formatTagAreaFooterLabels,
  formatTagAreaFooterLine,
  shiftCompensationKey,
} from "./tag-area-footer-stats";

function mockFooterTranslate(
  key: string,
  params?: Record<string, string>
): string {
  if (key === "areaCalendar.tagAreaFooterShortLine") {
    return `Ges.: ${params?.hours ?? ""} Std | ${params?.cost ?? ""} €`;
  }
  if (key === "areaCalendar.tagAreaFooterShortLineHoursPart") {
    return `Ges.: ${params?.hours ?? ""} Std | `;
  }
  if (key === "areaCalendar.tagAreaFooterShortLineCostPart") {
    return `${params?.cost ?? ""} €`;
  }
  if (key === "areaCalendar.tagAreaFooterTotalHours") {
    return `Gesamte Stunden: ${params?.hours ?? ""}`;
  }
  if (key === "areaCalendar.tagAreaFooterTotalAmountLabel") {
    return "Gesamtbetrag:";
  }
  if (key === "areaCalendar.tagAreaFooterCompensationLabel") {
    return "Entgelt:";
  }
  if (key === "areaCalendar.tagAreaFooterSurchargesLabel") {
    return "Zuschläge:";
  }
  return `Gesamte Kosten: ${params?.amount ?? ""} ${params?.currency ?? ""}`;
}

describe("tag-area-footer-stats", () => {
  it("sums hours and costs using effective hourly rates", () => {
    const employeeId = "emp-1";
    const date = "2026-06-09";
    const stats = computeTagAreaDayFooterStatsForDate(
      date,
      [
        {
          employeeId,
          shift_date: date,
          startTime: "08:00",
          endTime: "12:00",
        },
        {
          employeeId,
          shift_date: date,
          startTime: "13:00",
          endTime: "17:00",
        },
      ],
      {
        [shiftCompensationKey(employeeId, date)]: {
          baseHourlyRate: 20,
          currency: "EUR",
          surcharges: [],
        },
      }
    );

    expect(stats.grossHours).toBe(8);
    expect(stats.breakHours).toBe(0);
    expect(stats.totalHours).toBe(8);
    expect(stats.totalCost).toBe(160);
    expect(stats.baseCost).toBe(160);
    expect(stats.surchargeCost).toBe(0);
    expect(stats.hasCompensation).toBe(true);
    expect(stats.currency).toBe("EUR");
  });

  it("splits base compensation and surcharges in euro", () => {
    const employeeId = "emp-1";
    const date = "2026-06-07";
    const stats = computeTagAreaDayFooterStatsForDate(
      date,
      [
        {
          employeeId,
          shift_date: date,
          startTime: "08:00",
          endTime: "16:00",
        },
      ],
      {
        [shiftCompensationKey(employeeId, date)]: {
          baseHourlyRate: 20,
          currency: "EUR",
          surcharges: [
            {
              id: "s1",
              surcharge_type_id: "t1",
              name: "Sonntag",
              trigger: "sunday",
              amount: 5,
              unit: "eur_per_hour",
            },
          ],
        },
      }
    );

    expect(stats.grossHours).toBe(8);
    expect(stats.breakHours).toBe(0);
    expect(stats.totalHours).toBe(8);
    expect(stats.baseCost).toBe(160);
    expect(stats.surchargeCost).toBe(40);
    expect(stats.totalCost).toBe(200);
  });

  it("subtracts template breaks from compensation hours and costs", () => {
    const employeeId = "emp-1";
    const date = "2026-06-09";
    const templateId = "tpl-1";
    const stats = computeTagAreaDayFooterStatsForDate(
      date,
      [
        {
          employeeId,
          shift_date: date,
          startTime: "08:00",
          endTime: "16:00",
          area_shift_template_id: templateId,
        },
      ],
      {
        [shiftCompensationKey(employeeId, date)]: {
          baseHourlyRate: 20,
          currency: "EUR",
          surcharges: [],
        },
      },
      "EUR",
      {
        breaksByTemplateId: new Map([
          [templateId, [{ break_start: "12:00", break_end: "12:30" }]],
        ]),
      }
    );

    expect(stats.grossHours).toBe(8);
    expect(stats.breakHours).toBe(0.5);
    expect(stats.totalHours).toBe(7.5);
    expect(stats.totalCost).toBe(150);
    expect(stats.baseCost).toBe(150);
  });

  it("splits overnight hours across start and follow-up day", () => {
    const employeeId = "emp-1";
    const compensation = {
      baseHourlyRate: 20,
      currency: "EUR",
      surcharges: [],
    };
    const overnight = {
      employeeId,
      shift_date: "2026-06-17",
      startTime: "22:00",
      endTime: "04:00",
    };

    const startDay = computeTagAreaDayFooterStatsForDate(
      "2026-06-17",
      [overnight],
      {
        [shiftCompensationKey(employeeId, "2026-06-17")]: compensation,
        [shiftCompensationKey(employeeId, "2026-06-18")]: compensation,
      }
    );
    const followUpDay = computeTagAreaDayFooterStatsForDate(
      "2026-06-18",
      [overnight],
      {
        [shiftCompensationKey(employeeId, "2026-06-17")]: compensation,
        [shiftCompensationKey(employeeId, "2026-06-18")]: compensation,
      }
    );

    expect(startDay.totalHours).toBe(2);
    expect(followUpDay.totalHours).toBe(4);
    expect(startDay.totalCost + followUpDay.totalCost).toBe(120);
  });

  it("formats footer line with separator", () => {
    const line = formatTagAreaFooterLine(
      {
        grossHours: 8,
        breakHours: 0,
        totalHours: 8,
        totalCost: 160,
        baseCost: 160,
        surchargeCost: 0,
        hasCompensation: true,
        currency: "EUR",
      },
      mockFooterTranslate,
      "de"
    );
    expect(line).toBe("Ges.: 8:00 Std | 160,00 €");
  });

  it("formats footer tooltip lines separately", () => {
    const labels = formatTagAreaFooterLabels(
      {
        grossHours: 8,
        breakHours: 0,
        totalHours: 8,
        totalCost: 160,
        baseCost: 160,
        surchargeCost: 0,
        hasCompensation: true,
        currency: "EUR",
      },
      mockFooterTranslate,
      "de"
    );
    expect(labels.hoursLine).toBe("Gesamte Stunden: 8:00");
    expect(labels.costLine).toBe("Entgelt: 160,00 €");
    expect(labels.line).toBe("Ges.: 8:00 Std | 160,00 €");
    expect(labels.shortLinePrefix).toBe("Ges.: 8:00 Std | ");
    expect(labels.shortLineCostAmount).toBe("160,00 €");
    expect(labels.costTooltipParts).toEqual([
      { label: "Entgelt:", amount: "160,00 €" },
    ]);
  });

  it("includes surcharges line in cost tooltip when present", () => {
    const labels = formatTagAreaFooterLabels(
      {
        grossHours: 8,
        breakHours: 0,
        totalHours: 8,
        totalCost: 200,
        baseCost: 160,
        surchargeCost: 40,
        hasCompensation: true,
        currency: "EUR",
      },
      mockFooterTranslate,
      "de"
    );
    expect(labels.costLine).toBe(
      "Gesamtbetrag: 200,00 €\nEntgelt: 160,00 €\nZuschläge: 40,00 €"
    );
    expect(labels.costTooltipParts).toEqual([
      { label: "Gesamtbetrag:", amount: "200,00 €" },
      { label: "Entgelt:", amount: "160,00 €" },
      { label: "Zuschläge:", amount: "40,00 €" },
    ]);
  });

  it("omits cost tooltip when no compensation is recorded", () => {
    const labels = formatTagAreaFooterLabels(
      {
        grossHours: 8,
        breakHours: 0,
        totalHours: 8,
        totalCost: 0,
        baseCost: 0,
        surchargeCost: 0,
        hasCompensation: false,
        currency: "EUR",
      },
      mockFooterTranslate,
      "de"
    );
    expect(labels.costLine).toBe("");
  });
});
