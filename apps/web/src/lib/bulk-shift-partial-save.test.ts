import { describe, expect, it } from "vitest";
import { resolveBulkShiftPartialSaveOutcome } from "./bulk-shift-partial-save";

describe("resolveBulkShiftPartialSaveOutcome", () => {
  it("maps batch rowIndex to payload rows and keeps unsubmitted rows", () => {
    const existing = {
      id: "existing",
      employeeId: "emp-existing",
      startTime: "08:00",
      endTime: "10:00",
    };
    const failed = {
      id: "failed",
      employeeId: "emp-failed",
      startTime: "12:00",
      endTime: "15:00",
    };
    const succeeded = {
      id: "saved",
      employeeId: "emp-saved",
      startTime: "18:00",
      endTime: "22:00",
    };
    const incomplete = {
      id: "incomplete",
      employeeId: "",
      startTime: "",
      endTime: "",
    };

    const payloadRows = [
      { row: failed, payloadIndex: 0 },
      { row: succeeded, payloadIndex: 1 },
    ];

    const outcome = resolveBulkShiftPartialSaveOutcome({
      currentRows: [existing, failed, succeeded, incomplete],
      payloadRows,
      failedResults: [{ rowIndex: 0, error: "Ruhezeit" }],
      resolveEmployeeName: (employeeId) =>
        employeeId === "emp-failed" ? "Max Mustermann" : employeeId,
      createEmptyRow: () => ({
        id: "empty",
        employeeId: "",
        startTime: "00:00",
        endTime: "00:00",
      }),
    });

    expect(outcome.remainingRows.map((row) => row.id)).toEqual([
      "existing",
      "failed",
      "incomplete",
    ]);
    expect(outcome.failures).toEqual([
      {
        name: "Max Mustermann",
        startTime: "12:00",
        endTime: "15:00",
        error: "Ruhezeit",
      },
    ]);
  });

  it("does not mis-map when payload indices differ from sorted indices", () => {
    const rowA = {
      id: "a",
      employeeId: "emp-a",
      startTime: "08:00",
      endTime: "10:00",
    };
    const rowB = {
      id: "b",
      employeeId: "emp-b",
      startTime: "12:00",
      endTime: "15:00",
    };

    const outcome = resolveBulkShiftPartialSaveOutcome({
      currentRows: [rowA, rowB],
      payloadRows: [{ row: rowB, payloadIndex: 0 }],
      failedResults: [{ rowIndex: 0, error: "Fehler" }],
      resolveEmployeeName: () => "Person B",
      createEmptyRow: () => ({
        id: "empty",
        employeeId: "",
        startTime: "00:00",
        endTime: "00:00",
      }),
    });

    expect(outcome.remainingRows.map((row) => row.id)).toEqual(["a", "b"]);
    expect(outcome.failures[0]?.name).toBe("Person B");
  });
});
