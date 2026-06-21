import { describe, expect, it } from "vitest";
import {
  buildEmployeeShiftCanceledByManagerNotification,
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

describe("buildEmployeeShiftCanceledByManagerNotification", () => {
  it("builds push payload for manager storno", () => {
    const notification = buildEmployeeShiftCanceledByManagerNotification({
      shiftId: "shift-1",
      shiftDate: "2026-06-20",
      startsAt: "2026-06-20T08:00:00.000Z",
      endsAt: "2026-06-20T16:00:00.000Z",
    });

    expect(notification.templateKey).toBe("shift_canceled_by_manager");
    expect(notification.title).toBe("Schicht storniert");
    expect(notification.body).toContain("20.06.2026");
    expect(notification.payload.canceled_by).toBe("manager");
    expect(notification.payload.shift_id).toBe("shift-1");
  });
});

describe("SHIFT_DISMISS_NOT_CANCELED_ERROR", () => {
  it("is exported for dismiss validation", async () => {
    const { SHIFT_DISMISS_NOT_CANCELED_ERROR } = await import("./shift-cancellation");
    expect(SHIFT_DISMISS_NOT_CANCELED_ERROR).toContain("stornierte");
  });
});
