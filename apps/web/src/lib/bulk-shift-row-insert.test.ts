import { describe, expect, it } from "vitest";
import {
  bulkShiftRowsMatchForGrouping,
  insertBulkShiftRowInList,
  isBulkShiftEmployeeSortActive,
} from "./bulk-shift-row-insert";

const row = (
  id: string,
  patch: Partial<{
    shiftTypeId: string;
    qualificationId: string;
    startTime: string;
    endTime: string;
  }> = {}
) => ({
  id,
  shiftTypeId: "tpl-1",
  qualificationId: "job-1",
  startTime: "12:00",
  endTime: "15:00",
  ...patch,
});

describe("bulkShiftRowsMatchForGrouping", () => {
  it("matches template, job and times", () => {
    expect(
      bulkShiftRowsMatchForGrouping(row("a"), row("b"))
    ).toBe(true);
  });

  it("does not match different job", () => {
    expect(
      bulkShiftRowsMatchForGrouping(row("a"), row("b", { qualificationId: "x" }))
    ).toBe(false);
  });
});

describe("insertBulkShiftRowInList", () => {
  it("prepends when employee sort is active", () => {
    const existing = [row("1"), row("2")];
    const next = row("new");
    expect(
      insertBulkShiftRowInList(existing, next, true).map((r) => r.id)
    ).toEqual(["new", "1", "2"]);
  });

  it("inserts above first matching row when employee sort is off", () => {
    const existing = [
      row("other", { shiftTypeId: "x", startTime: "08:00", endTime: "10:00" }),
      row("match-1"),
      row("match-2"),
    ];
    const next = row("new");
    expect(
      insertBulkShiftRowInList(existing, next, false).map((r) => r.id)
    ).toEqual(["other", "new", "match-1", "match-2"]);
  });

  it("prepends when no peer exists and employee sort is off", () => {
    const existing = [row("1", { shiftTypeId: "x" })];
    const next = row("new");
    expect(
      insertBulkShiftRowInList(existing, next, false).map((r) => r.id)
    ).toEqual(["new", "1"]);
  });
});

describe("isBulkShiftEmployeeSortActive", () => {
  it("is true only for employee asc/desc", () => {
    expect(isBulkShiftEmployeeSortActive("employee", "asc")).toBe(true);
    expect(isBulkShiftEmployeeSortActive("template", "asc")).toBe(false);
    expect(isBulkShiftEmployeeSortActive(null, null)).toBe(false);
  });
});
