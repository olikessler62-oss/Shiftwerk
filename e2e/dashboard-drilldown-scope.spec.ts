import { test, expect } from "@playwright/test";
import { e2eCredentialsConfigured } from "./load-env";
import { runDashboardSeed } from "./helpers/seed";
import {
  dashboardAreaCard,
  areaScopeToggle,
  openDashboardDayDrilldown,
  openStaffingGapStatus,
  readDashboardScenarios,
  scenarioNavigation,
  setAreaDetailScope,
} from "./helpers/dashboard";

test.describe("Dashboard · Drilldown Heute/Woche", () => {
  test.beforeAll(() => {
    test.skip(
      !e2eCredentialsConfigured(),
      "E2E_MANAGER_EMAIL und E2E_MANAGER_PASSWORD in .env.e2e.local setzen"
    );
    runDashboardSeed();
  });

  test("Restaurant · Heute gedeckt, Woche mit Lücken", async ({ page }) => {
    const manifest = readDashboardScenarios();
    await openDashboardDayDrilldown(
      page,
      scenarioNavigation(manifest, manifest.restaurantCovered)
    );

    const card = dashboardAreaCard(
      page,
      manifest.restaurantCovered.areaName
    );

    await expect(card.getByText("Gedeckt", { exact: true })).toBeVisible();

    await setAreaDetailScope(card, "week");

    await expect(openStaffingGapStatus(card)).toBeVisible();

    await setAreaDetailScope(card, "day");

    await expect(card.getByText("Gedeckt", { exact: true })).toBeVisible();
  });

  test("Scope-Umschalter zeigt Heute und Woche", async ({ page }) => {
    const manifest = readDashboardScenarios();
    await openDashboardDayDrilldown(
      page,
      scenarioNavigation(manifest, manifest.barUnderstaffed)
    );

    const card = dashboardAreaCard(page, manifest.barUnderstaffed.areaName);
    const toggle = areaScopeToggle(card);

    await expect(toggle.getByRole("button")).toHaveCount(2);
    await expect(toggle.getByRole("button").nth(1)).toBeVisible();
    await expect(toggle.getByRole("button").nth(0)).toHaveAttribute("aria-pressed", "true");
  });
});
