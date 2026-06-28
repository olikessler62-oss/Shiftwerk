import { test, expect } from "@playwright/test";
import { e2eCredentialsConfigured } from "./load-env";
import { runDashboardSeed } from "./helpers/seed";
import {
  dashboardAreaCard,
  openDashboardDayDrilldown,
  openStaffingGapStatus,
  readDashboardScenarios,
  scenarioNavigation,
} from "./helpers/dashboard";

test.describe("Dashboard · Bereichs-Header (Walkthrough Schritte 1–5)", () => {
  test.beforeAll(() => {
    test.skip(
      !e2eCredentialsConfigured(),
      "E2E_MANAGER_EMAIL und E2E_MANAGER_PASSWORD in .env.e2e.local setzen"
    );
    runDashboardSeed();
  });

  test("Bar · Noch unbesetzte Schichten → Personalvorschlag", async ({ page }) => {
    const manifest = readDashboardScenarios();
    await openDashboardDayDrilldown(
      page,
      scenarioNavigation(manifest, manifest.barUnderstaffed)
    );

    const card = dashboardAreaCard(page, manifest.barUnderstaffed.areaName);
    const line = openStaffingGapStatus(card);
    await expect(line).toBeVisible();
    await expect(line).toHaveCSS("cursor", "pointer");
    await line.click();
    await expect(page.getByRole("dialog").getByText("Vorschlag: Personal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("Restaurant · unterbesetzt", async ({ page }) => {
    const manifest = readDashboardScenarios();
    await openDashboardDayDrilldown(
      page,
      scenarioNavigation(manifest, manifest.restaurantUnderstaffed)
    );

    const card = dashboardAreaCard(page, manifest.restaurantUnderstaffed.areaName);
    await expect(openStaffingGapStatus(card)).toBeVisible();
  });

  test("Restaurant · gedeckt (nicht klickbar)", async ({ page }) => {
    const manifest = readDashboardScenarios();
    await openDashboardDayDrilldown(
      page,
      scenarioNavigation(manifest, manifest.restaurantCovered)
    );

    const card = dashboardAreaCard(page, manifest.restaurantCovered.areaName);
    const covered = card.getByText("Gedeckt", { exact: true });
    await expect(covered).toBeVisible();
    await expect(card.getByRole("button", { name: "Gedeckt" })).toHaveCount(0);
  });

  test("Restaurant · Hinweise zur Einteilung → Modal", async ({ page }) => {
    const manifest = readDashboardScenarios();
    await openDashboardDayDrilldown(
      page,
      scenarioNavigation(manifest, manifest.restaurantOverstaffed)
    );

    const card = dashboardAreaCard(page, manifest.restaurantOverstaffed.areaName);
    const line = card.getByText("Hinweise zur Einteilung", { exact: true });
    await expect(line).toBeVisible();
    await line.click();
    await expect(
      page.getByRole("dialog").getByText(/Hinweise zur Einteilung/)
    ).toBeVisible();
  });

  test("Küche · Hinweise zur Einteilung (Qualifikation)", async ({ page }) => {
    const manifest = readDashboardScenarios();
    await openDashboardDayDrilldown(
      page,
      scenarioNavigation(manifest, manifest.kitchenQualMismatch)
    );

    const card = dashboardAreaCard(page, manifest.kitchenQualMismatch.areaName);
    const line = card.getByText("Hinweise zur Einteilung", { exact: true });
    await expect(line).toBeVisible();
    await line.click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: /Hinweise zur Einteilung · Küche/ })
    ).toBeVisible();
    await expect(
      dialog.getByText(/zugerechnet als|fehlt:|über Bedarf/i).first()
    ).toBeVisible();
  });
});
