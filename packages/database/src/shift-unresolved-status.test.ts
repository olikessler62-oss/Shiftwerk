import { describe, expect, it } from "vitest";
import {
  resolveCalendarShiftConfirmationStatus,
  shouldMarkShiftConfirmationUnresolved,
} from "./shift-unresolved-status";

describe("shouldMarkShiftConfirmationUnresolved", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");

  it("marks past requested and pending shifts as unresolved candidates", () => {
    expect(
      shouldMarkShiftConfirmationUnresolved("requested", "2026-06-19", now)
    ).toBe(true);
    expect(
      shouldMarkShiftConfirmationUnresolved("pending", "2026-06-19", now)
    ).toBe(true);
  });

  it("ignores future unanswered shifts, proposed, and other statuses", () => {
    expect(
      shouldMarkShiftConfirmationUnresolved("requested", "2026-06-21", now)
    ).toBe(false);
    expect(
      shouldMarkShiftConfirmationUnresolved("proposed", "2026-06-19", now)
    ).toBe(false);
    expect(
      shouldMarkShiftConfirmationUnresolved("confirmed", "2026-06-19", now)
    ).toBe(false);
    expect(
      shouldMarkShiftConfirmationUnresolved("unresolved", "2026-06-19", now)
    ).toBe(false);
  });
});

describe("resolveCalendarShiftConfirmationStatus", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");

  it("returns unresolved for past unanswered confirmation statuses", () => {
    expect(
      resolveCalendarShiftConfirmationStatus({
        status: "pending",
        shiftDateISO: "2026-06-19",
        now,
      })
    ).toBe("unresolved");
  });

  it("keeps future requested status", () => {
    expect(
      resolveCalendarShiftConfirmationStatus({
        status: "requested",
        requestedAt: "2026-06-20T11:00:00.000Z",
        shiftDateISO: "2026-06-21",
        now,
      })
    ).toBe("requested");
  });

  it("preserves stored unresolved status", () => {
    expect(
      resolveCalendarShiftConfirmationStatus({
        status: "unresolved",
        shiftDateISO: "2026-06-19",
        now,
      })
    ).toBe("unresolved");
  });
});
