import { describe, expect, it } from "vitest";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import type { AbsenceRequest } from "@schichtwerk/types";
import {
  groupCommunicationHubData,
  groupCommunicationResponseShifts,
} from "@/lib/communication-hub";

function shift(
  overrides: Partial<AreaCalendarShiftCard> = {}
): AreaCalendarShiftCard {
  return {
    id: "shift-1",
    shift_date: "2026-06-16",
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
    start_date: "2026-06-16",
    end_date: "2026-06-16",
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
});

describe("groupCommunicationHubData", () => {
  it("collects absence conflicts without removing shifts from other groups", () => {
    const grouped = groupCommunicationHubData(
      [shift({ id: "conflict-shift", confirmationStatus: "confirmed" })],
      { absences: [absence()] }
    );

    expect(grouped.conflicts.map((row) => row.id)).toEqual(["conflict-shift"]);
    expect(grouped.conflictDetailsByShiftId.get("conflict-shift")?.absenceType).toBe(
      "sick"
    );
  });
});
