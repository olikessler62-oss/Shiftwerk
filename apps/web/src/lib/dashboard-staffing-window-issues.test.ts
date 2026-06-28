import { describe, expect, it } from "vitest";
import type { PlanningShift } from "@/lib/planning-shift-card";
import {
  buildStaffingWindowIssueListItems,
  confirmationActionsForShift,
  countStaffingWindowIssues,
  filterStaffingWindowIssueListItemsByConfirmationStatus,
  findFirstRowWithConfirmationStatus,
  findFirstStaffingCandidatesRow,
  listConfirmationShiftsForStaffingWindow,
  staffingRowShowsIssuesButton,
} from "@/lib/dashboard-staffing-window-issues";
import type { DashboardStaffingWindowRow } from "@/lib/dashboard-area-week-stats";

const todayISO = "2026-06-25";

const baseRow: DashboardStaffingWindowRow = {
  rowKind: "staffing_window",
  dateISO: "2026-06-25",
  serviceHourId: "hour-1",
  weekdayLabel: "Mi",
  timeFrom: "08:00",
  timeTo: "16:00",
  shiftName: "Früh",
  assigned: 2,
  required: 2,
  status: "met",
};

const context = {
  areaId: "area-1",
  areaName: "Küche",
  areaCalendarHref: "/bereich-kalender",
  weekStart: "2026-06-23",
  locationId: "loc-1",
  calendarShifts: [] as PlanningShift[],
  serviceHours: [
    {
      id: "hour-1",
      location_area_id: "area-1",
      weekday: 3,
      start_time: "08:00:00",
      end_time: "16:00:00",
    },
  ],
  employeeNameById: new Map([
    ["emp-1", "Anna"],
    ["emp-2", "Ben"],
  ]),
  shiftConfirmationEnabled: true,
  readOnlyWeek: false,
  todayISO: "2026-06-25",
};

function shift(
  overrides: Partial<PlanningShift> & Pick<PlanningShift, "id" | "employee_id">
): PlanningShift {
  return {
    shift_date: "2026-06-25",
    shiftName: "Früh",
    color: "#000",
    startTime: "08:00",
    endTime: "16:00",
    location_area_id: "area-1",
    area_shift_template_id: null,
    confirmationStatus: "pending",
    ...overrides,
  };
}

describe("staffingRowShowsIssuesButton", () => {
  it("shows for staffing conflicts", () => {
    expect(
      staffingRowShowsIssuesButton(
        {
          ...baseRow,
          staffingConflicts: [
            {
              id: "c-1",
              kind: "qualification_mismatch",
              dateISO: "2026-06-25",
              weekdayLabel: "Mi",
              timeLabel: "08:00–16:00",
              shiftName: "Früh",
              employeeName: "Anna",
            },
          ],
        },
        true
      )
    ).toBe(true);
  });

  it("does not show for staffing hints alone (overstaffing)", () => {
    expect(
      staffingRowShowsIssuesButton(
        {
          ...baseRow,
          staffingHints: [
            {
              id: "h-1",
              kind: "overstaffed",
              dateISO: "2026-06-25",
              weekdayLabel: "Mi",
              timeLabel: "08:00–16:00",
              shiftName: "Früh",
              employeeName: "Anna",
            },
          ],
        },
        true
      )
    ).toBe(false);
  });

  it("shows for confirmation counts when enabled", () => {
    expect(
      staffingRowShowsIssuesButton(
        {
          ...baseRow,
          confirmationCounts: { pending: 1 },
        },
        true
      )
    ).toBe(true);
  });
});

describe("listConfirmationShiftsForStaffingWindow", () => {
  it("filters actionable confirmation shifts in the staffing window", () => {
    const shifts = listConfirmationShiftsForStaffingWindow(baseRow, {
      ...context,
      calendarShifts: [
        shift({ id: "s-1", employee_id: "emp-1", confirmationStatus: "pending" }),
        shift({
          id: "s-2",
          employee_id: "emp-2",
          confirmationStatus: "confirmed",
        }),
        shift({
          id: "s-3",
          employee_id: "emp-2",
          shift_date: "2026-06-26",
          confirmationStatus: "pending",
        }),
      ],
    });

    expect(shifts.map((item) => item.id)).toEqual(["s-1"]);
  });
});

describe("confirmationActionsForShift", () => {
  it("maps pending to cancel and requestConfirmation", () => {
    const actions = confirmationActionsForShift(
      shift({ id: "s-1", employee_id: "emp-1", confirmationStatus: "pending" }),
      context
    );
    expect(actions).toEqual(["cancel", "requestConfirmation"]);
  });

  it("maps rejected to delete only", () => {
    const actions = confirmationActionsForShift(
      shift({ id: "s-1", employee_id: "emp-1", confirmationStatus: "rejected" }),
      context
    );
    expect(actions).toEqual(["delete"]);
  });
});

describe("buildStaffingWindowIssueListItems", () => {
  it("combines staffing conflicts and confirmation shifts", () => {
    const items = buildStaffingWindowIssueListItems(
      {
        ...baseRow,
        staffingConflicts: [
          {
            id: "c-1",
            kind: "qualification_mismatch",
            dateISO: "2026-06-25",
            weekdayLabel: "Mi",
            timeLabel: "08:00–16:00",
            shiftName: "Früh",
            employeeName: "Anna",
          },
        ],
        confirmationCounts: { pending: 1 },
      },
      {
        ...context,
        calendarShifts: [
          shift({ id: "s-1", employee_id: "emp-1", confirmationStatus: "pending" }),
        ],
      }
    );

    expect(items).toHaveLength(2);
    expect(items[0]?.kind).toBe("staffing");
    expect(items[1]?.kind).toBe("confirmation");
    expect(countStaffingWindowIssues(baseRow, context)).toBe(0);
  });
});

describe("findFirstStaffingCandidatesRow", () => {
  it("returns the first future understaffed staffing window", () => {
    const found = findFirstStaffingCandidatesRow(
      [
        { ...baseRow, dateISO: "2026-06-20", status: "understaffed" },
        { ...baseRow, dateISO: "2026-06-26", status: "understaffed" },
      ],
      todayISO
    );

    expect(found?.dateISO).toBe("2026-06-26");
  });

  it("skips past days and met rows", () => {
    expect(
      findFirstStaffingCandidatesRow(
        [
          { ...baseRow, dateISO: "2026-06-20", status: "understaffed" },
          { ...baseRow, status: "met" },
        ],
        todayISO
      )
    ).toBeNull();
  });

  it("includes planned rows", () => {
    const found = findFirstStaffingCandidatesRow(
      [{ ...baseRow, status: "planned" }],
      todayISO
    );
    expect(found?.status).toBe("planned");
  });
});

describe("findFirstRowWithConfirmationStatus", () => {
  it("returns the first row with matching confirmation count", () => {
    const found = findFirstRowWithConfirmationStatus(
      [
        { ...baseRow, serviceHourId: "hour-1", confirmationCounts: { pending: 1 } },
        { ...baseRow, serviceHourId: "hour-2", confirmationCounts: { pending: 3 } },
      ],
      "pending"
    );

    expect(found?.serviceHourId).toBe("hour-1");
  });
});

describe("filterStaffingWindowIssueListItemsByConfirmationStatus", () => {
  it("keeps all items when filter is null", () => {
    const items = buildStaffingWindowIssueListItems(
      {
        ...baseRow,
        staffingConflicts: [
          {
            id: "c-1",
            kind: "qualification_mismatch",
            dateISO: "2026-06-25",
            weekdayLabel: "Mi",
            timeLabel: "08:00–16:00",
            shiftName: "Früh",
            employeeName: "Anna",
          },
        ],
        staffingHints: [
          {
            id: "h-1",
            kind: "overstaffed",
            dateISO: "2026-06-25",
            weekdayLabel: "Mi",
            timeLabel: "08:00–16:00",
            shiftName: "Früh",
            employeeName: "Ben",
          },
        ],
        confirmationCounts: { pending: 1, rejected: 1 },
      },
      {
        ...context,
        calendarShifts: [
          shift({ id: "s-1", employee_id: "emp-1", confirmationStatus: "pending" }),
          shift({ id: "s-2", employee_id: "emp-2", confirmationStatus: "rejected" }),
        ],
      }
    );

    expect(filterStaffingWindowIssueListItemsByConfirmationStatus(items, null)).toHaveLength(
      3
    );
  });

  it("filters confirmation items by status", () => {
    const items = buildStaffingWindowIssueListItems(
      {
        ...baseRow,
        confirmationCounts: { pending: 1, rejected: 1 },
      },
      {
        ...context,
        calendarShifts: [
          shift({ id: "s-1", employee_id: "emp-1", confirmationStatus: "pending" }),
          shift({ id: "s-2", employee_id: "emp-2", confirmationStatus: "rejected" }),
        ],
      }
    );

    const pendingOnly = filterStaffingWindowIssueListItemsByConfirmationStatus(
      items,
      "pending"
    );

    expect(pendingOnly).toHaveLength(1);
    expect(pendingOnly[0]?.kind).toBe("confirmation");
    if (pendingOnly[0]?.kind === "confirmation") {
      expect(pendingOnly[0].status).toBe("pending");
    }
  });
});

describe("duplicate employee confirmation statuses", () => {
  it("shows only the canonical status for the same employee in one window", () => {
    const items = buildStaffingWindowIssueListItems(
      {
        ...baseRow,
        confirmationCounts: { rejected: 1 },
      },
      {
        ...context,
        employeeNameById: new Map([["patricia", "Patricia Lobmig"]]),
        calendarShifts: [
          shift({
            id: "pending-shift",
            employee_id: "patricia",
            confirmationStatus: "pending",
          }),
          shift({
            id: "rejected-shift",
            employee_id: "patricia",
            confirmationStatus: "rejected",
            confirmationStatusUpdatedAt: "2026-06-27T10:00:00.000Z",
          }),
        ],
      }
    );

    const confirmationItems = items.filter((item) => item.kind === "confirmation");
    expect(confirmationItems).toHaveLength(1);
    if (confirmationItems[0]?.kind === "confirmation") {
      expect(confirmationItems[0].employeeName).toBe("Patricia Lobmig");
      expect(confirmationItems[0].status).toBe("rejected");
      expect(confirmationItems[0].shift.id).toBe("rejected-shift");
    }
  });

  it("shows only one rejected entry for duplicate shifts in the same slot", () => {
    const items = buildStaffingWindowIssueListItems(
      {
        ...baseRow,
        confirmationCounts: { rejected: 1 },
      },
      {
        ...context,
        employeeNameById: new Map([["patricia", "Patricia Lobmig"]]),
        calendarShifts: [
          shift({
            id: "rejected-older",
            employee_id: "patricia",
            confirmationStatus: "rejected",
            confirmationStatusUpdatedAt: "2026-07-01T10:00:00.000Z",
          }),
          shift({
            id: "rejected-newer",
            employee_id: "patricia",
            confirmationStatus: "rejected",
            confirmationStatusUpdatedAt: "2026-07-02T10:00:00.000Z",
          }),
        ],
      }
    );

    const confirmationItems = items.filter((item) => item.kind === "confirmation");
    expect(confirmationItems).toHaveLength(1);
    if (confirmationItems[0]?.kind === "confirmation") {
      expect(confirmationItems[0].status).toBe("rejected");
      expect(confirmationItems[0].shift.id).toBe("rejected-newer");
    }
  });
});
