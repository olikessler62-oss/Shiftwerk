import { describe, expect, it } from "vitest";
import {
  hasRemainingAssignableWeekDates,
  remainingAssignableWeekDates,
} from "@/lib/shift-assign-rest-of-week";

const week = [
  "2026-06-15",
  "2026-06-16",
  "2026-06-17",
  "2026-06-18",
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
];

describe("remainingAssignableWeekDates", () => {
  it("returns later weekdays in the same week", () => {
    expect(remainingAssignableWeekDates("2026-06-16", week, "2026-06-15")).toEqual([
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
    ]);
  });

  it("excludes past days after the anchor", () => {
    expect(
      remainingAssignableWeekDates("2026-06-16", week, "2026-06-18")
    ).toEqual(["2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21"]);
  });

  it("returns empty on the last day of the week", () => {
    expect(hasRemainingAssignableWeekDates("2026-06-21", week, "2026-06-15")).toBe(
      false
    );
  });
});
