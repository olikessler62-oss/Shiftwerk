"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ManagerNotification } from "@schichtwerk/types";
import {
  dismissManagerNotification,
  listManagerNotifications,
} from "@/app/actions/manager-notifications";
import { BellIcon, CloseIcon, IconButton } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { headerToolbarCountBadgeClass } from "@/lib/header-toolbar-styles";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";

type Props = {
  enabled: boolean;
  initialNotifications: ManagerNotification[];
  onOpenCommunication: (options?: CommunicationOpenOptions) => void;
  onNavigateToWeek?: (weekStart: string) => void;
  triggerClassName?: string;
};

function notificationPanelTabForType(
  type: string
): "pending" | "rejected" | "proposed" | undefined {
  switch (type) {
    case "employee_pending_escalation":
      return "pending";
    case "employee_response_summary":
      return "rejected";
    default:
      return undefined;
  }
}

function weekStartFromShiftDate(shiftDate: string): string {
  const [y, m, d] = shiftDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

export function AreaCalendarNotificationCenter({
  enabled,
  initialNotifications,
  onOpenCommunication,
  onNavigateToWeek,
  triggerClassName,
}: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const refreshNotifications = useCallback(() => {
    startTransition(async () => {
      const result = await listManagerNotifications();
      if (result.ok) setNotifications(result.notifications);
    });
  }, []);

  useEffect(() => {
    if (open) refreshNotifications();
  }, [open, refreshNotifications]);

  function handleDismiss(notificationId: string, event: React.MouseEvent) {
    event.stopPropagation();
    startTransition(async () => {
      const result = await dismissManagerNotification(notificationId);
      if (!result.ok) return;
      setNotifications((prev) => prev.filter((row) => row.id !== notificationId));
    });
  }

  function handleNotificationClick(notification: ManagerNotification) {
    const shiftDate =
      typeof notification.payload.shift_date === "string"
        ? notification.payload.shift_date
        : undefined;
    if (shiftDate && onNavigateToWeek) {
      onNavigateToWeek(weekStartFromShiftDate(shiftDate));
    }

    const tab = notificationPanelTabForType(notification.type);
    onOpenCommunication(
      tab ? { responseTab: tab } : undefined
    );
    setOpen(false);

    startTransition(async () => {
      await dismissManagerNotification(notification.id);
      setNotifications((prev) => prev.filter((row) => row.id !== notification.id));
    });
  }

  if (!enabled) return null;

  const unreadCount = notifications.length;

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        type="button"
        size="md"
        aria-label={t("shiftConfirmation.notifications.centerTitle")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn("relative", triggerClassName)}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center leading-none",
              headerToolbarCountBadgeClass
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </IconButton>

      {open ? (
        <div
          role="menu"
          aria-label={t("shiftConfirmation.notifications.centerTitle")}
          className="absolute right-0 top-full z-[120] mt-1 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-foreground">
              {t("shiftConfirmation.notifications.centerTitle")}
            </p>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => {
                onOpenCommunication();
                setOpen(false);
              }}
            >
              {t("shiftConfirmation.communication.title")}
            </button>
          </div>

          <div className={cn("max-h-80 overflow-y-auto", MODAL_SCROLLBAR_CLASS)}>
            {pending && notifications.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">{t("common.loading")}</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">
                {t("shiftConfirmation.notifications.empty")}
              </p>
            ) : (
              <ul>
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <div className="flex items-start gap-1 border-b border-border last:border-b-0">
                      <button
                        type="button"
                        role="menuitem"
                        className="min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-subtle"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <p className="text-sm font-medium text-foreground">
                          {notification.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                          {notification.body}
                        </p>
                      </button>
                      <IconButton
                        type="button"
                        size="sm"
                        aria-label={t("shiftConfirmation.notifications.dismiss")}
                        className="mt-1 shrink-0"
                        onClick={(event) => handleDismiss(notification.id, event)}
                        disabled={pending}
                      >
                        <CloseIcon />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
