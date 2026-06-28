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
  isAreaCalendarAssignDayActive,
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
    id: "sh-1",
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
      canPromptNoServiceHoursShiftAssignForDay(
        noServiceDayISO,
        "bar",
        0,
        serviceHours
      )
    ).toBe(true);
    expect(
      canPromptNoServiceHoursShiftAssignForDay(
        noServiceDayISO,
        "bar",
        1,
        serviceHours
      )
    ).toBe(false);
    expect(
      canPromptNoServiceHoursShiftAssignForDay(
        serviceDayISO,
        "kitchen",
        0,
        serviceHours
      )
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

  it("prompts when weekday row exists without start/end times", () => {
    const placeholderHours = [
      {
        location_area_id: "bar",
        weekday: serviceWeekdayForDate(noServiceDayISO),
        start_time: "",
        end_time: "",
      },
    ];
    expect(
      canPromptNoServiceHoursShiftAssign(
        "bar",
        noServiceDayISO,
        true,
        true,
        placeholderHours,
        0
      )
    ).toBe(true);
    expect(
      canOpenAssignShiftContextMenu(
        "bar",
        noServiceDayISO,
        true,
        true,
        placeholderHours,
        0
      )
    ).toBe(false);
  });

  it("allows assign on collapsed no-service days before the first shift", () => {
    expect(
      isAreaCalendarAssignDayActive(
        noServiceDayISO,
        false,
        "bar",
        0,
        serviceHours
      )
    ).toBe(true);
    expect(
      canShowEmployeeDayCellAssignContextMenu(
        "bar",
        noServiceDayISO,
        false,
        0,
        null,
        serviceHours,
        false
      )
    ).toBe(true);
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

  it("allows assign on collapsed no-service days when shift count is area-scoped", () => {
    expect(
      isAreaCalendarAssignDayActive(
        noServiceDayISO,
        false,
        "bar",
        0,
        serviceHours
      )
    ).toBe(true);
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
    expect(
      isAreaCalendarAssignDayActive(
        noServiceDayISO,
        false,
        "bar",
        2,
        serviceHours
      )
    ).toBe(false);
  });

  it("allows employee cell menu on no-service day despite no_availability", () => {
    expect(
      canShowEmployeeDayCellAssignContextMenu(
        "bar",
        noServiceDayISO,
        false,
        0,
        "no_availability",
        serviceHours,
        false
      )
    ).toBe(true);
  });

  it("allows employee cell menu when another area has service on the same day", () => {
    expect(
      canShowEmployeeDayCellAssignContextMenu(
        "bar",
        serviceDayISO,
        false,
        0,
        "no_availability",
        serviceHours,
        false
      )
    ).toBe(true);
  });
});
