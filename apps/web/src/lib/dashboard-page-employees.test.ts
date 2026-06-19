import { describe, expect, it, vi } from "vitest";
import { resolveDashboardEmployeesForShifts } from "./dashboard-page-employees";
import type { Profile } from "@schichtwerk/types";

function profile(
  partial: Pick<Profile, "id" | "full_name"> &
    Partial<Pick<Profile, "sort_order" | "organization_id">>
): Profile {
  return {
    id: partial.id,
    full_name: partial.full_name,
    sort_order: partial.sort_order ?? 0,
    organization_id: partial.organization_id ?? "org-1",
    email: `${partial.id}@example.com`,
    color: null,
    weekly_hours: 40,
    is_active: true,
    role_id: "role-1",
    created_at: "",
    updated_at: "",
  } as Profile;
}

describe("resolveDashboardEmployeesForShifts", () => {
  it("returns active employees unchanged when all shift assignees are included", async () => {
    const active = [profile({ id: "a", full_name: "Anna" })];
    const result = await resolveDashboardEmployeesForShifts(
      active,
      [{ employee_id: "a" }],
      vi.fn(),
      "org-1"
    );
    expect(result.map((employee) => employee.id)).toEqual(["a"]);
  });

  it("adds profiles for shift assignees missing from the active employee list", async () => {
    const active = [profile({ id: "a", full_name: "Anna", sort_order: 0 })];
    const fetchProfileById = vi.fn(async (id: string) => {
      if (id === "m") {
        return profile({
          id: "m",
          full_name: "Oliver Kessler",
          sort_order: 5,
        });
      }
      return null;
    });

    const result = await resolveDashboardEmployeesForShifts(
      active,
      [{ employee_id: "m" }],
      fetchProfileById,
      "org-1"
    );

    expect(fetchProfileById.mock.calls[0]?.[0]).toBe("m");
    expect(result.map((employee) => employee.id)).toEqual(["a", "m"]);
  });
});
