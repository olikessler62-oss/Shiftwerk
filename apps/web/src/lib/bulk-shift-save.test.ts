import { describe, expect, it } from "vitest";
import {
  isSaveableNewBulkShiftRow,
  resolveBulkShiftSaveIntent,
} from "./bulk-shift-save";

const completeNewRow = {
  id: "new-1",
  employeeId: "emp-1",
  qualificationId: "qual-1",
  startTime: "08:00",
  endTime: "16:00",
};

const existingRow = {
  ...completeNewRow,
  id: "existing-row",
  existingShiftId: "shift-1",
};

describe("isSaveableNewBulkShiftRow", () => {
  it("accepts complete rows without existingShiftId", () => {
    expect(isSaveableNewBulkShiftRow(completeNewRow)).toBe(true);
  });

  it("rejects rows that belong to an existing shift", () => {
    expect(isSaveableNewBulkShiftRow(existingRow)).toBe(false);
  });
});

describe("resolveBulkShiftSaveIntent", () => {
  it("persists saveable new rows", () => {
    expect(
      resolveBulkShiftSaveIntent([existingRow, completeNewRow], false)
    ).toEqual({
      kind: "persist",
      saveableRows: [completeNewRow],
    });
  });

  it("rejects incomplete unsaved rows", () => {
    expect(
      resolveBulkShiftSaveIntent(
        [
          existingRow,
          {
            id: "empty-new",
            employeeId: "",
            qualificationId: "",
            startTime: "00:00",
            endTime: "00:00",
          },
        ],
        false
      )
    ).toEqual({ kind: "reject-unsaved-incomplete" });
  });

  it("closes when only existing rows remain unchanged", () => {
    expect(resolveBulkShiftSaveIntent([existingRow], false)).toEqual({
      kind: "close-without-changes",
    });
  });
});
