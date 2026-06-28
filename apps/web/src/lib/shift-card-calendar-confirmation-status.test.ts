import { describe, expect, it } from "vitest";
import { resolveShiftCardConfirmationStatusForCalendar } from "@/lib/shift-card-calendar-confirmation-status";

describe("resolveShiftCardConfirmationStatusForCalendar", () => {
  it("uses the calendar cell date for unresolved resolution", () => {
    expect(
      resolveShiftCardConfirmationStatusForCalendar(
        {
          shift_date: "2026-06-21",
          confirmationStatus: "pending",
        },
        "2026-06-19"
      )
    ).toBe("unresolved");
  });
});
