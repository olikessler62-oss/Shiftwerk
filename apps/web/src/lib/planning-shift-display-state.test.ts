import { describe, expect, it, vi } from "vitest";

import {
  resolvePlanningShiftConfirmationFields,
  resolveShiftCancelActorFromDisplayState,
} from "@/lib/planning-shift-display-state";

describe("resolvePlanningShiftConfirmationFields", () => {
  it("derives legacy status from lifecycle and requests", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T08:05:00.000Z"));

    const result = resolvePlanningShiftConfirmationFields({
      shiftId: "shift-1",
      lifecycle: "planned",
      confirmationStatus: "requested",
      requestedAt: "2026-06-17T08:00:00.000Z",
      requests: [
        {
          id: "req-1",
          shift_id: "shift-1",
          type: "confirmation",
          status: "pending",
          sent_at: "2026-06-17T08:00:00.000Z",
          responded_at: null,
          payload: {},
          created_at: "2026-06-17T08:00:00.000Z",
        },
      ],
    });

    expect(result.confirmationStatus).toBe("requested");
    expect(result.displayState.lifecycle).toBe("planned");
    expect(result.displayState.openConfirmation?.status).toBe("pending");

    vi.useRealTimers();
  });

  it("falls back to legacy fields when requests are not loaded", () => {
    const result = resolvePlanningShiftConfirmationFields({
      shiftId: "shift-2",
      confirmationStatus: "confirmed",
      requestedAt: null,
    });

    expect(result.confirmationStatus).toBe("confirmed");
    expect(result.displayState.lifecycle).toBe("confirmed");
  });

  it("prefers confirmed shift row over stale pending shift_requests", () => {
    const result = resolvePlanningShiftConfirmationFields({
      shiftId: "shift-3",
      lifecycle: "planned",
      confirmationStatus: "confirmed",
      requestedAt: "2025-06-09T10:00:00.000Z",
      requests: [
        {
          id: "req-stale",
          shift_id: "shift-3",
          type: "confirmation",
          status: "pending",
          sent_at: "2025-06-09T10:00:00.000Z",
          responded_at: null,
          payload: {},
          created_at: "2025-06-09T10:00:00.000Z",
        },
      ],
    });

    expect(result.confirmationStatus).toBe("confirmed");
    expect(result.displayState.lifecycle).toBe("confirmed");
    expect(result.displayState.openConfirmation).toBeUndefined();
  });

  it("prefers proposed shift row over stale approved shift_requests", () => {
    const result = resolvePlanningShiftConfirmationFields({
      shiftId: "shift-4",
      lifecycle: "planned",
      confirmationStatus: "proposed",
      requests: [
        {
          id: "req-approved-stale",
          shift_id: "shift-4",
          type: "confirmation",
          status: "approved",
          sent_at: "2025-06-09T10:00:00.000Z",
          responded_at: "2025-06-09T12:00:00.000Z",
          payload: {},
          created_at: "2025-06-09T10:00:00.000Z",
        },
      ],
    });

    expect(result.confirmationStatus).toBe("proposed");
    expect(result.displayState.lifecycle).toBe("planned");
    expect(result.displayState.openConfirmation).toBeUndefined();
  });
});

describe("resolveShiftCancelActorFromDisplayState", () => {
  it("reads cancellation actor from display state", () => {
    expect(
      resolveShiftCancelActorFromDisplayState({
        shiftId: "shift-3",
        lifecycle: "cancelled",
        legacyConfirmationStatus: "canceled",
        openCancellation: {
          requestId: "cancel-1",
          status: "approved",
          cancelledBy: "employee",
        },
      })
    ).toBe("employee");
  });
});
