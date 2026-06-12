import { describe, expect, it } from "vitest";
import { validateOrganizationPlanningModeUpgrade } from "./org-planning-mode";

describe("validateOrganizationPlanningModeUpgrade", () => {
  it("allows simple to advanced", () => {
    expect(validateOrganizationPlanningModeUpgrade("simple", "advanced").ok).toBe(
      true
    );
  });

  it("rejects advanced to simple", () => {
    const result = validateOrganizationPlanningModeUpgrade("advanced", "simple");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("downgrade_not_allowed");
    }
  });

  it("rejects no-op upgrade", () => {
    const result = validateOrganizationPlanningModeUpgrade("advanced", "advanced");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("already_active");
    }
  });
});
