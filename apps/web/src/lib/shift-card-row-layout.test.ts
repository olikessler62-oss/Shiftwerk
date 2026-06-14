import { describe, expect, it } from "vitest";
import {
  areaRowContentHeightPx,
  areaRowRequiredHeightPx,
  areaRowShiftStackHeightPx,
  AREA_ROW_MIN_HEIGHT_PX,
  AREA_ROW_LIST_FIT_SLACK_PX,
  AREA_ROW_VISIBLE_SPACE_BELOW_LAST_SHIFT_PX,
  buildAreaRowGridTrack,
  cellShiftListNeedsScroll,
  cellShiftListNeedsScroll,
  cellShiftListShouldEnableScroll,
  computeAreaRowLayouts,
  findDominantAreaId,
  SHIFT_CARD_LIST_GAP_PX,
  SHIFT_CARD_ROW_FIT_BUFFER_PX,
  SHIFT_CARD_SHADOW_BLEED_PX,
  SHIFT_CARD_TWO_LINE_HEIGHT_PX,
  shiftCardListItemHeightPx,
  totalAssignedRowHeightPx,
} from "./shift-card-row-layout";

describe("shift-card-row-layout", () => {
  it("T1: fits twelve cards at required height without scroll", () => {
    expect(areaRowShiftStackHeightPx(12)).toBe(
      12 * shiftCardListItemHeightPx() +
        11 * SHIFT_CARD_LIST_GAP_PX,
    );

    const required = areaRowRequiredHeightPx(12);
    const layout = {
      heightPx: required,
      requiredPx: required,
      contentHeightPx: areaRowContentHeightPx(required),
      flexGrow: false,
    };

    expect(cellShiftListNeedsScroll(12, layout)).toBe(false);
    expect(cellShiftListShouldEnableScroll(12, layout)).toBe(false);
  });

  it("T2: restaurant 12 shifts and two empty areas fill body height", () => {
    const areas = [{ id: "restaurant" }, { id: "bar" }, { id: "kitchen" }];
    const maxShifts = new Map([
      ["restaurant", 12],
      ["bar", 0],
      ["kitchen", 0],
    ]);
    const availableBodyHeightPx = 900;
    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["restaurant", "bar", "kitchen"]),
      maxShifts,
      availableBodyHeightPx,
    );

    const requiredRestaurant = areaRowRequiredHeightPx(12);
    const slack = availableBodyHeightPx - requiredRestaurant;
    const slackShare = Math.floor(slack / 2);

    expect(layouts.get("restaurant")!.heightPx).toBe(requiredRestaurant);
    expect(layouts.get("bar")!.heightPx).toBe(slackShare);
    expect(layouts.get("kitchen")!.heightPx).toBe(slack - slackShare);
    expect(buildAreaRowGridTrack(layouts.get("restaurant")!)).toBe(
      `${requiredRestaurant}px`,
    );
    expect(totalAssignedRowHeightPx(areas, layouts)).toBe(availableBodyHeightPx);
    expect(cellShiftListShouldEnableScroll(12, layouts.get("restaurant")!)).toBe(
      false,
    );
  });

  it("T3: all expanded areas empty share body height equally", () => {
    const areas = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["a", "b", "c"]),
      new Map([
        ["a", 0],
        ["b", 0],
        ["c", 0],
      ]),
      600,
    );

    expect(layouts.get("a")!.heightPx).toBe(200);
    expect(layouts.get("b")!.heightPx).toBe(200);
    expect(layouts.get("c")!.heightPx).toBe(200);
    expect(totalAssignedRowHeightPx(areas, layouts)).toBe(600);
  });

  it("T4: equalizes two shift areas toward the tallest required height", () => {
    const areas = [{ id: "large" }, { id: "small" }];
    const maxShifts = new Map([
      ["large", 8],
      ["small", 2],
    ]);
    const requiredLarge = areaRowRequiredHeightPx(8);
    const availableBodyHeightPx = requiredLarge + 200;

    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["large", "small"]),
      maxShifts,
      availableBodyHeightPx,
    );

    expect(layouts.get("large")!.heightPx).toBe(requiredLarge);
    expect(layouts.get("small")!.heightPx).toBe(200);
    expect(totalAssignedRowHeightPx(areas, layouts)).toBe(availableBodyHeightPx);
  });

  it("T5: collapsed rows stay at 50 px and expanded rows take slack", () => {
    const areas = [{ id: "restaurant" }, { id: "bar" }];
    const availableBodyHeightPx = 700;
    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["restaurant"]),
      new Map([
        ["restaurant", 4],
        ["bar", 0],
      ]),
      availableBodyHeightPx,
    );

    expect(layouts.get("restaurant")!.heightPx).toBe(
      availableBodyHeightPx - AREA_ROW_MIN_HEIGHT_PX,
    );
    expect(layouts.get("bar")!.heightPx).toBe(AREA_ROW_MIN_HEIGHT_PX);
    expect(totalAssignedRowHeightPx(areas, layouts)).toBe(700);
  });

  it("T6: phase 2 keeps dominant shift area and shrinks others to minimum", () => {
    const areas = [
      { id: "dominant" },
      { id: "small" },
      { id: "empty" },
    ];
    const maxShifts = new Map([
      ["dominant", 12],
      ["small", 2],
      ["empty", 0],
    ]);
    const availableBodyHeightPx = 300;

    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["dominant", "small", "empty"]),
      maxShifts,
      availableBodyHeightPx,
    );

    expect(layouts.get("small")!.heightPx).toBe(AREA_ROW_MIN_HEIGHT_PX);
    expect(layouts.get("empty")!.heightPx).toBe(AREA_ROW_MIN_HEIGHT_PX);
    expect(layouts.get("dominant")!.heightPx).toBe(
      availableBodyHeightPx - AREA_ROW_MIN_HEIGHT_PX * 2,
    );
    expect(totalAssignedRowHeightPx(areas, layouts)).toBe(availableBodyHeightPx);
  });

  it("T7: scroll decision uses stack fit in assigned row height", () => {
    const required = areaRowRequiredHeightPx(6);
    const layout = {
      heightPx: required,
      requiredPx: required,
      contentHeightPx: areaRowShiftStackHeightPx(6) - 8,
      flexGrow: false,
    };

    expect(cellShiftListNeedsScroll(8, layout)).toBe(true);
    expect(cellShiftListShouldEnableScroll(8, layout)).toBe(true);
  });

  it("T8: required height includes 20 px reserve below last card", () => {
    expect(AREA_ROW_VISIBLE_SPACE_BELOW_LAST_SHIFT_PX).toBe(20);
    expect(areaRowRequiredHeightPx(1)).toBe(
      areaRowShiftStackHeightPx(1) +
        54 +
        4 +
        20 +
        SHIFT_CARD_ROW_FIT_BUFFER_PX +
        AREA_ROW_LIST_FIT_SLACK_PX,
    );
  });

  it("keeps dominant shift row tall enough for twelve cards when viewport allows", () => {
    const areas = [{ id: "restaurant" }, { id: "bar" }, { id: "kitchen" }];
    const maxShifts = new Map([
      ["restaurant", 12],
      ["bar", 0],
      ["kitchen", 0],
    ]);
    const requiredRestaurant = areaRowRequiredHeightPx(12);
    const availableBodyHeightPx = requiredRestaurant + 100;

    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["restaurant", "bar", "kitchen"]),
      maxShifts,
      availableBodyHeightPx,
    );

    expect(layouts.get("restaurant")!.heightPx).toBeGreaterThanOrEqual(
      requiredRestaurant,
    );
    expect(
      cellShiftListShouldEnableScroll(12, layouts.get("restaurant")!),
    ).toBe(false);
    expect(layouts.get("bar")!.heightPx).toBeGreaterThanOrEqual(
      AREA_ROW_MIN_HEIGHT_PX,
    );
    expect(layouts.get("kitchen")!.heightPx).toBeGreaterThanOrEqual(
      AREA_ROW_MIN_HEIGHT_PX,
    );
    expect(totalAssignedRowHeightPx(areas, layouts)).toBe(availableBodyHeightPx);
  });

  it("T9: service-dormant expanded areas stay at 50 px and forfeit slack", () => {
    const areas = [{ id: "restaurant" }, { id: "bar" }, { id: "kitchen" }];
    const maxShifts = new Map([
      ["restaurant", 12],
      ["bar", 0],
      ["kitchen", 0],
    ]);
    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["restaurant", "bar", "kitchen"]),
      maxShifts,
      900,
      new Set(["bar"]),
    );

    expect(layouts.get("restaurant")!.heightPx).toBe(areaRowRequiredHeightPx(12));
    expect(layouts.get("bar")!.heightPx).toBe(AREA_ROW_MIN_HEIGHT_PX);
    expect(layouts.get("kitchen")!.heightPx).toBeGreaterThan(AREA_ROW_MIN_HEIGHT_PX);
    expect(totalAssignedRowHeightPx(areas, layouts)).toBe(900);
  });

  it("never assigns less than the minimum row height", () => {
    const areas = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const layouts = computeAreaRowLayouts(
      areas,
      new Set(["a", "b", "c"]),
      new Map([
        ["a", 12],
        ["b", 0],
        ["c", 0],
      ]),
      180,
    );

    for (const area of areas) {
      expect(layouts.get(area.id)!.heightPx).toBeGreaterThanOrEqual(
        AREA_ROW_MIN_HEIGHT_PX,
      );
      expect(buildAreaRowGridTrack(layouts.get(area.id)!)).toMatch(/^\d+px$/);
    }
  });

  it("identifies dominant areas by required height lead", () => {
    const areas = [{ id: "restaurant" }, { id: "kitchen" }];
    const requiredRestaurant = areaRowRequiredHeightPx(13);
    const requiredKitchen = areaRowRequiredHeightPx(2);

    expect(
      findDominantAreaId(
        areas,
        new Map([
          ["restaurant", requiredRestaurant],
          ["kitchen", requiredKitchen],
        ]),
      ),
    ).toBe("restaurant");
  });
});
