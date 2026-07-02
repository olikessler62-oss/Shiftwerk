import { describe, expect, it } from "vitest";
import {
  buildEmployeeShiftCanceledByManagerNotification,
  buildManagerShiftCanceledNotification,
  parseCancellationReasonFromNotificationBody,
  readCancellationReasonFromManagerNotification,
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

describe("buildManagerShiftCanceledNotification", () => {
  it("includes optional employee cancellation reason in body and payload", () => {
    const notification = buildManagerShiftCanceledNotification({
      employeeName: "Klaus Mustermann",
      canceledBy: "employee",
      shiftDate: "2026-07-02",
      shiftId: "shift-1",
      employeeId: "emp-1",
      reason: "Kurzfristig krank",
    });

    expect(notification.body).toContain("Klaus Mustermann");
    expect(notification.body).toContain("Grund: Kurzfristig krank");
    expect(notification.payload.cancellation_reason).toBe("Kurzfristig krank");
  });

  it("includes shift times in payload when provided", () => {
    const notification = buildManagerShiftCanceledNotification({
      employeeName: "Klaus Mustermann",
      canceledBy: "employee",
      shiftDate: "2026-07-02",
      shiftId: "shift-1",
      employeeId: "emp-1",
      startTime: "08:00",
      endTime: "16:00",
      shiftTemplateName: " Frühschicht ",
    });

    expect(notification.payload.start_time).toBe("08:00");
    expect(notification.payload.end_time).toBe("16:00");
    expect(notification.payload.shift_template_name).toBe("Frühschicht");
  });

  it("truncates long cancellation reasons in the notification body", () => {
    const longReason = "a".repeat(120);
    const notification = buildManagerShiftCanceledNotification({
      employeeName: "Klaus Mustermann",
      canceledBy: "employee",
      shiftDate: "2026-07-02",
      shiftId: "shift-1",
      employeeId: "emp-1",
      reason: longReason,
    });

    expect(notification.body).toContain("Grund:");
    expect(notification.body).not.toContain(longReason);
    expect(notification.payload.cancellation_reason).toBe(longReason);
  });
});

describe("readCancellationReasonFromManagerNotification", () => {
  it("prefers full payload reason over truncated body preview", () => {
    const reason = "a".repeat(120);
    const notification = buildManagerShiftCanceledNotification({
      employeeName: "Klaus Mustermann",
      canceledBy: "employee",
      shiftDate: "2026-07-02",
      shiftId: "shift-1",
      employeeId: "emp-1",
      reason,
    });

    expect(
      readCancellationReasonFromManagerNotification({
        payload: notification.payload,
        body: notification.body,
      })
    ).toBe(reason);
  });

  it("falls back to notification body when payload has no reason", () => {
    const body =
      "Klaus Mustermann hat eine geplante Schicht abgesagt.\nGrund: Kurzfristig krank";

    expect(
      readCancellationReasonFromManagerNotification({
        payload: { shift_id: "shift-1" },
        body,
      })
    ).toBe("Kurzfristig krank");
  });

  it("parses cancellation reason lines from notification bodies", () => {
    expect(
      parseCancellationReasonFromNotificationBody(
        "Max hat eine geplante Schicht abgesagt.\nGrund: Kind krank"
      )
    ).toBe("Kind krank");
  });
});

describe("SHIFT_DISMISS_NOT_CANCELED_ERROR", () => {
  it("is exported for dismiss validation", async () => {
    const { SHIFT_DISMISS_NOT_CANCELED_ERROR } = await import("./shift-cancellation");
    expect(SHIFT_DISMISS_NOT_CANCELED_ERROR).toContain("stornierte");
  });
});
