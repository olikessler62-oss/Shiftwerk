import { describe, expect, it } from "vitest";
import {
  filterRequestedShiftsDueForPendingTransition,
  isRequestedShiftDueForPendingTransition,
  resolveEffectiveConfirmationStatus,
  type RequestedShiftForPendingJob,
} from "./shift-confirmation-pending";

const requestedAt = "2025-06-09T10:00:00.000Z";

function shiftForPendingJob(
  overrides: Partial<RequestedShiftForPendingJob> & {
    id: string;
    requested_at: string;
  }
): RequestedShiftForPendingJob {
  return {
    organization_id: "org-1",
    employee_id: "emp-1",
    shift_date: "2025-06-10",
    employee_full_name: "Test MA",
    email_fallback_mode: false,
    organization: { shift_confirmation_pending_after_minutes: 180 },
    ...overrides,
  };
}

describe("resolveEffectiveConfirmationStatus", () => {
  it("maps overdue requested to pending for display", () => {
    const now = new Date("2025-06-09T13:00:00.000Z");
    expect(
      resolveEffectiveConfirmationStatus(
        "requested",
        requestedAt,
        now
      )
    ).toBe("pending");
  });

  it("keeps recent requested as requested", () => {
    const now = new Date("2025-06-09T11:00:00.000Z");
    expect(
      resolveEffectiveConfirmationStatus(
        "requested",
        requestedAt,
        now
      )
    ).toBe("requested");
  });

  it("maps requested to pending after five minutes when org uses short frist", () => {
    const now = new Date("2025-06-09T10:05:00.000Z");
    expect(
      resolveEffectiveConfirmationStatus("requested", requestedAt, now, 5)
    ).toBe("pending");
  });

  it("keeps requested before five-minute frist elapses", () => {
    const now = new Date("2025-06-09T10:04:59.000Z");
    expect(
      resolveEffectiveConfirmationStatus("requested", requestedAt, now, 5)
    ).toBe("requested");
  });

  it("passes through other statuses unchanged", () => {
    expect(resolveEffectiveConfirmationStatus("proposed", null)).toBe("proposed");
    expect(resolveEffectiveConfirmationStatus("pending", requestedAt)).toBe(
      "pending"
    );
  });
});

describe("isRequestedShiftDueForPendingTransition", () => {
  it("uses organization-specific five-minute frist", () => {
    const shift = shiftForPendingJob({
      id: "shift-5m",
      requested_at: requestedAt,
      organization: { shift_confirmation_pending_after_minutes: 5 },
    });

    expect(
      isRequestedShiftDueForPendingTransition(
        shift,
        new Date("2025-06-09T10:04:59.000Z")
      )
    ).toBe(false);
    expect(
      isRequestedShiftDueForPendingTransition(
        shift,
        new Date("2025-06-09T10:05:00.000Z")
      )
    ).toBe(true);
  });

  it("falls back to three hours when organization value is missing", () => {
    const shift = shiftForPendingJob({
      id: "shift-default",
      requested_at: requestedAt,
      organization: {},
    });

    expect(
      isRequestedShiftDueForPendingTransition(
        shift,
        new Date("2025-06-09T12:59:59.000Z")
      )
    ).toBe(false);
    expect(
      isRequestedShiftDueForPendingTransition(
        shift,
        new Date("2025-06-09T13:00:00.000Z")
      )
    ).toBe(true);
  });
});

describe("filterRequestedShiftsDueForPendingTransition", () => {
  it("filters only shifts past their organization frist", () => {
    const now = new Date("2025-06-09T10:05:00.000Z");
    const due = filterRequestedShiftsDueForPendingTransition(
      [
        shiftForPendingJob({
          id: "due-5m",
          requested_at: requestedAt,
          organization: { shift_confirmation_pending_after_minutes: 5 },
        }),
        shiftForPendingJob({
          id: "not-due-3h",
          requested_at: requestedAt,
          organization: { shift_confirmation_pending_after_minutes: 180 },
        }),
      ],
      now
    );

    expect(due.map((shift) => shift.id)).toEqual(["due-5m"]);
  });
});
