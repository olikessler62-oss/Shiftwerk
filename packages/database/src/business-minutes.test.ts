import { describe, expect, it } from "vitest";
import {
  elapsedMinutesBetween,
  isShiftConfirmationPendingDue,
  PENDING_ELAPSED_HOURS_REQUIRED,
  PENDING_ELAPSED_MINUTES_REQUIRED,
} from "./business-minutes";

describe("elapsedMinutesBetween", () => {
  it("counts wall-clock minutes between two instants", () => {
    const from = new Date("2025-06-09T10:00:00.000Z");
    const to = new Date("2025-06-09T13:00:00.000Z");
    expect(elapsedMinutesBetween(from, to)).toBe(180);
  });

  it("includes overnight gaps", () => {
    const from = new Date("2025-06-09T22:00:00.000Z");
    const to = new Date("2025-06-10T01:00:00.000Z");
    expect(elapsedMinutesBetween(from, to)).toBe(180);
  });

  it("returns zero when to is not after from", () => {
    const at = new Date("2025-06-09T10:00:00.000Z");
    expect(elapsedMinutesBetween(at, at)).toBe(0);
  });
});

describe("isShiftConfirmationPendingDue", () => {
  it("is true once three wall-clock hours elapsed since requested_at", () => {
    const requestedAt = "2025-06-09T10:00:00.000Z";
    const now = "2025-06-09T13:00:00.000Z";
    expect(isShiftConfirmationPendingDue(requestedAt, now)).toBe(true);
  });

  it("is false before three wall-clock hours elapsed", () => {
    const requestedAt = "2025-06-09T10:00:00.000Z";
    const now = "2025-06-09T12:59:59.000Z";
    expect(isShiftConfirmationPendingDue(requestedAt, now)).toBe(false);
  });

  it("is true after three hours across midnight", () => {
    const requestedAt = "2025-06-09T22:00:00.000Z";
    const now = "2025-06-10T01:00:00.000Z";
    expect(isShiftConfirmationPendingDue(requestedAt, now)).toBe(true);
  });

  it("uses the configured threshold constant", () => {
    expect(PENDING_ELAPSED_HOURS_REQUIRED).toBe(3);
    expect(PENDING_ELAPSED_MINUTES_REQUIRED).toBe(180);
  });

  it("honours a custom short threshold of five minutes", () => {
    const requestedAt = "2025-06-09T10:00:00.000Z";
    expect(
      isShiftConfirmationPendingDue(requestedAt, "2025-06-09T10:04:59.000Z", 5)
    ).toBe(false);
    expect(
      isShiftConfirmationPendingDue(requestedAt, "2025-06-09T10:05:00.000Z", 5)
    ).toBe(true);
  });
});
