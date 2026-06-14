import { describe, expect, it } from "vitest";
import { buildShiftDeletionSnapshot } from "./shift-deletion-audit";

describe("buildShiftDeletionSnapshot", () => {
  it("captures shift fields before deletion", () => {
    const snapshot = buildShiftDeletionSnapshot({
      id: "shift-1",
      employee_id: "emp-1",
      area_shift_template_id: "tpl-1",
      location_id: "loc-1",
      location_area_id: "area-1",
      shift_date: "2026-06-14",
      starts_at: "2026-06-14T06:00:00.000Z",
      ends_at: "2026-06-14T08:00:00.000Z",
      notes: null,
      created_by: "mgr-1",
      confirmation_status: "proposed",
      requested_at: null,
      pending_since: null,
      pending_reminder_sent_at: null,
    });

    expect(snapshot).toEqual({
      id: "shift-1",
      employee_id: "emp-1",
      area_shift_template_id: "tpl-1",
      location_id: "loc-1",
      location_area_id: "area-1",
      shift_date: "2026-06-14",
      starts_at: "2026-06-14T06:00:00.000Z",
      ends_at: "2026-06-14T08:00:00.000Z",
      notes: null,
      created_by: "mgr-1",
      confirmation_status: "proposed",
      requested_at: null,
      pending_since: null,
      pending_reminder_sent_at: null,
    });
  });
});
