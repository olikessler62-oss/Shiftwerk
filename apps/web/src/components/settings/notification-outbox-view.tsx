"use client";

import type { NotificationOutboxEntry } from "@schichtwerk/types";
import { useTranslations } from "@/i18n/locale-provider";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { cn } from "@/lib/cn";

type OutboxRow = NotificationOutboxEntry & {
  recipient_full_name: string;
};

type Props = {
  entries: OutboxRow[];
};

function formatTimestamp(value: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatPayload(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload, null, 0);
  } catch {
    return String(payload);
  }
}

export function NotificationOutboxView({ entries }: Props) {
  const t = useTranslations();

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 py-6 md:px-6">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("shiftConfirmation.outbox.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("shiftConfirmation.outbox.hint")}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface">
        <div className={cn("h-full overflow-auto", MODAL_SCROLLBAR_CLASS)}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface">
              <tr>
                <th className="px-3 py-2 font-medium text-muted">
                  {t("shiftConfirmation.outbox.columns.createdAt")}
                </th>
                <th className="px-3 py-2 font-medium text-muted">
                  {t("shiftConfirmation.outbox.columns.recipient")}
                </th>
                <th className="px-3 py-2 font-medium text-muted">
                  {t("shiftConfirmation.outbox.columns.channel")}
                </th>
                <th className="px-3 py-2 font-medium text-muted">
                  {t("shiftConfirmation.outbox.columns.template")}
                </th>
                <th className="px-3 py-2 font-medium text-muted">
                  {t("shiftConfirmation.outbox.columns.payload")}
                </th>
                <th className="px-3 py-2 font-medium text-muted">
                  {t("shiftConfirmation.outbox.columns.simulated")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted">
                    {t("shiftConfirmation.outbox.empty")}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/70 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">
                      {formatTimestamp(entry.created_at)}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {entry.recipient_full_name || entry.recipient_profile_id}
                    </td>
                    <td className="px-3 py-2 uppercase text-foreground">{entry.channel}</td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground">
                      {entry.template_key}
                    </td>
                    <td className="max-w-md px-3 py-2 font-mono text-xs text-muted">
                      <span className="line-clamp-3 break-all">
                        {formatPayload(entry.payload)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {entry.simulated ? t("common.yes") : t("common.no")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
