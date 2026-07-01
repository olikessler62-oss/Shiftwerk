import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setShiftAssignUndoBatch,
  takeShiftAssignUndoBatch,
  type ShiftAssignUndoBatch,
} from "./shift-assign-undo-store";

const emptyBatch = (): ShiftAssignUndoBatch => ({
  createdIds: ["shift-1"],
  deletedIds: [],
  replacements: [],
});

describe("shift-assign-undo-store", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns and removes a stored batch", () => {
    const batch = emptyBatch();
    setShiftAssignUndoBatch("user-1", batch);
    expect(takeShiftAssignUndoBatch("user-1")).toEqual(batch);
    expect(takeShiftAssignUndoBatch("user-1")).toBeNull();
  });

  it("expires batches after the TTL", () => {
    vi.useFakeTimers();
    setShiftAssignUndoBatch("user-2", emptyBatch());
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(takeShiftAssignUndoBatch("user-2")).toBeNull();
  });
});
