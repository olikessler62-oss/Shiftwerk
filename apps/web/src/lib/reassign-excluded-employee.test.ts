import { describe, expect, it } from "vitest";
import {
  areaAssignmentsExcludingReplacedShift,
  excludeEmployeeFromReassignSuggestions,
  resolveEmployeeIdForReassignShift,
} from "./available-employees-for-shift";

describe("reassign excluded employee helpers", () => {
  it("resolves employee id for shift being replaced", () => {
    expect(
      resolveEmployeeIdForReassignShift("shift-1", [
        { id: "shift-1", employee_id: "emp-a" },
        { id: "shift-2", employee_id: "emp-b" },
      ])
    ).toBe("emp-a");
    expect(resolveEmployeeIdForReassignShift("missing", [])).toBeNull();
  });

  it("excludes declined employee from suggestion list", () => {
    const employees = [
      { id: "emp-a", full_name: "Anna" },
      { id: "emp-b", full_name: "Ben" },
    ];
    expect(
      excludeEmployeeFromReassignSuggestions(employees, "emp-a").map((e) => e.id)
    ).toEqual(["emp-b"]);
    expect(excludeEmployeeFromReassignSuggestions(employees, null)).toEqual(
      employees
    );
  });

  it("removes replaced shift assignment window from overlap context", () => {
    const assignments = [
      { employeeId: "emp-a", startTime: "08:00", endTime: "16:00" },
      { employeeId: "emp-b", startTime: "08:00", endTime: "16:00" },
    ];
    expect(
      areaAssignmentsExcludingReplacedShift(assignments, {
        existingShiftId: "shift-1",
        employeeId: "emp-a",
        startTime: "08:00",
        endTime: "16:00",
      })
    ).toEqual([{ employeeId: "emp-b", startTime: "08:00", endTime: "16:00" }]);
  });
});
