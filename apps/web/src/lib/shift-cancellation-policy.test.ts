import { describe, expect, it } from "vitest";
import { SHIFT_CANCEL_PAST_ERROR } from "@schichtwerk/database";
import {
  shouldDisplayShiftOnPlanningCalendar,
  translateShiftCancelError,
} from "@/lib/shift-cancellation-policy";

const t = (key: string, params?: Record<string, string | number>) => {
  if (key === "shiftConfirmation.cancel.pastShift") {
    return "Vergangene Schichten können nicht abgesagt werden.";
  }
  if (key === "shiftConfirmation.cancel.blockedByStatus") {
    return `Blockiert: ${params?.status ?? ""}`;
  }
  if (key === "shiftConfirmation.status.proposed") {
    return "Geplant";
  }
  return key;
};

describe("shouldDisplayShiftOnPlanningCalendar", () => {
  it("hides manager-canceled shifts from the calendar", () => {
    const cancelActors = new Map([
      ["employee-canceled", "employee"],
      ["manager-canceled", "manager"],
    ] as const);

    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "employee-canceled",
        confirmationStatus: "canceled",
        cancelActors,
      })
    ).toBe(true);

    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "manager-canceled",
        confirmationStatus: "canceled",
        cancelActors,
      })
    ).toBe(false);
  });

  it("shows non-canceled shifts regardless of cancel actor", () => {
    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "confirmed-shift",
        confirmationStatus: "confirmed",
      })
    ).toBe(true);
  });
});

describe("translateShiftCancelError", () => {
  it("translates past-shift errors", () => {
    expect(translateShiftCancelError(SHIFT_CANCEL_PAST_ERROR, t)).toBe(
      "Vergangene Schichten können nicht abgesagt werden."
    );
  });

  it("translates blocked-status errors", () => {
    expect(
      translateShiftCancelError("SHIFT_CANCEL_BLOCKED:proposed", t)
    ).toBe("Blockiert: Geplant");
  });

  it("returns unknown messages unchanged", () => {
    expect(translateShiftCancelError("Something else", t)).toBe("Something else");
  });
});
