"use server";

import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type { NotificationOutboxEntry } from "@schichtwerk/types";

export type NotificationOutboxRow = NotificationOutboxEntry & {
  recipient_full_name: string;
};

export async function fetchNotificationOutboxEntries(): Promise<
  | { ok: true; entries: NotificationOutboxRow[] }
  | { ok: false; error: string }
> {
  try {
    const { organizationId, profile } = await requireManager();
    const isDev = process.env.NODE_ENV === "development";

    if (profile.role !== "admin" && !isDev) {
      return { ok: false, error: "Keine Berechtigung." };
    }

    const db = await getDatabase();
    const entries = await db.listNotificationOutboxEntries(organizationId, {
      limit: 200,
    });

    return { ok: true, entries };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Laden fehlgeschlagen.",
    };
  }
}
