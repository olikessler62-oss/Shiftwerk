import { describe, expect, it } from "vitest";
import type { ProfileRecurringAvailability } from "@schichtwerk/types";
import {
  buildPlanningEmployeeAvailabilityTooltipRows,
  groupRecurringAvailabilityByProfileId,
  resolvePlanningEmployeeJobsTooltipLabel,
} from "@/lib/planning-employee-availability-tooltip";

function slot(
  overrides: Partial<ProfileRecurringAvailability> &
    Pick<ProfileRecurringAvailability, "id" | "profile_id" | "weekday">
): ProfileRecurringAvailability {
  return {
    organization_id: "org-1",
    start_time: "08:00:00",
    end_time: "16:00:00",
    sort_order: 0,
    created_at: "",
    ...overrides,
  };
}

describe("planning employee availability tooltip", () => {
  it("groups availability by profile id", () => {
    const grouped = groupRecurringAvailabilityByProfileId([
      slot({ id: "a1", profile_id: "emp-a", weekday: 1 }),
      slot({ id: "b1", profile_id: "emp-b", weekday: 2 }),
      slot({ id: "a2", profile_id: "emp-a", weekday: 3 }),
    ]);

    expect(grouped.get("emp-a")?.map((entry) => entry.id)).toEqual(["a1", "a2"]);
    expect(grouped.get("emp-b")?.map((entry) => entry.id)).toEqual(["b1"]);
  });

  it("builds column rows for tooltip display", () => {
    expect(buildPlanningEmployeeAvailabilityTooltipRows([], "de")).toEqual([]);
    expect(
      buildPlanningEmployeeAvailabilityTooltipRows(
        [
          slot({
            id: "a1",
            profile_id: "emp-a",
            weekday: 1,
            start_time: "08:00",
            end_time: "16:00",
          }),
        ],
        "de"
      )
    ).toEqual([{ weekday: "Di.:", timeRange: "08:00 – 16:00" }]);
  });

  it("builds sorted job labels for employee tooltip", () => {
    const qualificationNameById = new Map([
      ["job-b", "Bar"],
      ["job-a", "Koch"],
    ]);
    const qualificationSortOrder = new Map([
      ["job-a", 1],
      ["job-b", 2],
    ]);

    expect(
      resolvePlanningEmployeeJobsTooltipLabel(
        "emp-1",
        { "emp-1": ["job-b", "job-a"] },
        qualificationNameById,
        qualificationSortOrder
      )
    ).toBe("Koch, Bar");
    expect(
      resolvePlanningEmployeeJobsTooltipLabel(
        "emp-2",
        {},
        qualificationNameById,
        qualificationSortOrder
      )
    ).toBe("");
  });
});
