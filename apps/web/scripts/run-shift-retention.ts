/**
 * Nächtlicher Retention-Job: Hot → Archiv → Purge (Spec 006 Phase 2).
 * Benötigt Service-Role (apps/web/.env.local).
 *
 * Usage (from apps/web):
 *   npm run retention:shifts
 *   npm run retention:shifts -- --archive-only
 *   npm run retention:shifts -- --purge-only
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  SHIFTS_ARCHIVE_BATCH_SIZE,
  shiftHotCutoffISO,
  shiftPurgeCutoffISO,
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

function parseFlags(argv: string[]) {
  return {
    archiveOnly: argv.includes("--archive-only"),
    purgeOnly: argv.includes("--purge-only"),
  };
}

async function runArchiveJob(
  client: ReturnType<typeof createClient>
): Promise<{ archived: number; cancelledSwaps: number; durationMs: number }> {
  const hotCutoff = shiftHotCutoffISO();
  const started = Date.now();

  const { data: cancelledSwaps, error: cancelError } = await client.rpc(
    "cancel_pending_swaps_before_shift_archive",
    { p_hot_cutoff: hotCutoff }
  );
  if (cancelError) throw new Error(cancelError.message);

  let archived = 0;
  for (;;) {
    const { data: batchCount, error } = await client.rpc("archive_shifts_batch", {
      p_hot_cutoff: hotCutoff,
      p_batch_size: SHIFTS_ARCHIVE_BATCH_SIZE,
    });
    if (error) throw new Error(error.message);
    const count = Number(batchCount ?? 0);
    if (count === 0) break;
    archived += count;
  }

  const durationMs = Date.now() - started;
  await client.rpc("log_shift_retention_run", {
    p_job_type: "archive",
    p_cutoff_date: hotCutoff,
    p_processed_count: archived,
    p_cancelled_swaps: Number(cancelledSwaps ?? 0),
    p_duration_ms: durationMs,
  });

  return {
    archived,
    cancelledSwaps: Number(cancelledSwaps ?? 0),
    durationMs,
  };
}

async function runPurgeJob(
  client: ReturnType<typeof createClient>
): Promise<{ purged: number; durationMs: number }> {
  const purgeCutoff = shiftPurgeCutoffISO();
  const started = Date.now();

  let purged = 0;
  for (;;) {
    const { data: batchCount, error } = await client.rpc(
      "purge_shifts_archive_batch",
      {
        p_purge_cutoff: purgeCutoff,
        p_batch_size: SHIFTS_ARCHIVE_BATCH_SIZE,
      }
    );
    if (error) throw new Error(error.message);
    const count = Number(batchCount ?? 0);
    if (count === 0) break;
    purged += count;
  }

  const durationMs = Date.now() - started;
  await client.rpc("log_shift_retention_run", {
    p_job_type: "purge",
    p_cutoff_date: purgeCutoff,
    p_processed_count: purged,
    p_cancelled_swaps: null,
    p_duration_ms: durationMs,
  });

  return { purged, durationMs };
}

async function main() {
  loadEnvFile(ENV_PATH);
  const flags = parseFlags(process.argv.slice(2));

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

  const runArchive = !flags.purgeOnly;
  const runPurge = !flags.archiveOnly;

  if (runArchive) {
    const result = await runArchiveJob(client);
    console.log(
      `[archive] cutoff=${shiftHotCutoffISO()} archived=${result.archived} cancelled_swaps=${result.cancelledSwaps} duration_ms=${result.durationMs}`
    );
  }

  if (runPurge) {
    const result = await runPurgeJob(client);
    console.log(
      `[purge] cutoff=${shiftPurgeCutoffISO()} purged=${result.purged} duration_ms=${result.durationMs}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
