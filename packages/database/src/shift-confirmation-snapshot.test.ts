import { describe, expect, it } from "vitest";
import {
  buildShiftConfirmationSnapshot,
  isShiftConfirmationSnapshotStale,
  shiftConfirmationSnapshotsEqual,
  shouldResetConfirmationToProposed,
} from "./shift-confirmation-snapshot";

const baseShift = {
  employee_id: "emp-1",
  location_id: "loc-1",
  location_area_id: "area-1",
  area_shift_template_id: "tpl-1",
  shift_date: "2026-06-10",
  starts_at: "2026-06-10T08:00:00.000Z",
  ends_at: "2026-06-10T16:00:00.000Z",
  notes: null as string | null,
};

describe("buildShiftConfirmationSnapshot", () => {
  it("copies snapshot fields", () => {
    expect(buildShiftConfirmationSnapshot(baseShift)).toEqual(baseShift);
  });
});

describe("shiftConfirmationSnapshotsEqual", () => {
  it("detects time changes", () => {
    const snapshot = buildShiftConfirmationSnapshot(baseShift);
    const changed = { ...baseShift, ends_at: "2026-06-10T18:00:00.000Z" };
    expect(shiftConfirmationSnapshotsEqual(snapshot, buildShiftConfirmationSnapshot(changed))).toBe(
      false
    );
  });

  it("treats identical shifts as equal", () => {
    const a = buildShiftConfirmationSnapshot(baseShift);
    const b = buildShiftConfirmationSnapshot({ ...baseShift });
    expect(shiftConfirmationSnapshotsEqual(a, b)).toBe(true);
  });
});

describe("isShiftConfirmationSnapshotStale", () => {
  it("returns true when employee changes", () => {
    const snapshot = buildShiftConfirmationSnapshot(baseShift);
    expect(
      isShiftConfirmationSnapshotStale(snapshot, {
        ...baseShift,
        employee_id: "emp-2",
      })
    ).toBe(true);
  });

  it("returns false when unchanged", () => {
    const snapshot = buildShiftConfirmationSnapshot(baseShift);
    expect(isShiftConfirmationSnapshotStale(snapshot, baseShift)).toBe(false);
  });
});

describe("shouldResetConfirmationToProposed", () => {
  it("resets requested and beyond", () => {
    expect(shouldResetConfirmationToProposed("requested")).toBe(true);
    expect(shouldResetConfirmationToProposed("confirmed")).toBe(true);
    expect(shouldResetConfirmationToProposed("rejected")).toBe(true);
    expect(shouldResetConfirmationToProposed("pending")).toBe(true);
  });

  it("does not reset proposed", () => {
    expect(shouldResetConfirmationToProposed("proposed")).toBe(false);
  });
});
