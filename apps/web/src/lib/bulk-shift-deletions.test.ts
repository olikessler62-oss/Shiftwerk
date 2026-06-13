import { describe, expect, it } from "vitest";
import {
  filterLocationDayAssignmentsForBulkModal,
  resolveBulkShiftDeletedIds,
  resolveRemainingAreaAssignments,
} from "./bulk-shift-deletions";

const existingShifts = [
  {
    id: "shift-a",
    employeeId: "emp-1",
    startTime: "08:00",
    endTime: "12:00",
  },
  {
    id: "shift-b",
    employeeId: "emp-2",
    startTime: "12:00",
    endTime: "16:00",
  },
];

describe("resolveBulkShiftDeletedIds", () => {
  it("returns ids removed from the modal rows", () => {
    expect(
      resolveBulkShiftDeletedIds(existingShifts, [
        { existingShiftId: "shift-a" },
      ])
    ).toEqual(["shift-b"]);
  });

  it("returns all ids when every existing row was deleted", () => {
    expect(resolveBulkShiftDeletedIds(existingShifts, [])).toEqual([
      "shift-a",
      "shift-b",
    ]);
  });
});

describe("resolveRemainingAreaAssignments", () => {
  it("keeps assignments for remaining existing rows only", () => {
    expect(
      resolveRemainingAreaAssignments(existingShifts, [
        { existingShiftId: "shift-b" },
      ])
    ).toEqual([
      {
        employeeId: "emp-2",
        startTime: "12:00",
        endTime: "16:00",
      },
    ]);
  });
});

describe("filterLocationDayAssignmentsForBulkModal", () => {
  it("drops deleted assignments in the current area", () => {
    const filtered = filterLocationDayAssignmentsForBulkModal(
      [
        {
          employeeId: "emp-1",
          startTime: "08:00",
          endTime: "12:00",
          locationAreaId: "area-1",
        },
        {
          employeeId: "emp-2",
          startTime: "12:00",
          endTime: "16:00",
          locationAreaId: "area-1",
        },
        {
          employeeId: "emp-3",
          startTime: "09:00",
          endTime: "13:00",
          locationAreaId: "area-2",
        },
      ],
      existingShifts,
      [{ existingShiftId: "shift-a" }],
      "area-1"
    );

    expect(filtered).toEqual([
      {
        employeeId: "emp-1",
        startTime: "08:00",
        endTime: "12:00",
        locationAreaId: "area-1",
      },
      {
        employeeId: "emp-3",
        startTime: "09:00",
        endTime: "13:00",
        locationAreaId: "area-2",
      },
    ]);
  });
});
