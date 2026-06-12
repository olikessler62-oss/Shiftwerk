import { describe, expect, it } from "vitest";
import {
  areaRowRequiredHeightPx,
  areaRowShiftStackHeightPx,
  AREA_ROW_MIN_HEIGHT_PX,
  buildAreaRowGridTrack,
  cellShiftListNeedsScroll,
  cellShiftListShouldEnableScroll,
  computeAreaRowLayouts,
  findDominantAreaId,
  SHIFT_CARD_LIST_GAP_PX,
  SHIFT_CARD_SHADOW_OVERFLOW_PX,
  SHIFT_CARD_TWO_LINE_HEIGHT_PX,
  totalAssignedRowHeightPx,
} from "./shift-card-row-layout";

describe("shift-card-row-layout", () => {
  it("computes stack height for shift cards", () => {
    expect(areaRowShiftStackHeightPx(0)).toBe(0);
    expect(areaRowShiftStackHeightPx(1)).toBe(
      SHIFT_CARD_TWO_LINE_HEIGHT_PX + SHIFT_CARD_SHADOW_OVERFLOW_PX
    );
    expect(areaRowShiftStackHeightPx(2)).toBe(
      2 * SHIFT_CARD_TWO_LINE_HEIGHT_PX +
        SHIFT_CARD_LIST_GAP_PX +
        SHIFT_CARD_SHADOW_OVERFLOW_PX
    );
    expect(areaRowShiftStackHeightPx(6)).toBe(
      6 * SHIFT_CARD_TWO_LINE_HEIGHT_PX +
        5 * SHIFT_CARD_LIST_GAP_PX +
        SHIFT_CARD_SHADOW_OVERFLOW_PX
    );
  });

  it("fills the full calendar body and grows busy areas when slack exists", () => {
    const areas = [{ id: "busy" }, { id: "quiet" }];
    const maxShifts = new Map([
      ["busy", 8],
      ["quiet", 2],
    ]);
    const availableBodyHeightPx = 900;
    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["busy", "quiet"]),
      maxShifts,
      availableBodyHeightPx
    );

    expect(totalAssignedRowHeightPx(areas, layouts)).toBe(availableBodyHeightPx);
    expect(layouts.get("quiet")!.heightPx).toBe(areaRowRequiredHeightPx(2));
    expect(layouts.get("busy")!.heightPx).toBeGreaterThan(
      areaRowRequiredHeightPx(8)
    );
    expect(buildAreaRowGridTrack(layouts.get("busy")!)).toBe(
      `minmax(${AREA_ROW_MIN_HEIGHT_PX}px, ${layouts.get("busy")!.heightPx}px)`
    );
    expect(cellShiftListNeedsScroll(8, layouts.get("busy")!)).toBe(false);
  });

  it("keeps sparse areas compact and prioritizes busy areas when space is constrained", () => {
    const areas = [{ id: "small" }, { id: "large" }];
    const maxShifts = new Map([
      ["small", 2],
      ["large", 8],
    ]);
    const requiredSmall = areaRowRequiredHeightPx(2);
    const requiredLarge = areaRowRequiredHeightPx(8);
    const available = requiredLarge + requiredSmall - 50;

    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["small", "large"]),
      maxShifts,
      available
    );

    expect(totalAssignedRowHeightPx(areas, layouts)).toBe(available);
    expect(layouts.get("small")!.heightPx).toBe(requiredSmall);
    expect(layouts.get("large")!.heightPx).toBe(available - requiredSmall);
    expect(cellShiftListNeedsScroll(8, layouts.get("large")!)).toBe(true);
    expect(cellShiftListNeedsScroll(2, layouts.get("small")!)).toBe(false);
  });

  it("scrolls only the dominant area when a smaller area gains a second shift", () => {
    const areas = [{ id: "restaurant" }, { id: "kitchen" }];
    const maxShifts = new Map([
      ["restaurant", 13],
      ["kitchen", 2],
    ]);
    const requiredRestaurant = areaRowRequiredHeightPx(13);
    const requiredKitchen = areaRowRequiredHeightPx(2);
    const availableBodyHeightPx = requiredRestaurant + requiredKitchen - 80;

    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["restaurant", "kitchen"]),
      maxShifts,
      availableBodyHeightPx
    );

    expect(layouts.get("kitchen")!.heightPx).toBe(requiredKitchen);
    expect(cellShiftListNeedsScroll(2, layouts.get("kitchen")!)).toBe(false);
    expect(cellShiftListNeedsScroll(13, layouts.get("restaurant")!)).toBe(true);
    expect(layouts.get("restaurant")!.heightPx).toBe(
      availableBodyHeightPx - requiredKitchen
    );
  });

  it("allows scroll in smaller areas once they approach the dominant size", () => {
    const areas = [{ id: "large" }, { id: "medium" }];
    const maxShifts = new Map([
      ["large", 10],
      ["medium", 9],
    ]);
    const requiredLarge = areaRowRequiredHeightPx(10);
    const requiredMedium = areaRowRequiredHeightPx(9);

    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["large", "medium"]),
      maxShifts,
      requiredLarge + requiredMedium - 40
    );

    expect(
      findDominantAreaId(
        areas,
        new Map([
          ["large", requiredLarge],
          ["medium", requiredMedium],
        ])
      )
    ).toBeNull();
    expect(cellShiftListNeedsScroll(9, layouts.get("medium")!)).toBe(true);
    expect(cellShiftListNeedsScroll(10, layouts.get("large")!)).toBe(false);
  });

  it("fits twelve cards when the busy row receives all slack", () => {
    const areas = [{ id: "restaurant" }, { id: "kitchen" }, { id: "bar" }];
    const maxShifts = new Map([
      ["restaurant", 12],
      ["kitchen", 1],
      ["bar", 1],
    ]);
    const totalRequired =
      areaRowRequiredHeightPx(12) +
      areaRowRequiredHeightPx(1) +
      areaRowRequiredHeightPx(1);
    const availableBodyHeightPx = totalRequired + 40;

    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["restaurant", "kitchen", "bar"]),
      maxShifts,
      availableBodyHeightPx
    );

    expect(layouts.get("kitchen")!.heightPx).toBe(areaRowRequiredHeightPx(1));
    expect(layouts.get("bar")!.heightPx).toBe(areaRowRequiredHeightPx(1));
    expect(layouts.get("restaurant")!.heightPx).toBeGreaterThan(
      areaRowRequiredHeightPx(12)
    );
    expect(cellShiftListNeedsScroll(12, layouts.get("restaurant")!)).toBe(false);
  });

  it("keeps shift-free areas compact and gives slack to busy areas", () => {
    const areas = [{ id: "restaurant" }, { id: "kitchen" }, { id: "bar" }];
    const maxShifts = new Map([
      ["restaurant", 12],
      ["kitchen", 0],
      ["bar", 0],
    ]);
    const availableBodyHeightPx = 900;

    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["restaurant", "kitchen", "bar"]),
      maxShifts,
      availableBodyHeightPx
    );

    expect(totalAssignedRowHeightPx(areas, layouts)).toBe(availableBodyHeightPx);
    expect(layouts.get("kitchen")!.heightPx).toBe(areaRowRequiredHeightPx(0));
    expect(layouts.get("bar")!.heightPx).toBe(areaRowRequiredHeightPx(0));
    expect(layouts.get("restaurant")!.heightPx).toBeGreaterThan(
      areaRowRequiredHeightPx(12)
    );
    expect(cellShiftListNeedsScroll(12, layouts.get("restaurant")!)).toBe(false);
  });

  it("never assigns less than the minimum row height when space is extremely tight", () => {
    const areas = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
      { id: "e" },
    ];
    const maxShifts = new Map([
      ["a", 12],
      ["b", 0],
      ["c", 0],
      ["d", 0],
      ["e", 0],
    ]);
    const availableBodyHeightPx = 180;

    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["a", "b", "c", "d", "e"]),
      maxShifts,
      availableBodyHeightPx
    );

    for (const area of areas) {
      expect(layouts.get(area.id)!.heightPx).toBeGreaterThanOrEqual(
        AREA_ROW_MIN_HEIGHT_PX
      );
      expect(buildAreaRowGridTrack(layouts.get(area.id)!)).toMatch(
        new RegExp(`^minmax\\(${AREA_ROW_MIN_HEIGHT_PX}px,`)
      );
    }
    expect(totalAssignedRowHeightPx(areas, layouts)).toBeGreaterThan(
      availableBodyHeightPx
    );
  });

  it("requests scroll when eight cards exceed a short content track", () => {
    const layout = {
      heightPx: areaRowRequiredHeightPx(6),
      requiredPx: areaRowRequiredHeightPx(6),
      contentHeightPx: areaRowShiftStackHeightPx(6) - 8,
      flexGrow: false,
    };

    expect(cellShiftListNeedsScroll(8, layout)).toBe(true);
  });

  it("suppresses scroll in non-dominant areas that received full required height", () => {
    const requiredTwo = areaRowRequiredHeightPx(2);
    const layout = {
      heightPx: requiredTwo,
      requiredPx: requiredTwo,
      contentHeightPx: areaRowShiftStackHeightPx(2) - 8,
      flexGrow: false,
    };

    expect(cellShiftListNeedsScroll(2, layout)).toBe(true);
    expect(
      cellShiftListShouldEnableScroll(2, layout, {
        dominantAreaId: "restaurant",
        areaId: "kitchen",
      })
    ).toBe(false);
  });

  it("allows scroll in non-dominant areas only when height is below required", () => {
    const requiredTwo = areaRowRequiredHeightPx(2);
    const layout = {
      heightPx: requiredTwo - 40,
      requiredPx: requiredTwo,
      contentHeightPx: areaRowShiftStackHeightPx(2) - 8,
      flexGrow: false,
    };

    expect(
      cellShiftListShouldEnableScroll(2, layout, {
        dominantAreaId: "restaurant",
        areaId: "kitchen",
      })
    ).toBe(true);
  });

  it("scrolls the dominant area when its stack does not fit", () => {
    const requiredLarge = areaRowRequiredHeightPx(13);
    const layout = {
      heightPx: requiredLarge - 80,
      requiredPx: requiredLarge,
      contentHeightPx: areaRowShiftStackHeightPx(13) - 40,
      flexGrow: false,
    };

    expect(
      cellShiftListShouldEnableScroll(13, layout, {
        dominantAreaId: "restaurant",
        areaId: "restaurant",
      })
    ).toBe(true);
  });

  it("scrolls the dominant area when height is below required even if content height looks sufficient", () => {
    const requiredLarge = areaRowRequiredHeightPx(13);
    const layout = {
      heightPx: requiredLarge - 120,
      requiredPx: requiredLarge,
      contentHeightPx: areaRowShiftStackHeightPx(13) + 20,
      flexGrow: false,
    };

    expect(cellShiftListNeedsScroll(13, layout)).toBe(false);
    expect(
      cellShiftListShouldEnableScroll(13, layout, {
        dominantAreaId: "restaurant",
        areaId: "restaurant",
      })
    ).toBe(true);
  });
});
