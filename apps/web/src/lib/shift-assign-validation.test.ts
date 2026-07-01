import { describe, expect, it, vi } from "vitest";
import type { SchichtwerkDatabase } from "@schichtwerk/database";
import { loadShiftAssignValidationContext } from "@/lib/shift-assign-validation";

function createDbMock(
  overrides: Partial<SchichtwerkDatabase> = {}
): SchichtwerkDatabase {
  return {
    getOrganizationCountryCode: vi.fn().mockResolvedValue("DE"),
    listOrganizationRecurringAvailability: vi.fn().mockResolvedValue([]),
    listOrganizationAbsences: vi.fn().mockResolvedValue([]),
    listLocationAreaStaffingForArea: vi.fn().mockResolvedValue([]),
    listLocationAreaServiceHoursForArea: vi.fn().mockResolvedValue([]),
    listProfileQualificationIdsByOrganization: vi
      .fn()
      .mockResolvedValue(new Map([["emp-1", ["qual-1"]]])),
    listQualifications: vi.fn().mockRejectedValue(new Error("db unavailable")),
    ...overrides,
  } as unknown as SchichtwerkDatabase;
}

describe("loadShiftAssignValidationContext", () => {
  it("propagates listQualifications errors in advanced mode", async () => {
    const db = createDbMock();

    await expect(
      loadShiftAssignValidationContext(
        db,
        "org-1",
        "advanced",
        "loc-1",
        "area-1"
      )
    ).rejects.toThrow("db unavailable");
  });

  it("does not load qualifications in simple mode", async () => {
    const db = createDbMock({
      listQualifications: vi.fn().mockRejectedValue(new Error("db unavailable")),
    });

    const ctx = await loadShiftAssignValidationContext(
      db,
      "org-1",
      "simple",
      "loc-1",
      "area-1"
    );

    expect(ctx.profileQualificationIds).toBeUndefined();
    expect(ctx.qualificationNameById).toBeUndefined();
    expect(db.listQualifications).not.toHaveBeenCalled();
  });
});
