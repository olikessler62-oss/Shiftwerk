import { describe, expect, it } from "vitest";
import {
  confirmationBatchIsDelta,
  filterSendableProposedShifts,
  filterShiftsForConfirmationSendScope,
  isoWeekEndFromWeekStart,
  resolveConfirmationNotificationChannel,
  resolveConfirmationNotificationTemplateKey,
} from "./shift-confirmation-send";
import type { ShiftConfirmationSnapshot } from "./shift-confirmation-snapshot";

const shift = {
  id: "s1",
  organization_id: "org-1",
  employee_id: "emp-1",
  location_id: "loc-1",
  location_area_id: "area-1",
  area_shift_template_id: "tpl-1",
  shift_date: "2026-06-11",
  starts_at: "2026-06-11T08:00:00.000Z",
  ends_at: "2026-06-11T16:00:00.000Z",
  notes: null,
  confirmation_status: "proposed" as const,
};

describe("isoWeekEndFromWeekStart", () => {
  it("returns Sunday for Monday week start", () => {
    expect(isoWeekEndFromWeekStart("2026-06-08")).toBe("2026-06-14");
  });
});

describe("filterShiftsForConfirmationSendScope", () => {
  it("filters employee day scope", () => {
    const otherDay = { ...shift, id: "s2", shift_date: "2026-06-12" };
    const result = filterShiftsForConfirmationSendScope(
      [shift, otherDay],
      "employee_day",
      { employeeId: "emp-1", shiftDate: "2026-06-11" }
    );
    expect(result.map((row) => row.id)).toEqual(["s1"]);
  });

  it("filters single shift scope", () => {
    expect(
      filterShiftsForConfirmationSendScope([shift], "single_shift", {
        employeeId: "emp-1",
        shiftId: "s1",
      })
    ).toHaveLength(1);
  });
});

describe("filterSendableProposedShifts", () => {
  it("includes first-time proposed shifts", () => {
    expect(filterSendableProposedShifts([shift], new Map())).toHaveLength(1);
  });

  it("includes proposed shifts even when last snapshot matches", () => {
    const prior: ShiftConfirmationSnapshot = {
      employee_id: shift.employee_id,
      location_id: shift.location_id,
      location_area_id: shift.location_area_id,
      area_shift_template_id: shift.area_shift_template_id,
      shift_date: shift.shift_date,
      starts_at: shift.starts_at,
      ends_at: shift.ends_at,
      notes: shift.notes,
    };
    expect(
      filterSendableProposedShifts([shift], new Map([[shift.id, prior]]))
    ).toHaveLength(1);
  });

  it("includes delta shifts after plan change", () => {
    const prior: ShiftConfirmationSnapshot = {
      ...shift,
      ends_at: "2026-06-11T14:00:00.000Z",
      notes: null,
    };
    expect(
      filterSendableProposedShifts([shift], new Map([[shift.id, prior]]))
    ).toHaveLength(1);
  });
});

describe("confirmationBatchIsDelta", () => {
  it("detects delta when any shift had prior send", () => {
    const prior: ShiftConfirmationSnapshot = {
      employee_id: shift.employee_id,
      location_id: shift.location_id,
      location_area_id: shift.location_area_id,
      area_shift_template_id: shift.area_shift_template_id,
      shift_date: shift.shift_date,
      starts_at: shift.starts_at,
      ends_at: shift.ends_at,
      notes: null,
    };
    expect(confirmationBatchIsDelta([shift], new Map([[shift.id, prior]]))).toBe(
      true
    );
    expect(confirmationBatchIsDelta([shift], new Map())).toBe(false);
  });
});

describe("notification helpers", () => {
  it("uses email channel in fallback mode", () => {
    expect(
      resolveConfirmationNotificationChannel({ email_fallback_mode: true })
    ).toBe("email");
  });

  it("uses delta template when batch is delta", () => {
    expect(resolveConfirmationNotificationTemplateKey(true)).toBe(
      "confirmation_request_delta"
    );
    expect(resolveConfirmationNotificationTemplateKey(false)).toBe(
      "confirmation_request_week"
    );
  });
});
