import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string, force = false) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (force || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Lädt Web- und E2E-Env für Playwright (ohne zusätzliche dotenv-Dependency). */
export function loadE2EEnv() {
  const root = resolve(__dirname, "..");
  loadEnvFile(resolve(root, "apps/web/.env.local"));
  loadEnvFile(resolve(root, ".env.local"));
  // E2E-Datei zuletzt — überschreibt ggf. falsche Shell-Variablen
  loadEnvFile(resolve(root, ".env.e2e.local"), true);
  loadEnvFile(resolve(root, "apps/web/.env.e2e.local"), true);
}

export function e2eCredentialsConfigured(): boolean {
  return Boolean(
    process.env.E2E_MANAGER_EMAIL?.trim() &&
      process.env.E2E_MANAGER_PASSWORD?.trim()
  );
}
