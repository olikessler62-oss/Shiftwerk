import { describe, expect, it } from "vitest";
import {
  resolvePlanningAreaId,
  resolveSingleActiveAreaIds,
} from "./resolve-areacalendar-location";
import type { LocationArea } from "@schichtwerk/types";

function area(id: string, sortOrder: number): LocationArea {
  return {
    id,
    location_id: "loc-1",
    name: id,
    sort_order: sortOrder,
    planning_mode: "advanced",
  };
}

describe("resolvePlanningAreaId", () => {
  it("prefers URL area param when valid", () => {
    const calendarAreas = [area("area-a", 0), area("area-b", 1)];
    const activeAreas = [area("area-a", 0), area("area-b", 1)];

    expect(
      resolvePlanningAreaId({
        calendarAreas,
        activeAreas,
        areaParam: "area-b",
        shiftAreaIds: ["area-a"],
      })
    ).toBe("area-b");
  });

  it("defaults to active area with shifts instead of first calendar area", () => {
    const calendarAreas = [area("archived", 0), area("restaurant", 1)];
    const activeAreas = [area("restaurant", 1)];

    expect(
      resolvePlanningAreaId({
        calendarAreas,
        activeAreas,
        areaParam: undefined,
        shiftAreaIds: ["restaurant"],
      })
    ).toBe("restaurant");
  });
});

describe("resolveSingleActiveAreaIds", () => {
  it("activates only the preferred area when valid", () => {
    const areas = [area("kitchen", 0), area("bar", 1)];
    expect(resolveSingleActiveAreaIds(areas, "bar")).toEqual(new Set(["bar"]));
  });

  it("falls back to the first area when preferred id is missing or invalid", () => {
    const areas = [area("kitchen", 0), area("bar", 1)];
    expect(resolveSingleActiveAreaIds(areas, "unknown")).toEqual(
      new Set(["kitchen"])
    );
    expect(resolveSingleActiveAreaIds(areas, null)).toEqual(new Set(["kitchen"]));
  });
});
