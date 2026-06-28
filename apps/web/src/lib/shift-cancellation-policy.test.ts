import { describe, expect, it } from "vitest";
import { SHIFT_CANCEL_PAST_ERROR } from "@schichtwerk/database";
import {
  shouldDisplayShiftOnPlanningCalendar,
  translateShiftCancelError,
} from "@/lib/shift-cancellation-policy";

const futureDate = "2099-06-20";
const pastDate = "2020-06-20";
const now = new Date("2026-06-25T12:00:00.000Z");

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
        shiftDate: futureDate,
        confirmationStatus: "canceled",
        cancelActors,
      })
    ).toBe(true);

    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "manager-canceled",
        shiftDate: futureDate,
        confirmationStatus: "canceled",
        cancelActors,
      })
    ).toBe(false);
  });

  it("hides manager-canceled shifts when cancelledBy comes from displayState", () => {
    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "manager-canceled",
        shiftDate: futureDate,
        confirmationStatus: "canceled",
        cancelledBy: "manager",
      })
    ).toBe(false);

    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "employee-canceled",
        shiftDate: futureDate,
        confirmationStatus: "canceled",
        cancelledBy: "employee",
      })
    ).toBe(true);
  });

  it("shows non-canceled shifts regardless of cancel actor", () => {
    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "confirmed-shift",
        shiftDate: futureDate,
        confirmationStatus: "confirmed",
      })
    ).toBe(true);
  });

  it("hides past proposed shifts from the calendar", () => {
    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "past-proposed",
        shiftDate: pastDate,
        confirmationStatus: "proposed",
        now,
      })
    ).toBe(false);
    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "future-proposed",
        shiftDate: futureDate,
        confirmationStatus: "proposed",
        now,
      })
    ).toBe(true);
  });

  it("keeps past rejected and employee-canceled shifts visible", () => {
    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "past-rejected",
        shiftDate: pastDate,
        confirmationStatus: "rejected",
        now,
      })
    ).toBe(true);
    expect(
      shouldDisplayShiftOnPlanningCalendar({
        id: "past-employee-canceled",
        shiftDate: pastDate,
        confirmationStatus: "canceled",
        cancelledBy: "employee",
        now,
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
