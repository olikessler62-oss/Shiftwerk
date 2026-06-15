import { describe, expect, it } from "vitest";
import {
  computeTagAreaDayFooterStats,
  formatTagAreaFooterLabels,
  formatTagAreaFooterLine,
  shiftCompensationKey,
} from "./tag-area-footer-stats";

describe("tag-area-footer-stats", () => {
  it("sums hours and costs using effective hourly rates", () => {
    const employeeId = "emp-1";
    const date = "2026-06-09";
    const stats = computeTagAreaDayFooterStats(
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

    expect(stats.totalHours).toBe(8);
    expect(stats.totalCost).toBe(160);
    expect(stats.currency).toBe("EUR");
  });

  it("formats footer line with separator", () => {
    const line = formatTagAreaFooterLine(
      { totalHours: 8, totalCost: 160, currency: "EUR" },
      (key, params) => {
        if (key === "dashboard.tagAreaFooterTotalHours") {
          return `Gesamte Stunden: ${params?.hours ?? ""}`;
        }
        return `Gesamte Kosten: ${params?.amount ?? ""} ${params?.currency ?? ""}`;
      },
      "de"
    );
    expect(line).toBe("Gesamte Stunden: 8:00 | Gesamte Kosten: 160,00 EUR");
  });

  it("formats footer tooltip lines separately", () => {
    const labels = formatTagAreaFooterLabels(
      { totalHours: 8, totalCost: 160, currency: "EUR" },
      (key, params) => {
        if (key === "dashboard.tagAreaFooterTotalHours") {
          return `Gesamte Stunden: ${params?.hours ?? ""}`;
        }
        return `Gesamte Kosten: ${params?.amount ?? ""} ${params?.currency ?? ""}`;
      },
      "de"
    );
    expect(labels.hoursLine).toBe("Gesamte Stunden: 8:00");
    expect(labels.costLine).toBe("Gesamte Kosten: 160,00 EUR");
    expect(labels.line).toBe(
      "Gesamte Stunden: 8:00 | Gesamte Kosten: 160,00 EUR"
    );
  });
});
