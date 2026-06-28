import { test, expect } from "@playwright/test";
import { e2eCredentialsConfigured } from "./load-env";
import {
  closeSettingsPanel,
  openSettingsModalFromNav,
  settingsPanel,
} from "./helpers/settings-panel";

const SETTINGS_MODALS = [
  { label: "Standorte", flag: "standorte", heading: "Standorte" },
  { label: "Profile", flag: "profiles", heading: "Profile" },
  { label: "Rollen", flag: "rollen", heading: "Rollen" },
  { label: "Tätigkeiten", flag: "qualifikationen", heading: "Tätigkeiten" },
] as const;

test.describe("Einstellungen · Modals", () => {
  test.beforeEach(() => {
    test.skip(
      !e2eCredentialsConfigured(),
      "E2E_MANAGER_EMAIL und E2E_MANAGER_PASSWORD in .env.e2e.local setzen"
    );
  });

  for (const modal of SETTINGS_MODALS) {
    test(`${modal.label}-Panel öffnet und schließt`, async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      await openSettingsModalFromNav(page, modal.label, modal.flag);

      const panel = settingsPanel(page);
      await expect(
        panel.getByRole("heading", { level: 2, name: modal.heading })
      ).toBeVisible({ timeout: 30_000 });

      await closeSettingsPanel(page);

      await expect(page).not.toHaveURL(new RegExp(`${modal.flag}=1`));
      await expect(panel).toBeHidden();
    });
  }
});
