import { describe, expect, it } from "vitest";
import {
  isPlanningShiftMomentInPast,
  shouldBlockPastPlanningShiftEdit,
} from "./past-shift-planning-policy";

const BERLIN = "Europe/Berlin";

describe("isPlanningShiftMomentInPast", () => {
  it("behält Kalendertag-Logik für vergangene Tage", () => {
    const now = new Date("2026-06-29T14:00:00.000Z");
    expect(
      isPlanningShiftMomentInPast(
        { shiftDateISO: "2026-06-28", startTime: "18:00" },
        BERLIN,
        now
      )
    ).toBe(true);
  });

  it("lässt zukünftige Tage zu", () => {
    const now = new Date("2026-06-29T14:00:00.000Z");
    expect(
      isPlanningShiftMomentInPast(
        { shiftDateISO: "2026-06-30", startTime: "08:00" },
        BERLIN,
        now
      )
    ).toBe(false);
  });

  it("prüft Startzeit am heutigen Tag", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    expect(
      isPlanningShiftMomentInPast(
        { shiftDateISO: "2026-06-29", startTime: "08:00" },
        BERLIN,
        now
      )
    ).toBe(true);
    expect(
      isPlanningShiftMomentInPast(
        { shiftDateISO: "2026-06-29", startTime: "16:00" },
        BERLIN,
        now
      )
    ).toBe(false);
  });

  it("nutzt starts_at wenn vorhanden", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    expect(
      isPlanningShiftMomentInPast(
        {
          shiftDateISO: "2026-06-29",
          startsAt: "2026-06-29T08:00:00.000Z",
        },
        BERLIN,
        now
      )
    ).toBe(true);
  });

  it("heutiger Tag ohne Startzeit bleibt bearbeitbar", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    expect(
      isPlanningShiftMomentInPast({ shiftDateISO: "2026-06-29" }, BERLIN, now)
    ).toBe(false);
  });
});

describe("shouldBlockPastPlanningShiftEdit", () => {
  it("respektiert Org-Einstellung", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    expect(
      shouldBlockPastPlanningShiftEdit(
        { shiftDateISO: "2026-06-29", startTime: "08:00" },
        BERLIN,
        true,
        now
      )
    ).toBe(false);
    expect(
      shouldBlockPastPlanningShiftEdit(
        { shiftDateISO: "2026-06-29", startTime: "08:00" },
        BERLIN,
        false,
        now
      )
    ).toBe(true);
  });
});
