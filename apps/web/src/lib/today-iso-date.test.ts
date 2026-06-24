import { describe, it, expect } from "vitest";
import { getTodayIsoDate } from "./today-iso-date";

describe("getTodayIsoDate", () => {
  it("returns today's date in ISO format (YYYY-MM-DD)", () => {
    const result = getTodayIsoDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches today's date", () => {
    const result = getTodayIsoDate();
    const expected = new Date().toISOString().split("T")[0];
    expect(result).toBe(expected);
  });
});
