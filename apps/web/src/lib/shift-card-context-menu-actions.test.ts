import { describe, expect, it } from "vitest";
import {
  canOpenPastUnconfirmedShiftContextMenu,
  isPastConfirmedPlanningShift,
  isPastUnconfirmedShift,
  planningShiftCardShowsPointerCursor,
  shiftCardContextMenuActions,
  shiftCardContextMenuShowsEdit,
} from "@/lib/shift-card-context-menu-actions";

const isPastShiftDate = (date: string) => date < "2026-06-17";

describe("shiftCardContextMenuActions", () => {
  it("maps each status to the expected context menu actions", () => {
    expect(shiftCardContextMenuActions("proposed")).toEqual(["delete"]);
    expect(shiftCardContextMenuActions("requested")).toEqual(["cancel"]);
    expect(shiftCardContextMenuActions("confirmed")).toEqual(["cancel"]);
    expect(shiftCardContextMenuActions("rejected")).toEqual(["reassign"]);
    expect(shiftCardContextMenuActions("pending")).toEqual([
      "cancel",
      "resendConfirmation",
    ]);
    expect(shiftCardContextMenuActions("canceled")).toEqual([
      "reassign",
      "delete",
    ]);
  });

  it("offers only setConfirmed for past unconfirmed shifts", () => {
    const options = { shiftDate: "2026-06-10", isPastShiftDate };
    expect(shiftCardContextMenuActions("pending", null, options)).toEqual([
      "setConfirmed",
    ]);
    expect(shiftCardContextMenuActions("requested", null, options)).toEqual([
      "setConfirmed",
    ]);
    expect(shiftCardContextMenuActions("confirmed", null, options)).toEqual([
      "cancel",
    ]);
  });
});

describe("isPastUnconfirmedShift", () => {
  it("detects past shifts that are not confirmed", () => {
    expect(
      isPastUnconfirmedShift("pending", null, {
        shiftDate: "2026-06-10",
        isPastShiftDate,
      })
    ).toBe(true);
    expect(
      isPastUnconfirmedShift("confirmed", null, {
        shiftDate: "2026-06-10",
        isPastShiftDate,
      })
    ).toBe(false);
    expect(
      isPastUnconfirmedShift("pending", null, {
        shiftDate: "2026-06-20",
        isPastShiftDate,
      })
    ).toBe(false);
  });
});

describe("isPastConfirmedPlanningShift", () => {
  it("detects past shifts that are confirmed", () => {
    expect(
      isPastConfirmedPlanningShift(
        { shift_date: "2026-06-10", confirmationStatus: "confirmed" },
        isPastShiftDate
      )
    ).toBe(true);
    expect(
      isPastConfirmedPlanningShift(
        { shift_date: "2026-06-10", confirmationStatus: "pending" },
        isPastShiftDate
      )
    ).toBe(false);
    expect(
      isPastConfirmedPlanningShift(
        { shift_date: "2026-06-20", confirmationStatus: "confirmed" },
        isPastShiftDate
      )
    ).toBe(false);
  });

  it("uses the calendar cell date when provided", () => {
    expect(
      isPastConfirmedPlanningShift(
        { shift_date: "2026-06-20", confirmationStatus: "confirmed" },
        isPastShiftDate,
        "2026-06-10"
      )
    ).toBe(true);
  });

  it("treats missing status on past shifts as confirmed", () => {
    expect(
      isPastConfirmedPlanningShift(
        { shift_date: "2026-06-10" },
        isPastShiftDate
      )
    ).toBe(true);
  });
});

describe("planningShiftCardShowsPointerCursor", () => {
  it("hides pointer on past confirmed cells and keeps it for past unconfirmed", () => {
    const shift = {
      shift_date: "2026-06-10",
      confirmationStatus: "confirmed" as const,
    };
    expect(
      planningShiftCardShowsPointerCursor(shift, "2026-06-10", isPastShiftDate)
    ).toBe(false);
    expect(
      planningShiftCardShowsPointerCursor(
        { ...shift, confirmationStatus: "pending" },
        "2026-06-10",
        isPastShiftDate
      )
    ).toBe(true);
    expect(
      planningShiftCardShowsPointerCursor(shift, "2026-06-20", isPastShiftDate)
    ).toBe(true);
  });
});

describe("canOpenPastUnconfirmedShiftContextMenu", () => {
  it("matches isPastUnconfirmedShift", () => {
    const options = { shiftDate: "2026-06-10", isPastShiftDate };
    expect(canOpenPastUnconfirmedShiftContextMenu("rejected", null, options)).toBe(
      true
    );
    expect(canOpenPastUnconfirmedShiftContextMenu("confirmed", null, options)).toBe(
      false
    );
  });
});

describe("shiftCardContextMenuShowsEdit", () => {
  it("hides edit for pending and effective pending from overdue requested", () => {
    expect(shiftCardContextMenuShowsEdit("pending")).toBe(false);
    expect(
      shiftCardContextMenuShowsEdit("requested", "2020-01-01T00:00:00.000Z")
    ).toBe(false);
  });

  it("allows edit for other confirmation statuses", () => {
    expect(shiftCardContextMenuShowsEdit("proposed")).toBe(true);
    expect(shiftCardContextMenuShowsEdit("requested")).toBe(true);
    expect(shiftCardContextMenuShowsEdit("confirmed")).toBe(true);
  });

  it("hides edit for past unconfirmed cleanup menu", () => {
    expect(
      shiftCardContextMenuShowsEdit("pending", null, {
        shiftDate: "2026-06-10",
        isPastShiftDate,
      })
    ).toBe(false);
  });
});
