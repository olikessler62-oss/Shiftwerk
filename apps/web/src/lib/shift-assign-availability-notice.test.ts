import { describe, expect, it } from "vitest";
import {
  evaluateShiftAssignAvailabilityConflict,
  isEmployeeShiftOutsideAvailability,
  isShiftAssignAvailabilityConflictError,
} from "@/lib/shift-assign-availability-notice";

describe("shift assign availability notice", () => {
  const employee = {
    id: "emp-1",
    full_name: "Alex",
    color: "#000",
    last_shift_date: null,
    availabilities: [{ weekday: 1, start_time: "08:00", end_time: "16:00" }],
  };

  it("detects shift times outside employee availability", () => {
    expect(
      isEmployeeShiftOutsideAvailability(employee, 1, "16:00", "20:00")
    ).toBe(true);
    expect(
      isEmployeeShiftOutsideAvailability(employee, 1, "08:00", "16:00")
    ).toBe(false);
  });

  it("evaluates conflict for selected employee", () => {
    expect(
      evaluateShiftAssignAvailabilityConflict({
        employeeId: "emp-1",
        employees: [employee],
        weekday: 1,
        startTime: "16:00",
        endTime: "20:00",
      })
    ).toBe(true);
    expect(
      evaluateShiftAssignAvailabilityConflict({
        employeeId: "",
        employees: [employee],
        weekday: 1,
        startTime: "16:00",
        endTime: "20:00",
      })
    ).toBe(false);
  });

  it("recognises server availability conflict errors", () => {
    expect(
      isShiftAssignAvailabilityConflictError(
        "Schichtzeit liegt außerhalb der Verfügbarkeit des Personals."
      )
    ).toBe(true);
    expect(isShiftAssignAvailabilityConflictError("Speichern fehlgeschlagen")).toBe(
      false
    );
  });
});
