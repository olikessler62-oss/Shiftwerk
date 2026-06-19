#!/usr/bin/env node
/**
 * Ensures the Supabase service role key is only referenced in server-safe files.
 * Run: npm run audit:service-role
 */
import { readFileSync, readdirSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const KEY_PATTERNS = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"];

const ADMIN_SYMBOLS = ["createAdminClient", "getAdminDatabase"];

/** Paths that may reference admin credentials (POSIX-style, repo-relative). */
const ALLOWLIST = new Set([
  "apps/web/src/lib/supabase/admin.ts",
  "apps/web/src/lib/db.ts",
  "apps/web/scripts/seed-test-employees.ts",
  "apps/web/scripts/run-shift-retention.ts",
  "apps/web/scripts/run-absence-retention.ts",
  ".env.example",
  "README.md",
  "packages/database/README.md",
  "scripts/audit-service-role-key.mjs",
]);

function isServerModule(content) {
  return (
    content.includes('"use server"') ||
    content.includes("'use server'") ||
    content.includes("import \"server-only\"")
  );
}

function scanFile(fullPath) {
  const rel = relative(ROOT, fullPath).replace(/\\/g, "/");
  if (ALLOWLIST.has(rel)) return;

  const content = readFileSync(fullPath, "utf8");
  const serverSafe = isServerModule(content);

  for (const pattern of KEY_PATTERNS) {
    if (!content.includes(pattern)) continue;
    violations.push({ rel, pattern });
  }

  if (
    content.includes("createAdminClient") &&
    rel !== "apps/web/src/lib/supabase/admin.ts" &&
    rel !== "apps/web/src/lib/db.ts"
  ) {
    violations.push({ rel, pattern: "createAdminClient outside admin.ts" });
  }

  for (const pattern of ADMIN_SYMBOLS) {
    if (pattern === "createAdminClient") continue;
    if (!content.includes(pattern)) continue;
    if (serverSafe) continue;
    violations.push({ rel, pattern: `${pattern} outside server context` });
  }

  const isClientModule =
    content.includes('"use client"') || content.includes("'use client'");
  const usesAdmin =
    content.includes("createAdminClient") ||
    content.includes("getAdminDatabase") ||
    content.includes("SUPABASE_SERVICE_ROLE_KEY") ||
    content.includes("SUPABASE_SECRET_KEY");

  if (isClientModule && usesAdmin) {
    violations.push({
      rel,
      pattern: "use client + admin/service-role reference",
    });
  }
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  ".turbo",
]);

const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|md|example)$/i.test(entry.name)) {
      continue;
    }
    scanFile(full);
  }
}

walk(ROOT);

if (violations.length > 0) {
  console.error("Service-role audit failed:\n");
  for (const v of violations) {
    console.error(`  - ${v.rel}: ${v.pattern}`);
  }
  console.error(
    "\nAdmin credentials must only appear in server-only modules (see ALLOWLIST in scripts/audit-service-role-key.mjs)."
  );
  process.exit(1);
}

console.log("Service-role audit passed.");
