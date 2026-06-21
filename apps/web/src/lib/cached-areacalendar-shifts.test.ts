import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: () => unknown) => fn,
}));

import {  areaCalendarLocationShiftsCacheTag,
  areaCalendarOrgShiftsCacheTag,
  areaCalendarShiftCacheTags,
  areaCalendarShiftsCacheTag,
  weekStartsForShiftCacheInvalidation,
} from "@/lib/cached-areacalendar-shifts";

describe("areaCalendarShiftCacheTags", () => {
  it("includes week, location, and org tags for invalidation", () => {
    expect(
      areaCalendarShiftCacheTags({
        organizationId: "org-1",
        locationId: "loc-1",
        weekStart: "2026-06-22",
      })
    ).toEqual([
      "shifts:org-1:loc-1:2026-06-22",
      "shifts-loc:org-1:loc-1",
      "shifts-org:org-1",
    ]);
  });
});

describe("weekStartsForShiftCacheInvalidation", () => {
  it("includes current and previous week for overnight spans", () => {
    expect(weekStartsForShiftCacheInvalidation("2026-06-24")).toEqual([
      "2026-06-15",
      "2026-06-22",
    ]);
  });
});

describe("cache tag helpers", () => {
  it("builds stable tag strings", () => {
    expect(areaCalendarShiftsCacheTag("org", "loc", "2026-06-22")).toBe(
      "shifts:org:loc:2026-06-22"
    );
    expect(areaCalendarLocationShiftsCacheTag("org", "loc")).toBe(
      "shifts-loc:org:loc"
    );
    expect(areaCalendarOrgShiftsCacheTag("org")).toBe("shifts-org:org");
  });
});

describe("revalidateAreaCalendarShiftsAfterChange", () => {
  it("uses shiftDate (camelCase) for week cache invalidation", async () => {
    const { revalidateTag } = await import("next/cache");
    const { revalidateAreaCalendarShiftsAfterChange } = await import(
      "@/lib/cached-areacalendar-shifts"
    );

    vi.mocked(revalidateTag).mockClear();

    revalidateAreaCalendarShiftsAfterChange({
      organizationId: "org-1",
      shifts: [
        {
          locationId: "loc-1",
          shiftDate: "2026-06-24",
        },
      ],
    });

    expect(revalidateTag).toHaveBeenCalledWith("shifts-org:org-1");
    expect(revalidateTag).toHaveBeenCalledWith("shifts-loc:org-1:loc-1");
    expect(revalidateTag).toHaveBeenCalledWith("shifts:org-1:loc-1:2026-06-22");
  });
});
