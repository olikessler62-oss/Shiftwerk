import { test, expect } from "@playwright/test";
import { e2eCredentialsConfigured } from "./load-env";
import { runDashboardSeed } from "./helpers/seed";
import {
  dashboardAreaCard,
  dashboardWeekDayCard,
  openDashboardDayDrilldown,
  readDashboardScenarios,
  scenarioNavigation,
} from "./helpers/dashboard";

test.describe("Dashboard · Navigation", () => {
  test.beforeAll(() => {
    test.skip(
      !e2eCredentialsConfigured(),
      "E2E_MANAGER_EMAIL und E2E_MANAGER_PASSWORD in .env.e2e.local setzen"
    );
    runDashboardSeed();
  });

  test("Wochenübersicht → Tages-Drilldown → zurück", async ({ page }) => {
    const manifest = readDashboardScenarios();
    const params = new URLSearchParams({
      week: manifest.weekStart,
      location: manifest.locationId,
    });

    await page.goto(`/dashboard?${params.toString()}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("article")).toHaveCount(0);

    await dashboardWeekDayCard(page, manifest.barUnderstaffed.shiftDate).click();

    await expect(
      page.getByRole("button", { name: "zurück zur Wochenansicht" })
    ).toBeVisible();

    await expect(
      dashboardAreaCard(page, manifest.barUnderstaffed.areaName)
    ).toBeVisible();

    await page
      .getByRole("button", { name: "zurück zur Wochenansicht" })
      .click();

    await expect(page.getByRole("article")).toHaveCount(0);
  });
});
