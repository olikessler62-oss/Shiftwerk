import { describe, expect, it } from "vitest";
import {
  canCancelShiftByConfirmationStatus,
  isShiftDateInPast,
  parseShiftCancelBlockedStatus,
  shiftCancelBlockedActionError,
} from "@schichtwerk/database";

describe("canCancelShiftByConfirmationStatus", () => {
  it("allows requested, pending, and confirmed", () => {
    expect(canCancelShiftByConfirmationStatus("requested", "2026-06-17T08:00:00Z")).toBe(
      true
    );
    expect(canCancelShiftByConfirmationStatus("pending", null)).toBe(true);
    expect(canCancelShiftByConfirmationStatus("confirmed", null)).toBe(true);
  });

  it("disallows proposed, rejected, and canceled", () => {
    expect(canCancelShiftByConfirmationStatus("proposed", null)).toBe(false);
    expect(canCancelShiftByConfirmationStatus("rejected", null)).toBe(false);
    expect(canCancelShiftByConfirmationStatus("canceled", null)).toBe(false);
  });
});

describe("isShiftDateInPast", () => {
  it("treats today as not past", () => {
    expect(isShiftDateInPast("2026-06-17", new Date("2026-06-17T15:00:00"))).toBe(
      false
    );
  });

  it("treats yesterday as past", () => {
    expect(isShiftDateInPast("2026-06-16", new Date("2026-06-17T08:00:00"))).toBe(
      true
    );
  });
});

describe("shiftCancelBlockedActionError", () => {
  it("round-trips through parseShiftCancelBlockedStatus", () => {
    const message = shiftCancelBlockedActionError("proposed");
    expect(parseShiftCancelBlockedStatus(message)).toBe("proposed");
  });
});
