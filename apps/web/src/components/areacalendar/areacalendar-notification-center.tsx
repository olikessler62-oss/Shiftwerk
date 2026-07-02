"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { ManagerNotification } from "@schichtwerk/types";
import {
  dismissManagerNotification,
  listManagerNotifications,
} from "@/app/actions/manager-notifications";
import { fetchEmployeeCancellationReasonsForShifts } from "@/app/actions/shift-cancellation-reasons";
import { readCancellationReasonShiftContextFromPayload } from "@/lib/cancellation-reason-shift-context";
import type { CancellationReasonShiftContext } from "@/lib/cancellation-reason-shift-context";
import { BellIcon, CloseIcon, IconButton } from "@/components/ui";
import { CancellationReasonViewButton } from "@/components/shift-confirmation/cancellation-reason-view-button";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  readCancellationReasonFromManagerNotification,
  truncateCancellationReasonPreview,
} from "@schichtwerk/database";
import { headerToolbarCountBadgeClass } from "@/lib/header-toolbar-styles";
import { useHeaderToolbarDropdownPosition } from "@/lib/use-header-toolbar-dropdown-position";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";
import type { CommunicationResponseTab } from "@/lib/communication-hub";

type Props = {
  enabled: boolean;
  initialNotifications: ManagerNotification[];
  onOpenCommunication: (options?: CommunicationOpenOptions) => void;
  onNavigateToWeek?: (weekStart: string) => void;
  triggerClassName?: string;
};

function notificationPanelTabForType(
  type: string
): CommunicationResponseTab | undefined {
  switch (type) {
    case "employee_shift_canceled":
      return "canceled";
    case "employee_pending_escalation":
      return "pending";
    case "employee_response_summary":
      return "rejected";
    default:
      return undefined;
  }
}

function notificationOpenOptions(
  notification: ManagerNotification
): CommunicationOpenOptions | undefined {
  if (notification.type === "employee_shift_canceled") {
    const shiftId =
      typeof notification.payload.shift_id === "string"
        ? notification.payload.shift_id
        : undefined;
    return {
      category: "canceled",
      preselectedShiftIds: shiftId ? [shiftId] : undefined,
    };
  }

  const tab = notificationPanelTabForType(notification.type);
  return tab ? { category: tab, responseTab: tab } : undefined;
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
  const [shiftContextsByShiftId, setShiftContextsByShiftId] = useState<
    Record<string, CancellationReasonShiftContext>
  >({});
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const notificationPanelWidth = useCallback(
    () => Math.min(window.innerWidth - 32, 352),
    []
  );
  const dropdownStyle = useHeaderToolbarDropdownPosition(
    open,
    triggerRef,
    { align: "end", resolveWidth: notificationPanelWidth },
    [notifications.length]
  );

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
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
      if (!result.ok) return;

      const canceledShiftIds = result.notifications
        .filter((notification) => notification.type === "employee_shift_canceled")
        .map((notification) => notification.payload.shift_id)
        .filter((shiftId): shiftId is string => typeof shiftId === "string" && Boolean(shiftId));

      if (!canceledShiftIds.length) {
        setShiftContextsByShiftId({});
        setNotifications(result.notifications);
        return;
      }

      const enrichResult = await fetchEmployeeCancellationReasonsForShifts(canceledShiftIds);
      if (!enrichResult.ok) {
        setNotifications(result.notifications);
        return;
      }

      setShiftContextsByShiftId(enrichResult.shiftContexts);
      setNotifications(
        result.notifications.map((notification) => {
          if (notification.type !== "employee_shift_canceled") return notification;

          const shiftId = notification.payload.shift_id;
          if (typeof shiftId !== "string") return notification;

          const shiftContext = enrichResult.shiftContexts[shiftId];
          const reason =
            readCancellationReasonFromManagerNotification({
              payload: notification.payload,
              body: notification.body,
            }) ?? enrichResult.reasons[shiftId];

          const payload = {
            ...notification.payload,
            ...(reason ? { cancellation_reason: reason } : {}),
            ...(shiftContext?.startTime && !notification.payload.start_time
              ? { start_time: shiftContext.startTime }
              : {}),
            ...(shiftContext?.endTime && !notification.payload.end_time
              ? { end_time: shiftContext.endTime }
              : {}),
            ...(shiftContext?.shiftTemplateName &&
            !notification.payload.shift_template_name
              ? { shift_template_name: shiftContext.shiftTemplateName }
              : {}),
          };

          const body =
            reason && !notification.body.includes("\nGrund:")
              ? `${notification.body}\nGrund: ${truncateCancellationReasonPreview(reason)}`
              : notification.body;

          return {
            ...notification,
            body,
            payload,
          };
        })
      );
    });
  }, []);

  useEffect(() => {
    if (open) refreshNotifications();
  }, [open, refreshNotifications]);

  function handleDismiss(notificationId: string, event: React.MouseEvent) {
    event.stopPropagation();
    const closesPanel = notifications.length <= 1;
    startTransition(async () => {
      const result = await dismissManagerNotification(notificationId);
      if (!result.ok) return;
      setNotifications((prev) => prev.filter((row) => row.id !== notificationId));
      if (closesPanel) setOpen(false);
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

    onOpenCommunication(notificationOpenOptions(notification));
    setOpen(false);

    startTransition(async () => {
      await dismissManagerNotification(notification.id);
      setNotifications((prev) => prev.filter((row) => row.id !== notification.id));
    });
  }

  if (!enabled) return null;

  const unreadCount = notifications.length;

  const notificationPanel =
    open && dropdownStyle ? (
      <div
        ref={panelRef}
        role="menu"
        aria-label={t("shiftConfirmation.notifications.centerTitle")}
        style={dropdownStyle}
        className="overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
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
                {notifications.map((notification) => {
                  const cancellationReason = readCancellationReasonFromManagerNotification(
                    {
                      payload: notification.payload,
                      body: notification.body,
                    }
                  );
                  const employeeName =
                    typeof notification.payload.employee_name === "string"
                      ? notification.payload.employee_name
                      : undefined;
                  const shiftId =
                    typeof notification.payload.shift_id === "string"
                      ? notification.payload.shift_id
                      : undefined;
                  const shiftContext = readCancellationReasonShiftContextFromPayload(
                    notification.payload,
                    shiftId ? shiftContextsByShiftId[shiftId] : undefined
                  );

                  return (
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
                        <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted">
                          {notification.body}
                        </p>
                      </button>
                      {cancellationReason ? (
                        <CancellationReasonViewButton
                          reason={cancellationReason}
                          employeeName={employeeName}
                          shiftContext={shiftContext}
                          className="mt-1"
                        />
                      ) : null}
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
                  );
                })}
              </ul>
            )}
          </div>
      </div>
    ) : null;

  return (
    <div ref={triggerRef} className="relative">
      <button
        type="button"
        aria-label={t("shiftConfirmation.notifications.centerTitle")}
        aria-expanded={open}
        aria-haspopup="menu"
        data-open={open ? "true" : undefined}
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
      </button>

      {typeof document !== "undefined" && notificationPanel
        ? createPortal(notificationPanel, document.body)
        : null}
    </div>
  );
}
