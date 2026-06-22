import { describe, expect, it } from "vitest";
import {
  buildOverviewCompensationDisplayRows,
  buildOverviewCompensationEmployeeJumpOptions,
  firstOverviewCompensationRowIdForEmployee,
  overviewCompensationPlaceholderRowId,
} from "./overview-compensation-display";
import type { Profile, ProfileHourlyRate } from "@schichtwerk/types";

const klaus: Profile = {
  id: "emp-klaus",
  organization_id: "org-1",
  role: "basic",
  role_name: "Mitarbeiter",
  full_name: "Klaus Mustermann",
  email: "daxtrader@arcor.de",
  mobile_phone: null,
  color: "#22c55e",
  weekly_hours: 40,
  is_active: true,
  schedulable: true,
  email_fallback_mode: false,
  app_registered_at: null,
  sort_order: 1,
  created_at: "2026-01-01T00:00:00.000Z",
};

const anna: Profile = {
  ...klaus,
  id: "emp-anna",
  full_name: "Anna Schmidt",
  email: "anna@example.com",
  sort_order: 0,
};

const annaRate: ProfileHourlyRate = {
  id: "rate-anna",
  organization_id: "org-1",
  profile_id: "emp-anna",
  amount: 18.5,
  currency: "EUR",
  valid_from: "2026-01-01",
  created_by: "mgr-1",
  created_by_name: "Manager",
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("buildOverviewCompensationDisplayRows", () => {
  it("includes planning employees without hourly rates as placeholder rows", () => {
    const rows = buildOverviewCompensationDisplayRows({
      rates: [annaRate],
      profiles: [anna, klaus],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.employeeName).toBe("Anna Schmidt");
    expect(rows[0]?.rate?.id).toBe("rate-anna");
    expect(rows[1]?.employeeName).toBe("Klaus Mustermann");
    expect(rows[1]?.isPlaceholder).toBe(true);
    expect(rows[1]?.id).toBe(overviewCompensationPlaceholderRowId("emp-klaus"));
  });
});

describe("overview compensation employee jump", () => {
  it("resolves first row id for employees without rates", () => {
    const rows = buildOverviewCompensationDisplayRows({
      rates: [],
      profiles: [klaus],
    });
    const options = buildOverviewCompensationEmployeeJumpOptions([klaus], rows);

    expect(options).toHaveLength(1);
    expect(options[0]?.firstRowId).toBe(overviewCompensationPlaceholderRowId("emp-klaus"));
    expect(firstOverviewCompensationRowIdForEmployee(rows, "emp-klaus")).toBe(
      overviewCompensationPlaceholderRowId("emp-klaus")
    );
  });
});
