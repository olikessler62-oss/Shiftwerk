import { describe, expect, it } from "vitest";
import type { Profile } from "@schichtwerk/types";
import { sortProfilesByFirstName } from "./profile-display-sort";

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
