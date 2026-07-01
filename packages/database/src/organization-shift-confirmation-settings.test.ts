import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES,
  formatShiftConfirmationPendingAfterDuration,
  isValidShiftConfirmationPendingAfterMinutes,
  parseShiftConfirmationPendingAfterDuration,
  resolveOrganizationShiftConfirmationPendingAfterMinutes,
} from "./organization-shift-confirmation-settings";

describe("organization shift confirmation pending settings", () => {
  it("defaults to three hours", () => {
    expect(DEFAULT_SHIFT_CONFIRMATION_PENDING_AFTER_MINUTES).toBe(180);
    expect(resolveOrganizationShiftConfirmationPendingAfterMinutes(null)).toBe(
      180
    );
  });

  it("formats and parses HH:MM durations", () => {
    expect(formatShiftConfirmationPendingAfterDuration(180)).toBe("03:00");
    expect(formatShiftConfirmationPendingAfterDuration(5)).toBe("00:05");
    expect(parseShiftConfirmationPendingAfterDuration("02:30")).toBe(150);
    expect(parseShiftConfirmationPendingAfterDuration("00:05")).toBe(5);
    expect(parseShiftConfirmationPendingAfterDuration("invalid")).toBeNull();
  });

  it("validates selectable duration options", () => {
    expect(isValidShiftConfirmationPendingAfterMinutes(5)).toBe(true);
    expect(isValidShiftConfirmationPendingAfterMinutes(30)).toBe(true);
    expect(isValidShiftConfirmationPendingAfterMinutes(45)).toBe(false);
    expect(isValidShiftConfirmationPendingAfterMinutes(1440)).toBe(true);
    expect(isValidShiftConfirmationPendingAfterMinutes(1470)).toBe(false);
  });

  it("reads organization-specific minutes", () => {
    expect(
      resolveOrganizationShiftConfirmationPendingAfterMinutes({
        shift_confirmation_pending_after_minutes: 90,
      })
    ).toBe(90);
  });
});
