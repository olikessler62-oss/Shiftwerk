import { describe, expect, it } from "vitest";
import { computeBulkShiftListScrollTop, resolveBulkShiftRowIdForShiftFocus } from "./bulk-shift-list-scroll";

describe("computeBulkShiftListScrollTop", () => {
  const base = {
    containerClientHeight: 200,
    headerHeight: 40,
    rowHeight: 32,
    padding: 4,
  };

  it("returns null when the row is fully visible", () => {
    expect(
      computeBulkShiftListScrollTop({
        ...base,
        rowRelativeTop: 50,
      })
    ).toBeNull();
  });

  it("scrolls up when the row is above the sticky header", () => {
    expect(
      computeBulkShiftListScrollTop({
        ...base,
        rowRelativeTop: 20,
      })
    ).toBe(20 - (40 + 4));
  });

  it("scrolls down when the row is below the visible area", () => {
    expect(
      computeBulkShiftListScrollTop({
        ...base,
        rowRelativeTop: 180,
      })
    ).toBe(180 + 32 - (200 - 4));
  });
});

describe("resolveBulkShiftRowIdForShiftFocus", () => {
  it("returns the row id for a matching existing shift", () => {
    expect(
      resolveBulkShiftRowIdForShiftFocus(
        [
          { id: "row-a", existingShiftId: "shift-1" },
          { id: "row-b", existingShiftId: "shift-2" },
        ],
        "shift-2"
      )
    ).toBe("row-b");
  });

  it("returns null when focusShiftId is missing or unknown", () => {
    expect(
      resolveBulkShiftRowIdForShiftFocus([{ id: "row-a" }], undefined)
    ).toBeNull();
    expect(
      resolveBulkShiftRowIdForShiftFocus([{ id: "row-a" }], "missing")
    ).toBeNull();
  });
});
