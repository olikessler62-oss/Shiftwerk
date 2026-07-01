import { afterEach, describe, expect, it, vi } from "vitest";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import type { AbsenceRequest } from "@schichtwerk/types";
import {
  COMMUNICATION_HUB_CATEGORY_ORDER,
  groupCommunicationHubData,
  groupCommunicationResponseShifts,
  groupCommunicationShiftsByArea,
  groupedEmployeeListNameLabel,
  shouldShowGroupedEmployeeName,
  sortCommunicationHubShifts,
} from "@/lib/communication-hub";

function shift(
  overrides: Partial<AreaCalendarShiftCard> = {}
): AreaCalendarShiftCard {
  return {
    id: "shift-1",
    shift_date: "2099-06-16",
    locationAreaId: "area-1",
    areaShiftTemplateId: null,
    employeeId: "emp-1",
    shiftName: "Früh",
    color: "#000",
    startTime: "08:00",
    endTime: "16:00",
    employeeName: "Max Mustermann",
    employeeColor: null,
    ...overrides,
  };
}

function absence(overrides: Partial<AbsenceRequest> = {}): AbsenceRequest {
  return {
    id: "abs-1",
    organization_id: "org-1",
    employee_id: "emp-1",
    type: "sick",
    start_date: "2099-06-16",
    end_date: "2099-06-16",
    is_open_ended: false,
    expected_end_date: null,
    status: "approved",
    notes: null,
    reviewed_by: null,
    reported_by: null,
    updated_at: "2026-06-16T08:00:00.000Z",
    ...overrides,
  };
}

describe("groupCommunicationResponseShifts", () => {
  it("ignores confirmed shifts in response tabs", () => {
    const grouped = groupCommunicationResponseShifts([
      shift({
        id: "confirmed-recent",
        confirmationStatus: "confirmed",
        requestedAt: "2026-06-16T08:00:00.000Z",
        confirmationStatusUpdatedAt: "2026-06-17T11:00:00.000Z",
      }),
      shift({
        id: "requested-open",
        confirmationStatus: "requested",
        requestedAt: "2026-06-17T08:00:00.000Z",
      }),
    ]);

    expect(grouped.requested.map((row) => row.id)).toEqual(["requested-open"]);
    expect(
      [
        ...grouped.pending,
        ...grouped.rejected,
        ...grouped.proposed,
        ...grouped.canceled,
      ].map((row) => row.id)
    ).toEqual([]);
  });

  it("groups employee-canceled shifts into canceled and hides manager cancels", () => {
    const grouped = groupCommunicationResponseShifts(
      [
        shift({ id: "canceled-employee", confirmationStatus: "canceled" }),
        shift({ id: "canceled-manager", confirmationStatus: "canceled" }),
      ],
      {
        cancelActors: new Map([
          ["canceled-employee", "employee"],
          ["canceled-manager", "manager"],
        ]),
      }
    );

    expect(grouped.canceled.map((row) => row.id)).toEqual(["canceled-employee"]);
  });

  it("prefers displayState cancellation actor over legacy cancelActors map", () => {
    const grouped = groupCommunicationResponseShifts(
      [
        shift({
          id: "canceled-from-display",
          confirmationStatus: "canceled",
          displayState: {
            shiftId: "canceled-from-display",
            lifecycle: "cancelled",
            legacyConfirmationStatus: "canceled",
            openCancellation: {
              requestId: "cancel-req",
              status: "approved",
              cancelledBy: "manager",
            },
          },
        }),
        shift({ id: "canceled-employee", confirmationStatus: "canceled" }),
      ],
      {
        cancelActors: new Map([["canceled-employee", "employee"]]),
      }
    );

    expect(grouped.canceled.map((row) => row.id)).toEqual(["canceled-employee"]);
  });

  it("sorts shifts by employee name then date within area groups", () => {
    const areas = [{ id: "area-1", name: "Küche" }];
    const grouped = groupCommunicationResponseShifts([
      shift({
        id: "b-later",
        employeeName: "Anna",
        shift_date: "2099-06-18",
        confirmationStatus: "proposed",
      }),
      shift({
        id: "a-earlier",
        employeeName: "Anna",
        shift_date: "2099-06-17",
        confirmationStatus: "proposed",
      }),
      shift({
        id: "max",
        employeeName: "Max",
        shift_date: "2099-06-20",
        confirmationStatus: "proposed",
      }),
    ]);

    const areaGroups = groupCommunicationShiftsByArea(grouped.proposed, areas);
    expect(areaGroups[0]?.shifts.map((row) => row.id)).toEqual([
      "a-earlier",
      "b-later",
      "max",
    ]);
  });

  it("sorts by first name, then date, then start time", () => {
    const sorted = [
      shift({
        id: "zara-late",
        employeeName: "Zara West",
        shift_date: "2099-06-17",
        startTime: "14:00",
        confirmationStatus: "proposed",
      }),
      shift({
        id: "zara-early",
        employeeName: "Zara West",
        shift_date: "2099-06-17",
        startTime: "08:00",
        confirmationStatus: "proposed",
      }),
      shift({
        id: "anna-later",
        employeeName: "Anna Schmidt",
        shift_date: "2099-06-18",
        startTime: "09:00",
        confirmationStatus: "proposed",
      }),
      shift({
        id: "anna-earlier",
        employeeName: "Anna Schmidt",
        shift_date: "2099-06-17",
        startTime: "10:00",
        confirmationStatus: "proposed",
      }),
      shift({
        id: "berta",
        employeeName: "Berta Meier",
        shift_date: "2099-06-16",
        startTime: "08:00",
        confirmationStatus: "proposed",
      }),
    ].sort(sortCommunicationHubShifts);

    expect(sorted.map((row) => row.id)).toEqual([
      "anna-earlier",
      "anna-later",
      "berta",
      "zara-early",
      "zara-late",
    ]);
  });

  it("hides repeated employee names in grouped rows", () => {
    const first = shouldShowGroupedEmployeeName("Anna", null);
    const second = shouldShowGroupedEmployeeName("Anna", first.nameKey);
    const third = shouldShowGroupedEmployeeName("Max", second.nameKey);

    expect(first.show).toBe(true);
    expect(second.show).toBe(false);
    expect(third.show).toBe(true);
  });

  it("uses a double quote for grouped employee name continuation", () => {
    expect(groupedEmployeeListNameLabel("Anna", true)).toBe("Anna");
    expect(groupedEmployeeListNameLabel("Anna", false)).toBe('"');
  });
});

describe("groupCommunicationHubData", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("collects absence conflicts for unconfirmed shifts only", () => {
    const grouped = groupCommunicationHubData(
      [
        shift({ id: "conflict-shift", confirmationStatus: "proposed" }),
        shift({ id: "confirmed-conflict", confirmationStatus: "confirmed" }),
      ],
      { absences: [absence()] }
    );

    expect(grouped.conflicts.map((row) => row.id)).toEqual(["conflict-shift"]);
    expect(grouped.conflictDetailsByShiftId.get("conflict-shift")?.[0]).toMatchObject({
      kind: "absence",
      absenceType: "sick",
    });
    expect(grouped.conflictDetailsByShiftId.has("confirmed-conflict")).toBe(false);
  });

  it("excludes past shifts from all categories", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

    const grouped = groupCommunicationHubData(
      [
        shift({
          id: "past-proposed",
          shift_date: "2026-06-16",
          confirmationStatus: "proposed",
        }),
        shift({
          id: "future-requested",
          shift_date: "2026-06-18",
          confirmationStatus: "requested",
        }),
        shift({
          id: "past-conflict",
          shift_date: "2026-06-16",
          confirmationStatus: "confirmed",
        }),
      ],
      {
        absences: [
          absence({
            employee_id: "emp-1",
            start_date: "2026-06-16",
            end_date: "2026-06-16",
          }),
        ],
        swapRequests: [
          {
            id: "swap-past",
            status: "pending",
            message: null,
            requesterId: "emp-1",
            requesterName: "Max",
            targetEmployeeId: null,
            targetEmployeeName: null,
            shiftId: "past-proposed",
            shiftDate: "2026-06-16",
            startTime: "08:00",
            endTime: "16:00",
            shiftName: "Früh",
            assigneeName: "Max",
            locationAreaId: "area-1",
            locationId: null,
          },
        ],
      }
    );

    expect(grouped.proposed.map((row) => row.id)).toEqual([]);
    expect(grouped.requested.map((row) => row.id)).toEqual(["future-requested"]);
    expect(grouped.conflicts.map((row) => row.id)).toEqual([]);
    expect(grouped.swaps.map((row) => row.id)).toEqual([]);
  });

  it("groups unresolved shifts into the unresolved tab", () => {
    const grouped = groupCommunicationHubData([
      shift({ id: "unresolved-shift", confirmationStatus: "unresolved" }),
      shift({ id: "pending-shift", confirmationStatus: "pending" }),
    ]);

    expect(grouped.unresolved.map((row) => row.id)).toEqual(["unresolved-shift"]);
    expect(grouped.pending.map((row) => row.id)).toEqual(["pending-shift"]);
  });
});

describe("COMMUNICATION_HUB_CATEGORY_ORDER", () => {
  it("lists tabs in the product order", () => {
    expect([...COMMUNICATION_HUB_CATEGORY_ORDER]).toEqual([
      "conflicts",
      "proposed",
      "requested",
      "pending",
      "rejected",
      "canceled",
      "swaps",
      "unresolved",
    ]);
  });
});
