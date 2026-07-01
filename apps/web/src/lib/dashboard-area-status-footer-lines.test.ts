import { describe, expect, it } from "vitest";
import {
  countSwapRequestsForAreaDates,
  groupDashboardAreaStatusFooterLinesForTwoColumnRows,
  resolveDashboardAreaStatusFooterLines,
  resolveDashboardAreaStatusFooterTwoColumnPlacement,
} from "@/lib/dashboard-area-status-footer-lines";
import { emptyDashboardDayConfirmationCounts } from "@/lib/dashboard-day-confirmation-counts";

describe("resolveDashboardAreaStatusFooterLines", () => {
  it("orders swap_requested before unresolved", () => {
    const counts = emptyDashboardDayConfirmationCounts();
    counts.unresolved = 1;

    const lines = resolveDashboardAreaStatusFooterLines({
      openSlots: 0,
      shiftConfirmationEnabled: true,
      shiftCount: 2,
      confirmationCounts: counts,
      swapRequestedCount: 3,
    });

    expect(lines.map((line) => line.id)).toEqual([
      "swap_requested",
      "unresolved",
    ]);
  });

  it("includes open and confirmation lines with counts", () => {
    const counts = emptyDashboardDayConfirmationCounts();
    counts.proposed = 2;
    counts.requested = 1;

    const lines = resolveDashboardAreaStatusFooterLines({
      openSlots: 4,
      shiftConfirmationEnabled: true,
      shiftCount: 5,
      confirmationCounts: counts,
      swapRequestedCount: 0,
    });

    expect(lines).toEqual([
      { id: "open", count: 4 },
      { id: "proposed", count: 2 },
      { id: "requested", count: 1 },
    ]);
  });
});

describe("resolveDashboardAreaStatusFooterTwoColumnPlacement", () => {
  it("places a single status in the right column", () => {
    expect(resolveDashboardAreaStatusFooterTwoColumnPlacement(0, 1)).toEqual({
      row: 1,
      column: 2,
    });
  });

  it("fills right column first for three statuses", () => {
    expect([
      resolveDashboardAreaStatusFooterTwoColumnPlacement(0, 3),
      resolveDashboardAreaStatusFooterTwoColumnPlacement(1, 3),
      resolveDashboardAreaStatusFooterTwoColumnPlacement(2, 3),
    ]).toEqual([
      { row: 1, column: 2 },
      { row: 1, column: 1 },
      { row: 2, column: 2 },
    ]);
  });

  it("fills left to right for even counts", () => {
    expect([
      resolveDashboardAreaStatusFooterTwoColumnPlacement(0, 4),
      resolveDashboardAreaStatusFooterTwoColumnPlacement(1, 4),
      resolveDashboardAreaStatusFooterTwoColumnPlacement(2, 4),
      resolveDashboardAreaStatusFooterTwoColumnPlacement(3, 4),
    ]).toEqual([
      { row: 1, column: 1 },
      { row: 1, column: 2 },
      { row: 2, column: 1 },
      { row: 2, column: 2 },
    ]);
  });
});

describe("groupDashboardAreaStatusFooterLinesForTwoColumnRows", () => {
  it("groups two statuses on one row for side-by-side display", () => {
    const lines = resolveDashboardAreaStatusFooterLines({
      openSlots: 1,
      shiftConfirmationEnabled: true,
      shiftCount: 2,
      confirmationCounts: {
        ...emptyDashboardDayConfirmationCounts(),
        proposed: 1,
      },
      swapRequestedCount: 0,
    });

    expect(groupDashboardAreaStatusFooterLinesForTwoColumnRows(lines)).toEqual([
      [
        { id: "open", count: 1 },
        { id: "proposed", count: 1 },
      ],
    ]);
  });

  it("keeps a lone status on its own row without a pair", () => {
    const lines = resolveDashboardAreaStatusFooterLines({
      openSlots: 1,
      shiftConfirmationEnabled: false,
      shiftCount: 1,
      confirmationCounts: emptyDashboardDayConfirmationCounts(),
      swapRequestedCount: 0,
    });

    expect(groupDashboardAreaStatusFooterLinesForTwoColumnRows(lines)).toEqual([
      [{ id: "open", count: 1 }],
    ]);
  });
});

describe("countSwapRequestsForAreaDates", () => {
  it("counts pending swaps for area and date", () => {
    expect(
      countSwapRequestsForAreaDates({
        swapRequests: [
          {
            id: "swap-1",
            status: "pending",
            message: null,
            requesterId: "e1",
            requesterName: "A",
            targetEmployeeId: null,
            targetEmployeeName: null,
            shiftId: "shift-1",
            shiftDate: "2026-06-20",
            startTime: "09:00",
            endTime: "17:00",
            shiftName: "Früh",
            assigneeName: "A",
            locationAreaId: "area-a",
            locationId: "loc-1",
          },
          {
            id: "swap-2",
            status: "approved",
            message: null,
            requesterId: "e2",
            requesterName: "B",
            targetEmployeeId: null,
            targetEmployeeName: null,
            shiftId: "shift-2",
            shiftDate: "2026-06-20",
            startTime: "09:00",
            endTime: "17:00",
            shiftName: "Früh",
            assigneeName: "B",
            locationAreaId: "area-a",
            locationId: "loc-1",
          },
        ],
        areaId: "area-a",
        dateISOs: ["2026-06-20"],
      })
    ).toBe(1);
  });
});
