import { describe, expect, it } from "vitest";
import {
  getGermanPublicHolidayName,
  isGermanPublicHoliday,
} from "./de";
import { isPublicHolidayForCountry } from "./index";

describe("German public holidays", () => {
  it("recognises Christmas Day", () => {
    expect(isGermanPublicHoliday("2025-12-25")).toBe(true);
    expect(getGermanPublicHolidayName("2025-12-25", "de")).toBe("1. Weihnachtstag");
  });

  it("recognises Labour Day", () => {
    expect(isGermanPublicHoliday("2025-05-01")).toBe(true);
  });

  it("does not mark regular weekdays", () => {
    expect(isGermanPublicHoliday("2025-06-04")).toBe(false);
  });

  it("computes Easter Monday", () => {
    expect(isGermanPublicHoliday("2025-04-21")).toBe(true);
    expect(getGermanPublicHolidayName("2025-04-21", "de")).toBe("Ostermontag");
  });
});

describe("isPublicHolidayForCountry", () => {
  it("delegates to DE calendar", () => {
    expect(isPublicHolidayForCountry("DE", "2025-12-25")).toBe(true);
  });

  it("returns false for unknown country codes", () => {
    expect(isPublicHolidayForCountry("AT", "2025-12-25")).toBe(false);
  });
});
