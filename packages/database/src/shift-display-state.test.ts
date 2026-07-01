import { describe, expect, it } from "vitest";
import {
  hasPendingEmployeeCancellation,
  mapLegacyConfirmationStatusToLifecycleAndRequestStatus,
  resolveLegacyConfirmationStatusForViewRow,
  resolveLegacyConfirmationStatusFromLegacyFields,
  resolveShiftCardDisplayState,
  resolveShiftLifecycleFromLegacy,
} from "./shift-display-state";

describe("resolveShiftLifecycleFromLegacy", () => {
  it("maps legacy confirmation statuses to lifecycle", () => {
    expect(resolveShiftLifecycleFromLegacy("proposed")).toBe("planned");
    expect(resolveShiftLifecycleFromLegacy("requested")).toBe("planned");
    expect(resolveShiftLifecycleFromLegacy("pending")).toBe("planned");
    expect(resolveShiftLifecycleFromLegacy("rejected")).toBe("planned");
    expect(resolveShiftLifecycleFromLegacy("confirmed")).toBe("confirmed");
    expect(resolveShiftLifecycleFromLegacy("canceled")).toBe("cancelled");
  });
});

describe("resolveLegacyConfirmationStatusFromLegacyFields", () => {
  it("maps overdue requested to pending for display", () => {
    expect(
      resolveLegacyConfirmationStatusFromLegacyFields({
        confirmationStatus: "requested",
        requestedAt: "2025-06-09T10:00:00.000Z",
        now: new Date("2025-06-09T13:00:00.000Z"),
      })
    ).toBe("pending");
  });
});

describe("resolveLegacyConfirmationStatusForViewRow", () => {
  it("matches the SQL view mapping", () => {
    expect(
      resolveLegacyConfirmationStatusForViewRow({
        lifecycle: "planned",
        latestConfirmationStatus: null,
      })
    ).toBe("proposed");
    expect(
      resolveLegacyConfirmationStatusForViewRow({
        lifecycle: "planned",
        latestConfirmationStatus: "pending",
      })
    ).toBe("requested");
    expect(
      resolveLegacyConfirmationStatusForViewRow({
        lifecycle: "planned",
        latestConfirmationStatus: "expired",
      })
    ).toBe("pending");
    expect(
      resolveLegacyConfirmationStatusForViewRow({
        lifecycle: "planned",
        latestConfirmationStatus: "rejected",
      })
    ).toBe("rejected");
    expect(
      resolveLegacyConfirmationStatusForViewRow({
        lifecycle: "planned",
        latestConfirmationStatus: "approved",
      })
    ).toBe("confirmed");
    expect(
      resolveLegacyConfirmationStatusForViewRow({
        lifecycle: "confirmed",
      })
    ).toBe("confirmed");
    expect(
      resolveLegacyConfirmationStatusForViewRow({
        lifecycle: "cancelled",
      })
    ).toBe("canceled");
  });
});

describe("mapLegacyConfirmationStatusToLifecycleAndRequestStatus", () => {
  it("maps proposed to planned without request", () => {
    expect(
      mapLegacyConfirmationStatusToLifecycleAndRequestStatus({
        confirmationStatus: "proposed",
      })
    ).toEqual({ lifecycle: "planned" });
  });

  it("maps requested within deadline to pending request", () => {
    expect(
      mapLegacyConfirmationStatusToLifecycleAndRequestStatus({
        confirmationStatus: "requested",
        requestedAt: "2025-06-09T10:00:00.000Z",
        now: new Date("2025-06-09T11:00:00.000Z"),
      })
    ).toEqual({
      lifecycle: "planned",
      confirmationRequest: {
        status: "pending",
        sentAt: "2025-06-09T10:00:00.000Z",
        respondedAt: null,
      },
    });
  });

  it("maps overdue requested to expired request", () => {
    expect(
      mapLegacyConfirmationStatusToLifecycleAndRequestStatus({
        confirmationStatus: "requested",
        requestedAt: "2025-06-09T10:00:00.000Z",
        now: new Date("2025-06-09T13:00:00.000Z"),
      }).confirmationRequest?.status
    ).toBe("expired");
  });
});

describe("resolveShiftCardDisplayState", () => {
  it("derives legacy status and open confirmation from requests", () => {
    const state = resolveShiftCardDisplayState(
      {
        shiftId: "shift-1",
        lifecycle: "planned",
        requests: [
          {
            id: "req-1",
            shift_id: "shift-1",
            type: "confirmation",
            status: "pending",
            sent_at: "2025-06-09T10:00:00.000Z",
            responded_at: null,
            payload: {},
            created_at: "2025-06-09T10:00:00.000Z",
          },
        ],
      },
      new Date("2025-06-09T11:00:00.000Z")
    );

    expect(state.legacyConfirmationStatus).toBe("requested");
    expect(state.openConfirmation).toEqual({
      requestId: "req-1",
      status: "pending",
      sentAt: "2025-06-09T10:00:00.000Z",
    });
  });

  it("falls back to legacy fields when requests are omitted", () => {
    const state = resolveShiftCardDisplayState({
      shiftId: "shift-2",
      confirmationStatus: "confirmed",
    });

    expect(state.lifecycle).toBe("confirmed");
    expect(state.legacyConfirmationStatus).toBe("confirmed");
    expect(state.openConfirmation).toBeUndefined();
  });

  it("exposes cancellation metadata for cancelled shifts", () => {
    const state = resolveShiftCardDisplayState({
      shiftId: "shift-3",
      lifecycle: "cancelled",
      requests: [
        {
          id: "cancel-1",
          shift_id: "shift-3",
          type: "cancellation",
          status: "approved",
          sent_at: "2025-06-09T12:00:00.000Z",
          responded_at: "2025-06-09T12:00:00.000Z",
          payload: { cancelled_by: "employee" },
          created_at: "2025-06-09T12:00:00.000Z",
        },
      ],
    });

    expect(state.legacyConfirmationStatus).toBe("canceled");
    expect(state.openCancellation).toEqual({
      requestId: "cancel-1",
      status: "approved",
      cancelledBy: "employee",
    });
  });

  it("exposes pending employee cancellation while shift stays confirmed", () => {
    const state = resolveShiftCardDisplayState({
      shiftId: "shift-pending-cancel",
      lifecycle: "confirmed",
      confirmationStatus: "confirmed",
      requests: [
        {
          id: "cancel-pending",
          shift_id: "shift-pending-cancel",
          type: "cancellation",
          status: "pending",
          sent_at: "2025-06-09T12:00:00.000Z",
          responded_at: null,
          payload: { cancelled_by: "employee" },
          created_at: "2025-06-09T12:00:00.000Z",
        },
      ],
    });

    expect(state.legacyConfirmationStatus).toBe("confirmed");
    expect(state.openCancellation).toEqual({
      requestId: "cancel-pending",
      status: "pending",
      cancelledBy: "employee",
    });
    expect(hasPendingEmployeeCancellation(state)).toBe(true);
  });

  it("prefers confirmed shift row over stale pending shift_requests", () => {
    const state = resolveShiftCardDisplayState({
      shiftId: "shift-4",
      lifecycle: "planned",
      confirmationStatus: "confirmed",
      requestedAt: "2025-06-09T10:00:00.000Z",
      requests: [
        {
          id: "req-stale",
          shift_id: "shift-4",
          type: "confirmation",
          status: "pending",
          sent_at: "2025-06-09T10:00:00.000Z",
          responded_at: null,
          payload: {},
          created_at: "2025-06-09T10:00:00.000Z",
        },
      ],
    });

    expect(state.lifecycle).toBe("confirmed");
    expect(state.legacyConfirmationStatus).toBe("confirmed");
    expect(state.openConfirmation).toBeUndefined();
  });

  it("prefers proposed shift row over stale approved shift_requests", () => {
    const state = resolveShiftCardDisplayState({
      shiftId: "shift-6",
      lifecycle: "planned",
      confirmationStatus: "proposed",
      requests: [
        {
          id: "req-approved-stale",
          shift_id: "shift-6",
          type: "confirmation",
          status: "approved",
          sent_at: "2025-06-09T10:00:00.000Z",
          responded_at: "2025-06-09T12:00:00.000Z",
          payload: {},
          created_at: "2025-06-09T10:00:00.000Z",
        },
      ],
    });

    expect(state.lifecycle).toBe("planned");
    expect(state.legacyConfirmationStatus).toBe("proposed");
    expect(state.openConfirmation).toBeUndefined();
    expect(state.lastConfirmation).toBeUndefined();
  });

  it("maps approved confirmation requests to confirmed", () => {
    const state = resolveShiftCardDisplayState({
      shiftId: "shift-5",
      lifecycle: "planned",
      requests: [
        {
          id: "req-approved",
          shift_id: "shift-5",
          type: "confirmation",
          status: "approved",
          sent_at: "2025-06-09T10:00:00.000Z",
          responded_at: "2025-06-09T12:00:00.000Z",
          payload: {},
          created_at: "2025-06-09T10:00:00.000Z",
        },
      ],
    });

    expect(state.legacyConfirmationStatus).toBe("confirmed");
    expect(state.openConfirmation).toBeUndefined();
    expect(state.lastConfirmation?.status).toBe("approved");
  });
});
