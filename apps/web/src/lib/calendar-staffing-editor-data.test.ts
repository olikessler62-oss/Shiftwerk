import { describe, expect, it } from "vitest";
import { buildCalendarStaffingEditorData } from "./calendar-staffing-editor-data";

describe("buildCalendarStaffingEditorData", () => {
  it("filters service hours and staffing by area and drops archived qualifications", () => {
    const areaId = "area-a";
    const editorData = buildCalendarStaffingEditorData(
      areaId,
      [
        {
          id: "hour-a",
          location_area_id: areaId,
          weekday: 1,
          start_time: "08:00",
          end_time: "16:00",
        },
        {
          id: "hour-b",
          location_area_id: "area-b",
          weekday: 1,
          start_time: "08:00",
          end_time: "16:00",
        },
      ],
      [
        {
          id: "rule-a",
          location_area_id: areaId,
          service_hour_id: "hour-a",
          qualification_id: "qual-a",
          required_count: 2,
        },
        {
          id: "rule-b",
          location_area_id: "area-b",
          service_hour_id: "hour-b",
          qualification_id: "qual-b",
          required_count: 1,
        },
      ],
      [
        {
          id: "qual-a",
          name: "A",
          sort_order: 0,
          archived_at: null,
        },
        {
          id: "qual-archived",
          name: "Archived",
          sort_order: 1,
          archived_at: "2026-01-01T00:00:00Z",
        },
      ]
    );

    expect(editorData.serviceHours).toHaveLength(1);
    expect(editorData.serviceHours[0]?.id).toBe("hour-a");
    expect(editorData.staffing).toHaveLength(1);
    expect(editorData.staffing[0]?.id).toBe("rule-a");
    expect(editorData.qualifications.map((qual) => qual.id)).toEqual(["qual-a"]);
  });
});
