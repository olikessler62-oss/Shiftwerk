import { describe, expect, it } from "vitest";
import { sortBulkShiftRowsByColumn } from "@/lib/bulk-shift-row-sort";

const rows = [
  {
    id: "1",
    shiftTypeId: "b",
    shiftTypeName: "B",
    qualificationId: "q2",
    qualificationName: "Küche",
    startTime: "10:00",
    endTime: "14:00",
    employeeId: "e2",
    employeeName: "Anna Müller",
  },
  {
    id: "2",
    shiftTypeId: "a",
    shiftTypeName: "A",
    qualificationId: "q1",
    qualificationName: "Bar",
    startTime: "08:00",
    endTime: "12:00",
    employeeId: "e1",
    employeeName: "Tom Schmidt",
  },
  {
    id: "3",
    shiftTypeId: "",
    shiftTypeName: "",
    qualificationId: "",
    qualificationName: "",
    startTime: "00:00",
    endTime: "00:00",
    employeeId: "",
    employeeName: "",
  },
];

describe("sortBulkShiftRowsByColumn", () => {
  it("sorts by start time ascending with incomplete rows last", () => {
    const sorted = sortBulkShiftRowsByColumn(rows, "startTime", "asc");
    expect(sorted.map((row) => row.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by employee surname descending with empty rows first", () => {
    const sorted = sortBulkShiftRowsByColumn(rows, "employee", "desc");
    expect(sorted.map((row) => row.id)).toEqual(["3", "2", "1"]);
  });

  it("returns original order when sort inactive", () => {
    expect(sortBulkShiftRowsByColumn(rows, null, null).map((row) => row.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });
});
