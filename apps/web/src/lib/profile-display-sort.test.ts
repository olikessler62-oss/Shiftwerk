import { describe, expect, it } from "vitest";
import type { Profile } from "@schichtwerk/types";
import {
  sortProfilesByFirstName,
  sortProfilesByShiftCountDesc,
} from "./profile-display-sort";

function profile(id: string, full_name: string): Profile {
  return {
    id,
    organization_id: "org-1",
    full_name,
    email: `${id}@example.com`,
    role: "basic",
    color: "#000000",
    active: true,
    schedulable: true,
    app_registered: false,
    email_fallback: false,
    created_at: "",
    updated_at: "",
    sort_order: 0,
  };
}

describe("sortProfilesByFirstName", () => {
  it("sorts alphabetically by first name, then last name", () => {
    const sorted = sortProfilesByFirstName([
      profile("3", "Zara Young"),
      profile("1", "Anna Albers"),
      profile("2", "Anna Braun"),
      profile("4", "Bea Braun"),
    ]);

    expect(sorted.map((entry) => entry.full_name)).toEqual([
      "Anna Albers",
      "Anna Braun",
      "Bea Braun",
      "Zara Young",
    ]);
  });
});

describe("sortProfilesByShiftCountDesc", () => {
  it("sorts employees with shifts first by descending shift count", () => {
    const profiles = [
      profile("no-shifts", "Anna Albers"),
      profile("two", "Bea Braun"),
      profile("one", "Clara Chen"),
      profile("three", "Dana Davis"),
    ];
    const shifts = [
      { employee_id: "two" },
      { employee_id: "two" },
      { employee_id: "three" },
      { employee_id: "three" },
      { employee_id: "three" },
      { employee_id: "one" },
    ];

    const sorted = sortProfilesByShiftCountDesc(profiles, shifts);

    expect(sorted.map((entry) => entry.id)).toEqual([
      "three",
      "two",
      "one",
      "no-shifts",
    ]);
  });

  it("uses first-name order when shift counts match", () => {
    const profiles = [
      profile("b", "Bea Braun"),
      profile("a", "Anna Albers"),
    ];
    const shifts = [
      { employee_id: "a" },
      { employee_id: "b" },
    ];

    const sorted = sortProfilesByShiftCountDesc(profiles, shifts);

    expect(sorted.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});
