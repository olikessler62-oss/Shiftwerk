import { describe, expect, it } from "vitest";
import {
  businessMinutesBetween,
  isShiftConfirmationPendingDue,
  PENDING_BUSINESS_MINUTES_REQUIRED,
} from "./business-minutes";
import { zonedWallClockToUtc } from "./shift-timestamps";

const BERLIN = "Europe/Berlin";

describe("businessMinutesBetween", () => {
  it("counts three hours within the same business day", () => {
    const from = zonedWallClockToUtc("2025-06-09", "10:00", BERLIN);
    const to = zonedWallClockToUtc("2025-06-09", "13:00", BERLIN);
    expect(businessMinutesBetween(from, to, BERLIN)).toBe(180);
  });

  it("skips overnight gaps outside business hours", () => {
    const from = zonedWallClockToUtc("2025-06-09", "18:00", BERLIN);
    const to = zonedWallClockToUtc("2025-06-10", "10:00", BERLIN);
    expect(businessMinutesBetween(from, to, BERLIN)).toBe(240);
  });

  it("counts weekend minutes with the same business-hour window", () => {
    const from = zonedWallClockToUtc("2025-06-14", "10:00", BERLIN);
    const to = zonedWallClockToUtc("2025-06-14", "14:00", BERLIN);
    expect(businessMinutesBetween(from, to, BERLIN)).toBe(240);
  });

  it("only counts minutes inside the configured window", () => {
    const from = zonedWallClockToUtc("2025-06-09", "06:00", BERLIN);
    const to = zonedWallClockToUtc("2025-06-09", "09:00", BERLIN);
    expect(businessMinutesBetween(from, to, BERLIN)).toBe(60);
  });

  it("returns zero when to is not after from", () => {
    const at = zonedWallClockToUtc("2025-06-09", "10:00", BERLIN);
    expect(businessMinutesBetween(at, at, BERLIN)).toBe(0);
  });
});

describe("isShiftConfirmationPendingDue", () => {
  it("is true once required business minutes elapsed", () => {
    const requestedAt = zonedWallClockToUtc("2025-06-09", "10:00", BERLIN);
    const now = zonedWallClockToUtc("2025-06-09", "13:00", BERLIN);
    expect(isShiftConfirmationPendingDue(requestedAt.toISOString(), now, BERLIN)).toBe(
      true
    );
  });

  it("is false before required business minutes elapsed", () => {
    const requestedAt = zonedWallClockToUtc("2025-06-09", "10:00", BERLIN);
    const now = zonedWallClockToUtc("2025-06-09", "12:00", BERLIN);
    expect(isShiftConfirmationPendingDue(requestedAt.toISOString(), now, BERLIN)).toBe(
      false
    );
  });

  it("uses the configured threshold constant", () => {
    expect(PENDING_BUSINESS_MINUTES_REQUIRED).toBe(180);
  });
});
