import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";
import { NotificationOutboxView } from "@/components/settings/notification-outbox-view";

export default async function NotificationOutboxPage() {
  const { organizationId, profile } = await requireManager();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const db = await getDatabase();
  const entries = await db.listNotificationOutboxEntries(organizationId, {
    limit: 200,
  });

  return <NotificationOutboxView entries={entries} />;
}
