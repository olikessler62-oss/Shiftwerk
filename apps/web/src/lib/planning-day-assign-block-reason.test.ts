import { describe, expect, it } from "vitest";
import type { AbsenceRequest, ProfileRecurringAvailability } from "@schichtwerk/types";

import { getPlanningDayAssignBlockReason } from "./planning-day-assign-block-reason";

const employeeId = "emp-1";
const todayISO = "2026-06-17";

function slot(
  overrides: Partial<ProfileRecurringAvailability> = {}
): ProfileRecurringAvailability {
  return {
    id: "slot-1",
    organization_id: "org-1",
    profile_id: employeeId,
    weekday: 2,
    start_time: "08:00:00",
    end_time: "16:00:00",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getPlanningDayAssignBlockReason", () => {
  it("returns no_availability for future days without matching slots", () => {
    expect(
      getPlanningDayAssignBlockReason(
        employeeId,
        "2026-06-24",
        todayISO,
        [],
        []
      )
    ).toBe("no_availability");
  });

  it("keeps past no_availability when a new slot was added later", () => {
    const availability = [
      slot({ id: "new", weekday: 2, created_at: "2026-06-17T10:00:00Z" }),
    ];

    expect(
      getPlanningDayAssignBlockReason(
        employeeId,
        "2026-06-10",
        todayISO,
        availability,
        []
      )
    ).toBe("no_availability");
  });

  it("shows availability on past days when slot existed on that day", () => {
    const availability = [
      slot({ id: "old", weekday: 2, created_at: "2026-06-01T00:00:00Z" }),
    ];

    expect(
      getPlanningDayAssignBlockReason(
        employeeId,
        "2026-06-10",
        todayISO,
        availability,
        []
      )
    ).toBeNull();
  });

  it("returns absent before checking availability", () => {
    const absences = [
      {
        id: "abs-1",
        employee_id: employeeId,
        start_date: "2026-06-10",
        end_date: "2026-06-10",
        type: "vacation",
        status: "approved",
      },
    ] as AbsenceRequest[];

    expect(
      getPlanningDayAssignBlockReason(
        employeeId,
        "2026-06-10",
        todayISO,
        [slot()],
        absences
      )
    ).toBe("absent");
  });
});
