/**
 * Applies a SQL migration file to the Supabase Postgres database.
 *
 * Usage (from apps/web):
 *   npx tsx scripts/run-sql-migration.ts ../../packages/database/migrations/20260605_absence_open_ended.sql
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../.env.local");

function loadEnvFile(path: string) {
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  const migrationArg = process.argv[2];
  if (!migrationArg) {
    console.error("Usage: tsx scripts/run-sql-migration.ts <path-to.sql>");
    process.exit(1);
  }

  loadEnvFile(ENV_PATH);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!supabaseUrl || !password) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD must be set in apps/web/.env.local"
    );
    process.exit(1);
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const migrationPath = resolve(process.cwd(), migrationArg);
  const sqlContent = readFileSync(migrationPath, "utf8");

  const hosts = [
    `db.${projectRef}.supabase.co`,
    "aws-0-eu-central-1.pooler.supabase.com",
  ];
  const users = ["postgres", `postgres.${projectRef}`];

  let lastError: unknown;

  for (const host of hosts) {
    for (const username of users) {
      const sql = postgres({
        host,
        port: 5432,
        database: "postgres",
        username,
        password,
        ssl: "require",
        max: 1,
        connect_timeout: 15,
      });

      try {
        console.log(`Connecting as ${username}@${host} …`);
        await sql.unsafe(sqlContent);
        console.log(`Migration applied: ${migrationPath}`);
        await sql.end({ timeout: 5 });
        return;
      } catch (error) {
        lastError = error;
        try {
          await sql.end({ timeout: 5 });
        } catch {
          // ignore cleanup errors
        }
        console.warn(
          `Failed (${username}@${host}):`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  console.error("Migration failed on all connection attempts.");
  if (lastError instanceof Error) {
    console.error(lastError.message);
  }
  process.exit(1);
}

void main();
