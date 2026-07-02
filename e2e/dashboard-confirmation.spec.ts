import { test, expect } from "@playwright/test";
import { e2eCredentialsConfigured } from "./load-env";
import { runDashboardSeed } from "./helpers/seed";
import {
  dashboardAreaCard,
  openDashboardDayDrilldown,
  readDashboardScenarios,
  scenarioNavigation,
} from "./helpers/dashboard";

test.describe("Dashboard · Schichtbestätigung (Header)", () => {
  test.beforeAll(() => {
    test.skip(
      !e2eCredentialsConfigured(),
      "E2E_MANAGER_EMAIL und E2E_MANAGER_PASSWORD in .env.e2e.local setzen"
    );
    runDashboardSeed();
  });

  test.beforeEach(({ }, testInfo) => {
    const manifest = readDashboardScenarios();
    test.skip(
      !manifest.barConfirmation || manifest.shiftConfirmationEnabled === false,
      "Seed ohne Bestätigungsszenario — npm run e2e:seed:dashboard ausführen"
    );
  });

  test("Bar · Ausstehende Anfragen → Offene Punkte", async ({ page }) => {
    const manifest = readDashboardScenarios();
    const scenario = manifest.barConfirmation!;

    await openDashboardDayDrilldown(page, scenarioNavigation(manifest, scenario));

    const card = dashboardAreaCard(page, scenario.areaName);
    const line = card.getByText("Ausstehende Anfragen", { exact: true });
    await expect(line).toBeVisible();
    await expect(line).toHaveCSS("cursor", "pointer");

    await line.click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Offene Punkte" })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Schicht stornieren" })
    ).toBeVisible();
  });

  test("Bar · Abgelehnte Anfragen → Offene Punkte", async ({ page }) => {
    const manifest = readDashboardScenarios();
    const scenario = manifest.barConfirmation!;

    await openDashboardDayDrilldown(page, scenarioNavigation(manifest, scenario));

    const card = dashboardAreaCard(page, scenario.areaName);
    const line = card.getByText("Abgelehnte Anfragen", { exact: true });
    await expect(line).toBeVisible();

    await line.click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Offene Punkte" })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Ersatz zuweisen" })
    ).toBeVisible();
  });

  test("Bestätigungs-Modal schließt mit Escape", async ({ page }) => {
    const manifest = readDashboardScenarios();
    const scenario = manifest.barConfirmation!;

    await openDashboardDayDrilldown(page, scenarioNavigation(manifest, scenario));

    const card = dashboardAreaCard(page, scenario.areaName);
    await card.getByText("Ausstehende Anfragen", { exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
