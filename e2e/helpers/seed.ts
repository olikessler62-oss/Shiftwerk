import { execSync } from "node:child_process";
import path from "node:path";
import { loadE2EEnv } from "../load-env";

export function runDashboardSeed(): void {
  loadE2EEnv();
  const root = path.resolve(__dirname, "../..");
  execSync("npm run e2e:seed:dashboard --workspace=@schichtwerk/web", {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}
