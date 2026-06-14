"use server";

import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import type { ManagerNotification } from "@schichtwerk/types";

export type ListManagerNotificationsResult =
  | { ok: true; notifications: ManagerNotification[] }
  | { ok: false; error: string };

export type DismissManagerNotificationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function listManagerNotifications(): Promise<ListManagerNotificationsResult> {
  try {
    const { userId, organization } = await requireManager();
    if (!organization.shift_confirmation_enabled) {
      return { ok: true, notifications: [] };
    }

    const db = await getDatabase();
    const notifications = await db.listManagerNotificationsForRecipient(userId, {
      limit: 50,
    });
    return { ok: true, notifications };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Benachrichtigungen konnten nicht geladen werden.",
    };
  }
}

export async function dismissManagerNotification(
  notificationId: string
): Promise<DismissManagerNotificationResult> {
  try {
    const { userId } = await requireManager();
    const db = await getDatabase();
    await db.dismissManagerNotification(notificationId, userId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Benachrichtigung konnte nicht geschlossen werden.",
    };
  }
}
