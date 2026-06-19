import { describe, expect, it } from "vitest";
import {
  canDeleteShift,
  canDeleteShiftByConfirmationStatus,
  parseShiftDeleteBlockedStatus,
  shiftDeleteBlockedActionError,
} from "@/lib/shift-deletion-policy";

const isPastShiftDate = (date: string) => date < "2026-06-17";

describe("canDeleteShiftByConfirmationStatus", () => {
  it("allows proposed and rejected", () => {
    expect(canDeleteShiftByConfirmationStatus("proposed")).toBe(true);
    expect(canDeleteShiftByConfirmationStatus("rejected")).toBe(true);
    expect(canDeleteShiftByConfirmationStatus("canceled")).toBe(true);
  });

  it("blocks requested, pending, confirmed and missing status", () => {
    expect(canDeleteShiftByConfirmationStatus("requested")).toBe(false);
    expect(canDeleteShiftByConfirmationStatus("pending")).toBe(false);
    expect(canDeleteShiftByConfirmationStatus("confirmed")).toBe(false);
    expect(canDeleteShiftByConfirmationStatus(undefined)).toBe(false);
    expect(canDeleteShiftByConfirmationStatus(null)).toBe(false);
  });
});

describe("shiftDeleteBlockedActionError", () => {
  it("round-trips through parseShiftDeleteBlockedStatus", () => {
    const message = shiftDeleteBlockedActionError("requested");
    expect(parseShiftDeleteBlockedStatus(message)).toBe("requested");
  });
});

describe("canDeleteShift", () => {
  it("allows deleting past shifts that are not confirmed", () => {
    expect(
      canDeleteShift({
        shiftDate: "2026-06-10",
        confirmationStatus: "pending",
        requestedAt: null,
        isPastShiftDate,
      })
    ).toBe(true);
    expect(
      canDeleteShift({
        shiftDate: "2026-06-10",
        confirmationStatus: "requested",
        requestedAt: null,
        isPastShiftDate,
      })
    ).toBe(true);
  });

  it("blocks deleting past confirmed shifts", () => {
    expect(
      canDeleteShift({
        shiftDate: "2026-06-10",
        confirmationStatus: "confirmed",
        requestedAt: null,
        isPastShiftDate,
      })
    ).toBe(false);
  });

  it("keeps future deletion rules unchanged", () => {
    expect(
      canDeleteShift({
        shiftDate: "2026-06-20",
        confirmationStatus: "proposed",
        requestedAt: null,
        isPastShiftDate,
      })
    ).toBe(true);
    expect(
      canDeleteShift({
        shiftDate: "2026-06-20",
        confirmationStatus: "pending",
        requestedAt: null,
        isPastShiftDate,
      })
    ).toBe(false);
  });
});
