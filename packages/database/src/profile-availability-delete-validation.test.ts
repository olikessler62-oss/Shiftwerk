import { describe, expect, it } from "vitest";
import type { EmployeeShiftRecord, ProfileRecurringAvailability } from "@schichtwerk/types";
import {
  PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR,
  wouldDeletingAvailabilitySlotConflictWithFutureShifts,
} from "./profile-availability-delete-validation";
import { buildShiftTimestamps } from "./shift-timestamps";

const employeeId = "emp-1";
const timeZone = "Europe/Berlin";
const countryCode = "DE";
const todayISO = "2026-06-17";

function slot(
  overrides: Partial<ProfileRecurringAvailability> = {}
): ProfileRecurringAvailability {
  return {
    id: "slot-1",
    organization_id: "org-1",
    profile_id: employeeId,
    weekday: 2,
    start_time: "08:00:00",
    end_time: "16:00:00",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function shift(
  shiftDate: string,
  startTime: string,
  endTime: string,
  overrides: Partial<EmployeeShiftRecord> = {}
): EmployeeShiftRecord {
  const { starts_at, ends_at } = buildShiftTimestamps(
    shiftDate,
    startTime,
    endTime,
    timeZone
  );
  return {
    id: `shift-${shiftDate}`,
    employee_id: employeeId,
    location_id: "loc-1",
    location_area_id: "area-1",
    area_shift_template_id: null,
    shift_date: shiftDate,
    starts_at,
    ends_at,
    notes: null,
    created_by: "mgr-1",
    confirmation_status: "confirmed",
    requested_at: null,
    pending_since: null,
    pending_reminder_sent_at: null,
    ...overrides,
  };
}

describe("wouldDeletingAvailabilitySlotConflictWithFutureShifts", () => {
  it("allows delete when no future shifts exist", () => {
    expect(
      wouldDeletingAvailabilitySlotConflictWithFutureShifts({
        slotToDelete: slot(),
        remainingAvailability: [],
        futureShifts: [],
        countryCode,
        timeZone,
        todayISO,
      })
    ).toEqual({ ok: true });
  });

  it("ignores shifts on past dates", () => {
    expect(
      wouldDeletingAvailabilitySlotConflictWithFutureShifts({
        slotToDelete: slot(),
        remainingAvailability: [],
        futureShifts: [shift("2026-06-10", "09:00", "17:00")],
        countryCode,
        timeZone,
        todayISO,
      })
    ).toEqual({ ok: true });
  });

  it("ignores shifts on other weekdays", () => {
    expect(
      wouldDeletingAvailabilitySlotConflictWithFutureShifts({
        slotToDelete: slot({ weekday: 2 }),
        remainingAvailability: [],
        futureShifts: [shift("2026-06-18", "09:00", "17:00")],
        countryCode,
        timeZone,
        todayISO,
      })
    ).toEqual({ ok: true });
  });

  it("ignores shifts outside the slot time window", () => {
    expect(
      wouldDeletingAvailabilitySlotConflictWithFutureShifts({
        slotToDelete: slot({ start_time: "08:00:00", end_time: "12:00:00" }),
        remainingAvailability: [],
        futureShifts: [shift("2026-06-24", "13:00", "17:00")],
        countryCode,
        timeZone,
        todayISO,
      })
    ).toEqual({ ok: true });
  });

  it("blocks delete when a future shift depends on the slot", () => {
    expect(
      wouldDeletingAvailabilitySlotConflictWithFutureShifts({
        slotToDelete: slot(),
        remainingAvailability: [],
        futureShifts: [shift("2026-06-24", "09:00", "15:00")],
        countryCode,
        timeZone,
        todayISO,
      })
    ).toEqual({
      ok: false,
      error: PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR,
    });
  });

  it("allows delete when another slot still covers the shift", () => {
    const slotToDelete = slot({ id: "slot-wide", start_time: "08:00:00", end_time: "18:00:00" });
    const remaining = [
      slot({ id: "slot-core", start_time: "08:00:00", end_time: "16:00:00" }),
    ];

    expect(
      wouldDeletingAvailabilitySlotConflictWithFutureShifts({
        slotToDelete,
        remainingAvailability: remaining,
        futureShifts: [shift("2026-06-24", "09:00", "15:00")],
        countryCode,
        timeZone,
        todayISO,
      })
    ).toEqual({ ok: true });
  });

  it("matches holiday shifts against holiday availability slots", () => {
    expect(
      wouldDeletingAvailabilitySlotConflictWithFutureShifts({
        slotToDelete: slot({ weekday: 7, start_time: "09:00:00", end_time: "17:00:00" }),
        remainingAvailability: [],
        futureShifts: [shift("2026-05-14", "10:00", "16:00")],
        countryCode,
        timeZone,
        todayISO: "2026-05-01",
      })
    ).toEqual({
      ok: false,
      error: PROFILE_AVAILABILITY_DELETE_SHIFT_CONFLICT_ERROR,
    });
  });
});
