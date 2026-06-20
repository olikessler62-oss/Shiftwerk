import { describe, expect, it } from "vitest";
import { parseProfileWeeklyHours } from "./profile-weekly-hours-validation";

describe("parseProfileWeeklyHours", () => {
  it("returns null for empty input", () => {
    expect(parseProfileWeeklyHours("")).toEqual({ ok: true, weekly_hours: null });
    expect(parseProfileWeeklyHours("   ")).toEqual({ ok: true, weekly_hours: null });
  });

  it("parses valid hours with comma decimal separator", () => {
    expect(parseProfileWeeklyHours("40")).toEqual({ ok: true, weekly_hours: 40 });
    expect(parseProfileWeeklyHours("38,5")).toEqual({ ok: true, weekly_hours: 38.5 });
  });

  it("rejects non-positive values", () => {
    expect(parseProfileWeeklyHours("0").ok).toBe(false);
    expect(parseProfileWeeklyHours("-5").ok).toBe(false);
    expect(parseProfileWeeklyHours("abc").ok).toBe(false);
  });

  it("rejects values above one week", () => {
    expect(parseProfileWeeklyHours("49").ok).toBe(false);
  });
});
