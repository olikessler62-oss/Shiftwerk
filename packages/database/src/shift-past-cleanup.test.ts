import { describe, expect, it } from "vitest";
import {
  assertCanConfirmPastShiftAsManager,
  canConfirmPastShiftAsManager,
} from "./shift-past-cleanup";

describe("canConfirmPastShiftAsManager", () => {
  const now = new Date("2026-06-17T12:00:00.000Z");

  it("allows confirming past non-confirmed shifts", () => {
    expect(
      canConfirmPastShiftAsManager({
        shiftDate: "2026-06-16",
        confirmationStatus: "pending",
        now,
      })
    ).toBe(true);
  });

  it("blocks future and already confirmed shifts", () => {
    expect(
      canConfirmPastShiftAsManager({
        shiftDate: "2026-06-17",
        confirmationStatus: "pending",
        now,
      })
    ).toBe(false);
    expect(
      canConfirmPastShiftAsManager({
        shiftDate: "2026-06-16",
        confirmationStatus: "confirmed",
        now,
      })
    ).toBe(false);
  });
});

describe("assertCanConfirmPastShiftAsManager", () => {
  it("throws stable error codes", () => {
    expect(() =>
      assertCanConfirmPastShiftAsManager({
        shiftDate: "2026-06-17",
        confirmationStatus: "pending",
        now: new Date("2026-06-17T12:00:00.000Z"),
      })
    ).toThrow("SHIFT_PAST_CONFIRM_NOT_PAST");

    expect(() =>
      assertCanConfirmPastShiftAsManager({
        shiftDate: "2026-06-16",
        confirmationStatus: "confirmed",
        now: new Date("2026-06-17T12:00:00.000Z"),
      })
    ).toThrow("SHIFT_PAST_CONFIRM_ALREADY_CONFIRMED");
  });
});
