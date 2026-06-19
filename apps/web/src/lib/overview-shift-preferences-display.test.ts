import { describe, expect, it } from "vitest";
import { buildOverviewShiftPreferenceDisplayRows } from "./overview-shift-preferences-display";

describe("overview shift preferences display", () => {
  it("groups wishes by employee and shows name only on first row", () => {
    const rows = buildOverviewShiftPreferenceDisplayRows({
      profiles: [
        {
          id: "p1",
          full_name: "Anna",
          color: "#ff0000",
        } as never,
        {
          id: "p2",
          full_name: "Ben",
          color: null,
        } as never,
      ],
      preferences: [
        {
          id: "w1",
          profile_id: "p1",
          weekday: 1,
          start_time: "08:00",
          end_time: "12:00",
          location_id: null,
          location_area_id: null,
          qualification_id: null,
          priority: 0,
        } as never,
        {
          id: "w2",
          profile_id: "p1",
          weekday: 2,
          start_time: "08:00",
          end_time: "12:00",
          location_id: null,
          location_area_id: null,
          qualification_id: null,
          priority: 0,
        } as never,
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.showEmployeeName).toBe(true);
    expect(rows[1]?.showEmployeeName).toBe(false);
    expect(rows[0]?.employeeName).toBe("Anna");
  });
});
