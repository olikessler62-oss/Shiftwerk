import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

export async function openSettingsModalFromNav(
  page: Page,
  label: string,
  urlFlag: string
): Promise<void> {
  await page.getByRole("link", { name: label, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${urlFlag}=1`));
}

export function settingsPanel(page: Page): Locator {
  return page.getByRole("dialog");
}

/** Slide-in-Panel schließen (X in der Kopfzeile, nach dem Laden). */
export async function closeSettingsPanel(page: Page): Promise<void> {
  const panel = settingsPanel(page);
  const headerClose = panel.getByLabel("Schließen", { exact: true });
  await expect(headerClose).toBeEnabled({ timeout: 45_000 });
  await headerClose.click();
}
