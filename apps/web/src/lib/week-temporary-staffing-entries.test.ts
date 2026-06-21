import { describe, expect, it } from "vitest";
import {
  buildBulkStaffingShiftEntries,
  buildCreateStaffingShiftEntries,
  buildWeekTemporaryStaffingEntries,
} from "./week-temporary-staffing-entries";

describe("buildWeekTemporaryStaffingEntries", () => {
  it("loads all staffed windows for the anchor weekday", () => {
    const entries = buildWeekTemporaryStaffingEntries({
      areaId: "area-a",
      anchorDate: "2026-06-22",
      serviceHours: [
        {
          id: "hour-morning",
          location_area_id: "area-a",
          weekday: 0,
          start_time: "06:00",
          end_time: "14:00",
        },
        {
          id: "hour-evening",
          location_area_id: "area-a",
          weekday: 0,
          start_time: "14:00",
          end_time: "22:00",
        },
      ],
      staffing: [
        {
          id: "rule-1",
          location_area_id: "area-a",
          service_hour_id: "hour-morning",
          qualification_id: "qual-a",
          required_count: 2,
        },
        {
          id: "rule-2",
          location_area_id: "area-a",
          service_hour_id: "hour-evening",
          qualification_id: "qual-a",
          required_count: 1,
        },
      ],
      staffingOverrides: [],
      shiftTemplates: [],
      qualifications: [
        {
          id: "qual-a",
          name: "Service",
          sort_order: 0,
          archived_at: null,
        },
      ],
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]?.serviceHourId).toBe("hour-morning");
    expect(entries[0]?.startTime).toBe("06:00");
    expect(entries[1]?.startTime).toBe("14:00");
  });

  it("uses shift template demand times when the service hour window is wider", () => {
    const entries = buildWeekTemporaryStaffingEntries({
      areaId: "area-a",
      anchorDate: "2026-06-22",
      serviceHours: [
        {
          id: "hour-morning",
          location_area_id: "area-a",
          weekday: 0,
          start_time: "05:00",
          end_time: "15:00",
        },
        {
          id: "hour-mid",
          location_area_id: "area-a",
          weekday: 0,
          start_time: "14:00",
          end_time: "22:00",
        },
      ],
      staffing: [
        {
          id: "rule-1",
          location_area_id: "area-a",
          service_hour_id: "hour-morning",
          qualification_id: "qual-a",
          required_count: 2,
        },
        {
          id: "rule-2",
          location_area_id: "area-a",
          service_hour_id: "hour-mid",
          qualification_id: "qual-a",
          required_count: 1,
        },
      ],
      staffingOverrides: [],
      shiftTemplates: [
        {
          id: "tpl-frueh",
          location_area_id: "area-a",
          name: "Früh",
          color: "#00ff00",
          start_time: "07:00",
          end_time: "15:00",
          sort_order: 0,
          archived_at: null,
        },
        {
          id: "tpl-mittel",
          location_area_id: "area-a",
          name: "Mittel",
          color: "#0000ff",
          start_time: "14:00",
          end_time: "22:00",
          sort_order: 1,
          archived_at: null,
        },
      ],
      qualifications: [
        {
          id: "qual-a",
          name: "Service",
          sort_order: 0,
          archived_at: null,
        },
      ],
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]?.serviceHourId).toBe("hour-morning");
    expect(entries[0]?.templateId).toBe("tpl-frueh");
    expect(entries[0]?.startTime).toBe("07:00");
    expect(entries[0]?.endTime).toBe("15:00");
    expect(entries[1]?.templateId).toBe("tpl-mittel");
  });

  it("loads all staffed windows for bulk edit reference weekday", () => {
    const entries = buildBulkStaffingShiftEntries({
      areaId: "area-a",
      referenceWeekday: 0,
      serviceHours: [
        {
          id: "hour-morning",
          location_area_id: "area-a",
          weekday: 0,
          start_time: "06:00",
          end_time: "14:00",
        },
        {
          id: "hour-evening",
          location_area_id: "area-a",
          weekday: 0,
          start_time: "14:00",
          end_time: "22:00",
        },
      ],
      staffing: [
        {
          id: "rule-1",
          location_area_id: "area-a",
          service_hour_id: "hour-morning",
          qualification_id: "qual-a",
          required_count: 2,
        },
        {
          id: "rule-2",
          location_area_id: "area-a",
          service_hour_id: "hour-evening",
          qualification_id: "qual-a",
          required_count: 1,
        },
      ],
      shiftTemplates: [],
      qualifications: [
        {
          id: "qual-a",
          name: "Service",
          sort_order: 0,
          archived_at: null,
        },
      ],
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]?.serviceHourId).toBe("hour-morning");
    expect(entries[1]?.serviceHourId).toBe("hour-evening");
  });
});

describe("buildCreateStaffingShiftEntries", () => {
  it("starts with one suggested row and does not preload existing staffed windows", () => {
    const entries = buildCreateStaffingShiftEntries({
      serviceHours: [
        {
          id: "hour-morning",
          location_area_id: "area-a",
          weekday: 0,
          start_time: "12:00",
          end_time: "15:00",
        },
        {
          id: "hour-evening",
          location_area_id: "area-a",
          weekday: 0,
          start_time: "18:00",
          end_time: "22:00",
        },
      ],
      staffing: [
        {
          id: "rule-1",
          location_area_id: "area-a",
          service_hour_id: "hour-morning",
          qualification_id: "qual-a",
          required_count: 2,
        },
      ],
      shiftTemplates: [
        {
          id: "tpl-mittag",
          location_area_id: "area-a",
          name: "Mittag",
          color: "#00ff00",
          start_time: "12:00",
          end_time: "15:00",
          sort_order: 0,
          archived_at: null,
        },
        {
          id: "tpl-abend",
          location_area_id: "area-a",
          name: "Abend",
          color: "#0000ff",
          start_time: "18:00",
          end_time: "22:00",
          sort_order: 1,
          archived_at: null,
        },
      ],
      qualifications: [
        {
          id: "qual-a",
          name: "Service",
          sort_order: 0,
          archived_at: null,
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.serviceHourId).toBeUndefined();
    expect(entries[0]?.templateId).toBe("tpl-abend");
    expect(entries[0]?.startTime).toBe("18:00");
    expect(entries[0]?.endTime).toBe("22:00");
  });
});
