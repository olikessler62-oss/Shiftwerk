import { describe, expect, it } from "vitest";
import {
  computeExpandedDayUniformShiftWidths,
  planningExpandedShiftUniformKey,
} from "@/lib/planning-expanded-shift-layout";
import type { PlanningShiftDisplaySegment } from "@/lib/planning-overnight-shift-display";
import type { PlanningShift } from "@/lib/planning-shift-card";

function shift(
  partial: Partial<PlanningShift> & Pick<PlanningShift, "id" | "employee_id">
): PlanningShift {
  return {
    shift_date: "2026-06-05",
    shiftName: "Früh",
    color: "#000",
    startTime: "08:00",
    endTime: "12:00",
    location_area_id: "area-1",
    area_shift_template_id: "template-fruh",
    ...partial,
  };
}

describe("planningExpandedShiftUniformKey", () => {
  it("groups by template id when present", () => {
    expect(
      planningExpandedShiftUniformKey(
        shift({ id: "1", employee_id: "a", area_shift_template_id: "t1" })
      )
    ).toBe("template:t1");
  });
});

describe("computeExpandedDayUniformShiftWidths", () => {
  it("uses the smallest fair-share width per shift type across employees", () => {
    const date = "2026-06-05";
    const employees = [{ id: "a" }, { id: "b" }];
    const shiftsByCellDisplay = new Map<string, PlanningShiftDisplaySegment[]>([
      [
        `a:${date}`,
        [
          { shift: shift({ id: "1", employee_id: "a" }), part: "full" },
          {
            shift: shift({
              id: "2",
              employee_id: "a",
              area_shift_template_id: "template-mittel",
              startTime: "12:00",
              endTime: "16:00",
            }),
            part: "full",
          },
          {
            shift: shift({
              id: "3",
              employee_id: "a",
              area_shift_template_id: "template-spat",
              startTime: "16:00",
              endTime: "20:00",
            }),
            part: "full",
          },
        ],
      ],
      [`b:${date}`, [{ shift: shift({ id: "4", employee_id: "b" }), part: "full" }]],
    ]);

    const widths = computeExpandedDayUniformShiftWidths(
      300,
      employees,
      shiftsByCellDisplay,
      date,
      2
    );

    expect(widths.get("template:template-fruh")).toBeCloseTo((300 - 4) / 3, 5);
  });
});
