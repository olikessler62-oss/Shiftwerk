import { describe, expect, it } from "vitest";
import {
  SHIFT_CONFIRMATION_CONFIRMED_TOOLTIP_TEXT_CLASS,
  SHIFT_CONFIRMATION_PAST_SHIFT_STATUS_TEXT_CLASS,
  shiftConfirmationCardStatusTextClass,
} from "@/lib/shift-confirmation-display";

describe("shiftConfirmationCardStatusTextClass", () => {
  it("uses dark gray for past shifts regardless of status", () => {
    expect(
      shiftConfirmationCardStatusTextClass("confirmed", true)
    ).toBe(SHIFT_CONFIRMATION_PAST_SHIFT_STATUS_TEXT_CLASS);
    expect(
      shiftConfirmationCardStatusTextClass("requested", true)
    ).toBe(SHIFT_CONFIRMATION_PAST_SHIFT_STATUS_TEXT_CLASS);
  });

  it("keeps status colors for current and future shifts", () => {
    expect(
      shiftConfirmationCardStatusTextClass("confirmed", false)
    ).toBe(SHIFT_CONFIRMATION_CONFIRMED_TOOLTIP_TEXT_CLASS);
  });
});
