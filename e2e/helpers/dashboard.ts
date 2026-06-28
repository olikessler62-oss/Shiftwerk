import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export type ScenarioRef = {
  shiftDate: string;
  areaName: string;
};

export type DashboardScenariosManifest = {
  weekStart: string;
  locationId: string;
  shiftConfirmationEnabled?: boolean;
  barUnderstaffed: ScenarioRef;
  restaurantUnderstaffed: ScenarioRef;
  restaurantCovered: ScenarioRef;
  restaurantOverstaffed: ScenarioRef;
  kitchenQualMismatch: ScenarioRef;
  barConfirmation?: ScenarioRef;
};

export type DashboardNavigation = {
  weekStart: string;
  locationId: string;
  shiftDate: string;
};

const SCENARIOS_CACHE = path.join(__dirname, "../.cache/dashboard-scenarios.json");
const LEGACY_BAR_CACHE = path.join(__dirname, "../.cache/bar-understaffed.json");
/** Falscher Pfad aus früheren Seed-Läufen (E2E_ROOT war apps/ statt Repo-Root). */
const LEGACY_WRONG_SCENARIOS_CACHE = path.join(
  __dirname,
  "../../apps/e2e/.cache/dashboard-scenarios.json"
);

function resolveScenariosCachePath(): string {
  if (existsSync(SCENARIOS_CACHE)) return SCENARIOS_CACHE;
  if (existsSync(LEGACY_WRONG_SCENARIOS_CACHE)) return LEGACY_WRONG_SCENARIOS_CACHE;
  return SCENARIOS_CACHE;
}

export function readDashboardScenarios(): DashboardScenariosManifest {
  const cachePath = resolveScenariosCachePath();
  if (!existsSync(cachePath)) {
    throw new Error(
      "E2E-Seed-Cache fehlt. Vorher: npm run e2e:seed:dashboard"
    );
  }
  return JSON.parse(
    readFileSync(cachePath, "utf8")
  ) as DashboardScenariosManifest;
}

/** @deprecated Nutze readDashboardScenarios().barUnderstaffed */
export function readBarUnderstaffedSeed(): DashboardNavigation & { areaName: string } {
  if (existsSync(SCENARIOS_CACHE)) {
    const manifest = readDashboardScenarios();
    return {
      ...manifest.barUnderstaffed,
      weekStart: manifest.weekStart,
      locationId: manifest.locationId,
    };
  }
  if (!existsSync(LEGACY_BAR_CACHE)) {
    throw new Error("E2E-Seed-Cache fehlt.");
  }
  return JSON.parse(readFileSync(LEGACY_BAR_CACHE, "utf8")) as DashboardNavigation & {
    areaName: string;
  };
}

/** Monatskürzel wie auf Dashboard-Tagkarten (z. B. „JUL“). */
export function dayCardMonthShort(shiftDate: string): string {
  const [year, month, day] = shiftDate.split("-").map(Number);
  return new Date(year, month - 1, day)
    .toLocaleDateString("de-DE", { month: "short" })
    .replace(/\.$/, "")
    .toUpperCase();
}

export function dashboardWeekDayCard(page: Page, shiftDate: string) {
  const dayNumber = Number.parseInt(shiftDate.split("-")[2] ?? "", 10);
  const monthShort = dayCardMonthShort(shiftDate);

  return page
    .locator("main")
    .getByRole("button")
    .filter({ has: page.getByText(String(dayNumber), { exact: true }) })
    .filter({ has: page.getByText(monthShort, { exact: true }) });
}

export async function openDashboardDayDrilldown(
  page: Page,
  nav: DashboardNavigation
): Promise<void> {
  const params = new URLSearchParams({
    week: nav.weekStart,
    location: nav.locationId,
  });

  await page.goto(`/dashboard?${params.toString()}`);
  await page.waitForLoadState("networkidle");

  await dashboardWeekDayCard(page, nav.shiftDate).click();

  await expect(page.getByRole("button", { name: "Wochenübersicht" })).toBeVisible();
}

export function dashboardAreaCard(page: Page, areaName: string) {
  return page.getByRole("article").filter({
    has: page.getByRole("heading", { name: areaName, exact: true }),
  });
}

/** Scope-Umschalter sitzt im Eltern-Container neben der Bereichskarte. */
export function areaScopeToggle(card: ReturnType<typeof dashboardAreaCard>) {
  return card.locator("xpath=..").getByRole("group", {
    name: "Zeitraum für Bereichsinformationen",
  });
}

export function openStaffingGapStatus(card: ReturnType<typeof dashboardAreaCard>) {
  return card.getByText("Noch unbesetzte Schichten", { exact: true });
}

export function scenarioNavigation(
  manifest: DashboardScenariosManifest,
  scenario: ScenarioRef
): DashboardNavigation {
  return {
    weekStart: manifest.weekStart,
    locationId: manifest.locationId,
    shiftDate: scenario.shiftDate,
  };
}

export async function setAreaDetailScope(
  card: ReturnType<typeof dashboardAreaCard>,
  scope: "day" | "week"
): Promise<void> {
  const toggle = areaScopeToggle(card);
  const index = scope === "day" ? 0 : 1;
  await toggle.getByRole("button").nth(index).click();
}
