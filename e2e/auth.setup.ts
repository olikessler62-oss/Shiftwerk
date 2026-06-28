import { mkdirSync } from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import { e2eCredentialsConfigured } from "./load-env";

const authFile = path.join(__dirname, ".auth/manager.json");

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "(ungültige E-Mail)";
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

function loginFailureHint(email: string, errorParam: string | null): string {
  const decoded = errorParam ? decodeURIComponent(errorParam) : "Unbekannter Fehler";
  return [
    `E2E-Login fehlgeschlagen: ${decoded}`,
    `Verwendete E-Mail: ${maskEmail(email)}`,
    "",
    "Bitte prüfen:",
    "  1. Datei .env.e2e.local im Repo-Root (nicht .env.e2e.example)",
    "  2. E2E_MANAGER_EMAIL = dieselbe E-Mail wie beim manuellen Login im Browser",
    "  3. E2E_MANAGER_PASSWORD = aktuelles Passwort (Sonderzeichen ohne Anführungszeichen)",
    "",
    "Credentials testen:",
    "  npm run e2e:verify-login --workspace=@schichtwerk/web",
  ].join("\n");
}

setup("manager login", async ({ page }) => {
  setup.skip(
    !e2eCredentialsConfigured(),
    "E2E_MANAGER_EMAIL und E2E_MANAGER_PASSWORD in .env.e2e.local setzen"
  );

  const email = process.env.E2E_MANAGER_EMAIL!.trim();

  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(process.env.E2E_MANAGER_PASSWORD!);
  await page.getByRole("button", { name: "Anmelden" }).click();

  try {
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  } catch {
    if (page.url().includes("/login")) {
      const errorParam = new URL(page.url()).searchParams.get("error");
      throw new Error(loginFailureHint(email, errorParam));
    }
    throw new Error(
      `Nach Login weder /dashboard noch /login — aktuelle URL: ${page.url()}`
    );
  }

  await expect(
    page.getByRole("link", { name: /Dashboard/i }).first()
  ).toBeVisible();

  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
