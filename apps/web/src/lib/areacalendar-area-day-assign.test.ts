import { describe, expect, it } from "vitest";
import { toISODate } from "@/lib/dates";
import { serviceWeekdayForDate } from "@/lib/location-staffing-client";
import {
  canOpenAssignShiftContextMenu,
  canOpenBulkShiftFromShiftCard,
  canPromptNoServiceHoursShiftAssign,
  canPromptNoServiceHoursShiftAssignForDay,
  canShowAreaDayAssignContextMenu,
  canShowEmployeeDayCellAssignContextMenu,
} from "./areacalendar-area-day-assign";

function futureISO(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return toISODate(date);
}

const serviceDayISO = futureISO(14);
const noServiceDayISO = futureISO(15);

const serviceHours = [
  {
    location_area_id: "kitchen",
    weekday: serviceWeekdayForDate(serviceDayISO),
    start_time: "08:00",
    end_time: "12:00",
  },
];

describe("areacalendar-area-day-assign", () => {
  it("opens context menu on service days", () => {
    expect(
      canOpenAssignShiftContextMenu(
        "kitchen",
        serviceDayISO,
        true,
        true,
        serviceHours,
        0
      )
    ).toBe(true);
  });

  it("prompts before first shift on a no-service planning day", () => {
    expect(
      canPromptNoServiceHoursShiftAssignForDay(noServiceDayISO, false, 0)
    ).toBe(true);
    expect(
      canPromptNoServiceHoursShiftAssignForDay(noServiceDayISO, false, 1)
    ).toBe(false);
    expect(
      canPromptNoServiceHoursShiftAssignForDay(noServiceDayISO, true, 0)
    ).toBe(false);
  });

  it("prompts before first shift on a no-service future day", () => {
    expect(
      canPromptNoServiceHoursShiftAssign(
        "bar",
        noServiceDayISO,
        true,
        true,
        serviceHours,
        0
      )
    ).toBe(true);
  });

  it("opens context menu after manual shifts exist without service hours", () => {
    expect(
      canOpenAssignShiftContextMenu(
        "bar",
        noServiceDayISO,
        true,
        true,
        serviceHours,
        2
      )
    ).toBe(true);
    expect(
      canPromptNoServiceHoursShiftAssign(
        "bar",
        noServiceDayISO,
        true,
        true,
        serviceHours,
        2
      )
    ).toBe(false);
  });

  it("opens context menu on no-service days via right-click policy", () => {
    expect(
      canShowAreaDayAssignContextMenu(
        "bar",
        noServiceDayISO,
        true,
        true,
        serviceHours,
        0,
        false
      )
    ).toBe(true);
  });

  it("opens employee calendar cell context menu on no-service days", () => {
    expect(
      canShowEmployeeDayCellAssignContextMenu(
        "bar",
        noServiceDayISO,
        true,
        false,
        0,
        null,
        serviceHours,
        false
      )
    ).toBe(true);
    expect(
      canShowEmployeeDayCellAssignContextMenu(
        "bar",
        noServiceDayISO,
        false,
        false,
        0,
        null,
        serviceHours,
        false
      )
    ).toBe(false);
  });

  it("allows bulk modal from shift card on manual assignment days", () => {
    expect(
      canOpenBulkShiftFromShiftCard(
        "bar",
        noServiceDayISO,
        true,
        true,
        serviceHours,
        1
      )
    ).toBe(true);
  });
});
