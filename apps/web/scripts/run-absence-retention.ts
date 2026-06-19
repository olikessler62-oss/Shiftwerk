/**
 * Löscht Abwesenheiten, deren Enddatum älter als 12 Monate ist.
 * Benötigt Service-Role (apps/web/.env.local).
 *
 * Usage (from apps/web):
 *   npm run retention:absences
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  ABSENCE_PURGE_BATCH_SIZE,
  absencePurgeCutoffISO,
} from "@schichtwerk/database";

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

async function runPurgeJob(
  client: ReturnType<typeof createClient>
): Promise<{ purged: number; durationMs: number }> {
  const purgeCutoff = absencePurgeCutoffISO();
  const started = Date.now();

  let purged = 0;
  for (;;) {
    const { data: batchCount, error } = await client.rpc(
      "purge_expired_absence_requests_batch",
      {
        p_purge_cutoff: purgeCutoff,
        p_batch_size: ABSENCE_PURGE_BATCH_SIZE,
      }
    );
    if (error) throw new Error(error.message);
    const count = Number(batchCount ?? 0);
    if (count === 0) break;
    purged += count;
  }

  return { purged, durationMs: Date.now() - started };
}

async function main() {
  loadEnvFile(ENV_PATH);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local fehlen"
    );
    process.exit(1);
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await runPurgeJob(client);
  console.log(
    `[absence-purge] cutoff=${absencePurgeCutoffISO()} purged=${result.purged} duration_ms=${result.durationMs}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
