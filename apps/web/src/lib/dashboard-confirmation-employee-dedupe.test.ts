import { describe, expect, it } from "vitest";
import type { PlanningShift } from "@/lib/planning-shift-card";
import {
  compareDashboardConfirmationConflictPriority,
  dedupeConfirmationShiftsByEmployeeSlot,
} from "./dashboard-confirmation-employee-dedupe";

function shift(
  overrides: Partial<PlanningShift> & Pick<PlanningShift, "id" | "employee_id">
): PlanningShift {
  return {
    shift_date: "2026-06-28",
    shiftName: "Früh",
    color: "#000",
    startTime: "08:00",
    endTime: "16:00",
    location_area_id: "area-1",
    area_shift_template_id: null,
    confirmationStatus: "pending",
    ...overrides,
  };
}

describe("compareDashboardConfirmationConflictPriority", () => {
  it("prefers rejected over pending and requested", () => {
    expect(
      compareDashboardConfirmationConflictPriority("rejected", "pending")
    ).toBeGreaterThan(0);
    expect(
      compareDashboardConfirmationConflictPriority("pending", "requested")
    ).toBeGreaterThan(0);
  });
});

describe("dedupeConfirmationShiftsByEmployeeSlot", () => {
  it("keeps only the highest-priority status per employee slot", () => {
    const deduped = dedupeConfirmationShiftsByEmployeeSlot([
      shift({
        id: "pending-shift",
        employee_id: "patricia",
        confirmationStatus: "pending",
      }),
      shift({
        id: "rejected-shift",
        employee_id: "patricia",
        confirmationStatus: "rejected",
        confirmationStatusUpdatedAt: "2026-06-27T10:00:00.000Z",
      }),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("rejected-shift");
    expect(deduped[0]?.confirmationStatus).toBe("rejected");
  });

  it("keeps separate employees untouched", () => {
    const deduped = dedupeConfirmationShiftsByEmployeeSlot([
      shift({ id: "s-1", employee_id: "emp-1", confirmationStatus: "pending" }),
      shift({ id: "s-2", employee_id: "emp-2", confirmationStatus: "rejected" }),
    ]);

    expect(deduped).toHaveLength(2);
  });

  it("collapses duplicate rejected shifts for the same employee slot", () => {
    const deduped = dedupeConfirmationShiftsByEmployeeSlot([
      shift({
        id: "rejected-older",
        employee_id: "patricia",
        shift_date: "2026-07-04",
        startTime: "18:00",
        endTime: "22:00",
        confirmationStatus: "rejected",
        confirmationStatusUpdatedAt: "2026-07-01T10:00:00.000Z",
      }),
      shift({
        id: "rejected-newer",
        employee_id: "patricia",
        shift_date: "2026-07-04",
        startTime: "18:00",
        endTime: "22:00",
        confirmationStatus: "rejected",
        confirmationStatusUpdatedAt: "2026-07-02T10:00:00.000Z",
      }),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("rejected-newer");
  });

  it("keeps separate slots for the same employee on one day", () => {
    const deduped = dedupeConfirmationShiftsByEmployeeSlot([
      shift({
        id: "morning",
        employee_id: "patricia",
        startTime: "08:00",
        endTime: "12:00",
        confirmationStatus: "rejected",
      }),
      shift({
        id: "evening",
        employee_id: "patricia",
        startTime: "18:00",
        endTime: "22:00",
        confirmationStatus: "rejected",
      }),
    ]);

    expect(deduped).toHaveLength(2);
  });
});
