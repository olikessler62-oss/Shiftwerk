import { describe, expect, it } from "vitest";
import {
  canOpenPastUnconfirmedShiftContextMenu,
  canOpenShiftCardContextMenu,
  handleShiftCardContextMenuPointerEvent,
  isPastConfirmedPlanningShift,
  isPastUnconfirmedShift,
  planningShiftCardShowsPointerCursor,
  shiftCardContextMenuActions,
  shiftCardContextMenuShowsEdit,
} from "@/lib/shift-card-context-menu-actions";

const isPastShiftDate = (date: string) => date < "2026-06-17";

describe("handleShiftCardContextMenuPointerEvent", () => {
  it("always suppresses the native context menu", () => {
    let prevented = false;
    let stopped = false;
    let opened = false;
    handleShiftCardContextMenuPointerEvent(
      {
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation: () => {
          stopped = true;
        },
      },
      false,
      () => {
        opened = true;
      }
    );
    expect(prevented).toBe(true);
    expect(stopped).toBe(true);
    expect(opened).toBe(false);
  });
});

describe("canOpenShiftCardContextMenu", () => {
  it("allows confirmed future shifts with storno menu", () => {
    expect(
      canOpenShiftCardContextMenu("confirmed", null, {
        shiftDate: "2026-06-20",
        isPastShiftDate,
      })
    ).toBe(true);
    expect(canOpenShiftCardContextMenu("proposed")).toBe(true);
    expect(canOpenShiftCardContextMenu("pending")).toBe(true);
  });

  it("allows past unconfirmed cleanup menu", () => {
    const options = { shiftDate: "2026-06-10", isPastShiftDate };
    expect(canOpenShiftCardContextMenu("pending", null, options)).toBe(true);
    expect(canOpenShiftCardContextMenu("confirmed", null, options)).toBe(false);
  });

  it("allows legacy delete fallback without confirmation", () => {
    expect(
      canOpenShiftCardContextMenu(undefined, null, {
        shiftDate: "2026-06-20",
        isPastShiftDate,
        legacyDeleteFallback: true,
      })
    ).toBe(true);
  });

  it("blocks past confirmed even with legacy delete fallback", () => {
    expect(
      canOpenShiftCardContextMenu("confirmed", null, {
        shiftDate: "2026-06-10",
        cellDate: "2026-06-10",
        isPastShiftDate,
        legacyDeleteFallback: true,
      })
    ).toBe(false);
  });
});

describe("shiftCardContextMenuActions", () => {
  it("maps each status to the Schicht-Stati tab actions", () => {
    expect(shiftCardContextMenuActions("proposed")).toEqual([
      "requestConfirmation",
      "delete",
    ]);
    expect(shiftCardContextMenuActions("requested")).toEqual(["cancel"]);
    expect(shiftCardContextMenuActions("confirmed", null, {
      shiftDate: "2026-06-20",
      isPastShiftDate,
    })).toEqual(["cancel"]);
    expect(shiftCardContextMenuActions("rejected")).toEqual([
      "reassign",
      "delete",
    ]);
    expect(shiftCardContextMenuActions("pending")).toEqual([
      "cancel",
      "requestConfirmation",
    ]);
    expect(shiftCardContextMenuActions("canceled")).toEqual([
      "reassign",
      "delete",
    ]);
  });

  it("offers delete and setConfirmed for past unconfirmed shifts", () => {
    const options = { shiftDate: "2026-06-10", cellDate: "2026-06-10", isPastShiftDate };
    expect(shiftCardContextMenuActions("pending", null, options)).toEqual([
      "delete",
      "setConfirmed",
    ]);
    expect(shiftCardContextMenuActions("requested", null, options)).toEqual([
      "delete",
      "setConfirmed",
    ]);
    expect(shiftCardContextMenuActions("confirmed", null, options)).toEqual([]);
  });

  it("uses conflict tab actions when flagged", () => {
    expect(
      shiftCardContextMenuActions("proposed", null, {
        shiftDate: "2026-06-20",
        isPastShiftDate,
        hasAbsenceConflict: true,
      })
    ).toEqual(["reassign", "cancel", "delete"]);
  });

  it("ignores absence conflict for confirmed shifts", () => {
    expect(
      shiftCardContextMenuActions("confirmed", null, {
        shiftDate: "2026-06-20",
        isPastShiftDate,
        hasAbsenceConflict: true,
      })
    ).toEqual(["cancel"]);
    expect(
      shiftCardContextMenuActions("confirmed", null, {
        shiftDate: "2026-06-10",
        cellDate: "2026-06-10",
        isPastShiftDate,
        hasAbsenceConflict: true,
      })
    ).toEqual([]);
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

  it("uses cellDate when it differs from shiftDate", () => {
    expect(
      isPastUnconfirmedShift("pending", null, {
        shiftDate: "2026-06-20",
        cellDate: "2026-06-10",
        isPastShiftDate,
      })
    ).toBe(true);
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
  it("hides pointer on past confirmed cells and keeps it for proposed future shifts", () => {
    const shift = {
      id: "s1",
      shift_date: "2026-06-10",
      confirmationStatus: "confirmed" as const,
    };
    expect(
      planningShiftCardShowsPointerCursor(shift, "2026-06-10", isPastShiftDate)
    ).toBe(false);
    expect(
      planningShiftCardShowsPointerCursor(
        { ...shift, shift_date: "2026-06-20", confirmationStatus: "pending" },
        "2026-06-20",
        isPastShiftDate
      )
    ).toBe(false);
    expect(
      planningShiftCardShowsPointerCursor(
        { ...shift, shift_date: "2026-06-20", confirmationStatus: "proposed" },
        "2026-06-20",
        isPastShiftDate
      )
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
  it("never shows edit in context menu", () => {
    expect(shiftCardContextMenuShowsEdit("proposed")).toBe(false);
    expect(shiftCardContextMenuShowsEdit("requested")).toBe(false);
    expect(shiftCardContextMenuShowsEdit("confirmed")).toBe(false);
  });
});
