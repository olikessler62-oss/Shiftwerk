import { describe, expect, it } from "vitest";
import {
  SHIFT_CONFIRMATION_CANCELED_DOT_CLASS,
  SHIFT_CONFIRMATION_CONFIRMED_TOOLTIP_TEXT_CLASS,
  SHIFT_CONFIRMATION_PAST_SHIFT_STATUS_TEXT_CLASS,
  SHIFT_CONFIRMATION_PENDING_DOT_CLASS,
  SHIFT_CONFIRMATION_REJECTED_DOT_CLASS,
  SHIFT_CONFIRMATION_REQUESTED_DOT_CLASS,
  SHIFT_CONFIRMATION_UNRESOLVED_DOT_CLASS,
  SHIFT_CONFIRMATION_UNRESOLVED_TOOLTIP_TEXT_CLASS,
  shiftConfirmationCardStatusTextClass,
  shiftConfirmationConflictDotClass,
} from "@/lib/shift-confirmation-display";

describe("shiftConfirmationConflictDotClass", () => {
  it("matches list status accent colors", () => {
    expect(shiftConfirmationConflictDotClass("requested")).toBe(
      SHIFT_CONFIRMATION_REQUESTED_DOT_CLASS
    );
    expect(shiftConfirmationConflictDotClass("pending")).toBe(
      SHIFT_CONFIRMATION_PENDING_DOT_CLASS
    );
    expect(shiftConfirmationConflictDotClass("rejected")).toBe(
      SHIFT_CONFIRMATION_REJECTED_DOT_CLASS
    );
    expect(shiftConfirmationConflictDotClass("canceled")).toBe(
      SHIFT_CONFIRMATION_CANCELED_DOT_CLASS
    );
    expect(shiftConfirmationConflictDotClass("unresolved")).toBe(
      SHIFT_CONFIRMATION_UNRESOLVED_DOT_CLASS
    );
  });
});

describe("shiftConfirmationCardStatusTextClass", () => {
  it("uses dark gray for past shifts regardless of status", () => {
    expect(
      shiftConfirmationCardStatusTextClass("confirmed", true)
    ).toBe(SHIFT_CONFIRMATION_PAST_SHIFT_STATUS_TEXT_CLASS);
    expect(
      shiftConfirmationCardStatusTextClass("requested", true)
    ).toBe(SHIFT_CONFIRMATION_PAST_SHIFT_STATUS_TEXT_CLASS);
  });

  it("uses unresolved styling even on past shifts", () => {
    expect(
      shiftConfirmationCardStatusTextClass("unresolved", true)
    ).toBe(SHIFT_CONFIRMATION_UNRESOLVED_TOOLTIP_TEXT_CLASS);
  });

  it("keeps status colors for current and future shifts", () => {
    expect(
      shiftConfirmationCardStatusTextClass("confirmed", false)
    ).toBe(SHIFT_CONFIRMATION_CONFIRMED_TOOLTIP_TEXT_CLASS);
  });
});
