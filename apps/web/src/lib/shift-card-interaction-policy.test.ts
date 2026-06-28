import { describe, expect, it } from "vitest";
import {
  planningShiftCardShowsPointerCursor,
  resolveShiftCardPrimaryClick,
  resolveShiftCardInteractionContext,
} from "@/lib/shift-card-interaction-policy";

const isPastShiftDate = (date: string) => date < "2026-06-17";

function context(
  shiftDate: string,
  cellDate: string,
  options?: {
    shiftConfirmationEnabled?: boolean;
    hasAbsenceConflict?: boolean;
    hasSwapRequest?: boolean;
  }
) {
  return resolveShiftCardInteractionContext(
    { id: "s1", shift_date: shiftDate },
    cellDate,
    isPastShiftDate,
    options
  );
}

describe("resolveShiftCardPrimaryClick", () => {
  it("routes proposed to edit and pending to none", () => {
    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "proposed" },
        context("2026-06-20", "2026-06-20")
      )
    ).toEqual({ kind: "edit" });

    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "pending" },
        context("2026-06-20", "2026-06-20")
      )
    ).toEqual({ kind: "none" });
  });

  it("routes requested and rejected/canceled to communication hub", () => {
    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "requested" },
        context("2026-06-20", "2026-06-20")
      )
    ).toEqual({ kind: "communicationHub", category: "requested" });

    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "rejected" },
        context("2026-06-20", "2026-06-20")
      )
    ).toEqual({ kind: "communicationHub", category: "rejected" });

    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "canceled" },
        context("2026-06-20", "2026-06-20")
      )
    ).toEqual({ kind: "communicationHub", category: "canceled" });
  });

  it("blocks confirmed and past unconfirmed primary clicks", () => {
    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "confirmed" },
        context("2026-06-20", "2026-06-20")
      )
    ).toEqual({ kind: "none" });

    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-10", confirmationStatus: "pending" },
        context("2026-06-10", "2026-06-10")
      )
    ).toEqual({ kind: "none" });
  });

  it("prioritizes conflicts and swaps over status", () => {
    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "proposed" },
        context("2026-06-20", "2026-06-20", { hasAbsenceConflict: true })
      )
    ).toEqual({ kind: "communicationHub", category: "conflicts" });

    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "confirmed" },
        context("2026-06-20", "2026-06-20", { hasAbsenceConflict: true })
      )
    ).toEqual({ kind: "none" });

    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "requested" },
        context("2026-06-20", "2026-06-20", { hasSwapRequest: true })
      )
    ).toEqual({ kind: "communicationHub", category: "swaps" });
  });

  it("falls back to edit when confirmation is disabled", () => {
    expect(
      resolveShiftCardPrimaryClick(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "confirmed" },
        context("2026-06-20", "2026-06-20", { shiftConfirmationEnabled: false })
      )
    ).toEqual({ kind: "edit" });
  });
});

describe("planningShiftCardShowsPointerCursor", () => {
  it("matches primary click availability", () => {
    expect(
      planningShiftCardShowsPointerCursor(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "confirmed" },
        "2026-06-20",
        isPastShiftDate
      )
    ).toBe(false);

    expect(
      planningShiftCardShowsPointerCursor(
        { id: "s1", shift_date: "2026-06-20", confirmationStatus: "proposed" },
        "2026-06-20",
        isPastShiftDate
      )
    ).toBe(true);
  });
});
