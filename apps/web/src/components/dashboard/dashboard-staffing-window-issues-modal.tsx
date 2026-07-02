"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  cancelShiftAsManager,
  confirmPastShiftAsManager,
  submitCommunicationConfirmationRequests,
} from "@/app/actions/shift-confirmations";
import { removeShift } from "@/app/actions/shifts";
import { AreaCalendarShiftDeleteConfirmModal } from "@/components/areacalendar/areacalendar-shift-delete-confirm-modal";
import { ShiftCancelConfirmModal } from "@/components/shifts/shift-cancel-confirm-modal";
import { Alert, Button, CloseIcon } from "@/components/ui";
import {
  MODAL_SCROLLBAR_CLASS,
  settingsFixedNestedOverlayClass,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsNestedModalDialogClass,
} from "@/components/settings/settings-modal-shell";
import { SettingsModalHeader } from "@/components/settings/settings-list-ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  formatDashboardStaffingIssueInlineDescription,
  dashboardStaffingIssueKindDotClass,
  type DashboardStaffingWindowRow,
} from "@/lib/dashboard-area-week-stats";
import {
  buildStaffingWindowIssueListItems,
  filterStaffingWindowIssueListItemsByConfirmationStatus,
  type DashboardStaffingWindowIssueListItem,
  type DashboardStaffingWindowIssuesContext,
} from "@/lib/dashboard-staffing-window-issues";
import {
  DASHBOARD_MODAL_ROUNDED_CLASS,
  DASHBOARD_PANEL_ROUNDED_CLASS,
} from "@/lib/dashboard-panel-styles";
import { DASHBOARD_UI_BUTTON_CLASS } from "@/lib/dashboard-toolbar-ui";
import { isPlanningReadOnlyWeek } from "@/lib/planning-readonly";
import {
  createPlanningPastShiftChecker,
  planningMomentFromShift,
  type PlanningPastShiftChecker,
} from "@/lib/planning-past-shift-time";
import { Tooltip } from "@/components/ui/tooltip";
import {
  shiftCardContextMenuActionLabelKey,
  type ShiftCardContextMenuAction,
} from "@/lib/shift-card-context-menu-actions";
import {
  canCancelShift,
  translatePastConfirmError,
  translateShiftCancelError,
} from "@/lib/shift-cancellation-policy";
import { canDeleteShift } from "@/lib/shift-deletion-policy";
import { shiftConfirmationStatusLabelKey } from "@/lib/shift-confirmation-display";
import {
  useShiftConfirmationSimulation,
  useSimulatedProposedOnAssignRequest,
} from "@/lib/shift-confirmation-simulation-context";
import { getShiftConfirmationSimulationSendBlockedResult } from "@/lib/shift-confirmation-simulation-send-guard";
import { translateActionError } from "@/lib/translate-action-error";
import { useAppShellModalLockActive } from "@/lib/app-shell-modal-lock";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

type Props = {
  row: DashboardStaffingWindowRow;
  context: DashboardStaffingWindowIssuesContext;
  confirmationStatusFilter?: ShiftConfirmationStatus | null;
  /** Öffnet das Personalvorschlags-Modal für diese Zeile (statt Bereich-Kalender). */
  onOpenCandidates?: (row: DashboardStaffingWindowRow) => void;
  onClose: () => void;
  allowPastDayChange?: boolean;
};

type PendingConfirm =
  | { kind: "delete"; shift: PlanningShift }
  | { kind: "cancel"; shift: PlanningShift }
  | null;

const EMPLOYEE_COLOR_FALLBACK = "#94a3b8";

function resolveEmployeeDotColor(
  context: DashboardStaffingWindowIssuesContext,
  shift: PlanningShift
): string {
  const profileColor = context.employeeColorById?.get(shift.employee_id);
  if (profileColor?.trim()) return profileColor.trim();
  return shift.color?.trim() || EMPLOYEE_COLOR_FALLBACK;
}

function isShiftActionDisabled(
  action: ShiftCardContextMenuAction,
  shift: PlanningShift,
  context: DashboardStaffingWindowIssuesContext,
  planningPastShiftChecker: PlanningPastShiftChecker,
  pending: boolean,
  allowPastDayChange: boolean
): boolean {
  if (pending) return true;
  if (
    isPlanningReadOnlyWeek(context.readOnlyWeek, context.allowPastShiftChanges) &&
    !allowPastDayChange
  ) {
    return true;
  }

  const menuOptions = {
    shiftDate: shift.shift_date,
    shiftStartTime: shift.startTime,
    isPastShiftDate: (shiftDate: string, startTime?: string | null) => {
      if (allowPastDayChange && context.allowPastShiftChanges) return false;
      return planningPastShiftChecker.isBlockedForPlanning({
        shiftDateISO: shiftDate,
        startTime: startTime ?? shift.startTime,
      });
    },
    displayState: shift.displayState,
  };

  switch (action) {
    case "delete":
      return !canDeleteShift({
        shiftDate: shift.shift_date,
        shiftStartTime: shift.startTime,
        confirmationStatus: shift.confirmationStatus,
        requestedAt: shift.requestedAt,
        isPastShiftDate: menuOptions.isPastShiftDate,
        pendingAfterMinutes: context.pendingAfterMinutes,
      });
    case "cancel":
      return !canCancelShift({
        shiftDate: shift.shift_date,
        shiftStartTime: shift.startTime,
        confirmationStatus: shift.confirmationStatus,
        requestedAt: shift.requestedAt,
        isPastShiftDate: menuOptions.isPastShiftDate,
      });
    case "requestConfirmation":
    case "setConfirmed":
    case "reassign":
      if (allowPastDayChange && context.allowPastShiftChanges) return false;
      return planningPastShiftChecker.isBlockedForPlanning(
        planningMomentFromShift(shift)
      );
  }
}

function PastBlockedActionButton({
  disabled,
  pastMomentBlocked,
  pastMomentBlockedTooltip,
  className,
  onClick,
  children,
}: {
  disabled: boolean;
  pastMomentBlocked: boolean;
  pastMomentBlockedTooltip: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );

  if (!pastMomentBlocked) return button;

  return (
    <Tooltip content={pastMomentBlockedTooltip}>
      <span className="inline-flex">{button}</span>
    </Tooltip>
  );
}

function IssueRowActions({
  actions,
  shift,
  context,
  planningPastShiftChecker,
  pending,
  pendingAction,
  onAction,
  allowPastDayChange,
}: {
  actions: readonly ShiftCardContextMenuAction[];
  shift: PlanningShift;
  context: DashboardStaffingWindowIssuesContext;
  planningPastShiftChecker: PlanningPastShiftChecker;
  pending: boolean;
  pendingAction: string | null;
  onAction: (action: ShiftCardContextMenuAction, shift: PlanningShift) => void;
  allowPastDayChange: boolean;
}) {
  const t = useTranslations();

  if (actions.length === 0) return null;

  const pastMomentBlocked =
    !allowPastDayChange &&
    planningPastShiftChecker.isBlockedForPlanning(planningMomentFromShift(shift));
  const pastMomentBlockedTooltip = t("dashboard.pastDayPlanningChangeBlocked");

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      {actions.map((action) => {
        const disabled =
          isShiftActionDisabled(
            action,
            shift,
            context,
            planningPastShiftChecker,
            pending,
            allowPastDayChange
          ) || pendingAction === `${shift.id}:${action}`;

        return (
          <PastBlockedActionButton
            key={action}
            disabled={disabled}
            pastMomentBlocked={pastMomentBlocked}
            pastMomentBlockedTooltip={pastMomentBlockedTooltip}
            className="h-7 whitespace-nowrap px-2 text-xs"
            onClick={() => onAction(action, shift)}
          >
            {t(shiftCardContextMenuActionLabelKey(action))}
          </PastBlockedActionButton>
        );
      })}
    </div>
  );
}

function StaffingIssueRow({
  issue,
}: {
  issue: DashboardStaffingWindowIssueListItem & { kind: "staffing" };
}) {
  const t = useTranslations();

  return (
    <li
      className={cn(
        "flex items-start gap-2.5 border border-border/70 bg-background/40 px-3 py-2.5",
        DASHBOARD_PANEL_ROUNDED_CLASS
      )}
    >
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          dashboardStaffingIssueKindDotClass(issue.issue.kind)
        )}
        aria-hidden
      />
      <p className="min-w-0 text-sm leading-snug text-foreground">
        {formatDashboardStaffingIssueInlineDescription(issue.issue, (key, params) =>
          t(key, params)
        )}
      </p>
    </li>
  );
}

function ConfirmationIssueRow({
  item,
  context,
  planningPastShiftChecker,
  pending,
  pendingAction,
  onAction,
  allowPastDayChange,
}: {
  item: DashboardStaffingWindowIssueListItem & { kind: "confirmation" };
  context: DashboardStaffingWindowIssuesContext;
  planningPastShiftChecker: PlanningPastShiftChecker;
  pending: boolean;
  pendingAction: string | null;
  onAction: (action: ShiftCardContextMenuAction, shift: PlanningShift) => void;
  allowPastDayChange: boolean;
}) {
  const t = useTranslations();

  return (
    <li
      className={cn(
        "flex items-start gap-3 border border-border/70 bg-background/40 px-3 py-2.5",
        DASHBOARD_PANEL_ROUNDED_CLASS
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: resolveEmployeeDotColor(context, item.shift) }}
          aria-hidden
        />
        <div className="min-w-0 text-sm leading-snug text-foreground">
          <p className="truncate font-medium">{item.employeeName}</p>
          <p className="text-muted">
            {t(shiftConfirmationStatusLabelKey(item.status))}
          </p>
        </div>
      </div>
      <IssueRowActions
        actions={item.actions}
        shift={item.shift}
        context={context}
        planningPastShiftChecker={planningPastShiftChecker}
        pending={pending}
        pendingAction={pendingAction}
        onAction={onAction}
        allowPastDayChange={allowPastDayChange}
      />
    </li>
  );
}

export function DashboardStaffingWindowIssuesModal({
  row,
  context,
  confirmationStatusFilter = null,
  onOpenCandidates,
  onClose,
  allowPastDayChange = false,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const { blocksOutboundSend } = useShiftConfirmationSimulation();
  const { simulatedProposedOnAssign, relaxAppRegistrationGate } =
    useSimulatedProposedOnAssignRequest();

  useAppShellModalLockActive(true);

  const planningPastShiftChecker = useMemo(
    () =>
      createPlanningPastShiftChecker(
        context.allowPastShiftChanges,
        context.timeZone
      ),
    [context.allowPastShiftChanges, context.timeZone]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending && !pendingConfirm) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending, pendingConfirm]);

  const items = useMemo(
    () =>
      filterStaffingWindowIssueListItemsByConfirmationStatus(
        buildStaffingWindowIssueListItems(row, context),
        confirmationStatusFilter
      ),
    [confirmationStatusFilter, context, row]
  );

  const subtitle = `${context.areaName} · ${row.weekdayLabel}, ${row.timeFrom}–${row.timeTo} · ${row.shiftName}`;

  const runDelete = useCallback(
    (shift: PlanningShift) => {
      setErrorMessage(null);
      setPendingAction(`delete:${shift.id}`);
      startTransition(async () => {
        const result = await removeShift(shift.id);
        setPendingAction(null);
        if (!result.ok) {
          setErrorMessage(translateActionError(result.error, t));
          return;
        }
        router.refresh();
        onClose();
      });
    },
    [onClose, router, t]
  );

  const runCancel = useCallback(
    (shift: PlanningShift) => {
      setErrorMessage(null);
      setPendingAction(`cancel:${shift.id}`);
      startTransition(async () => {
        try {
          const result = await cancelShiftAsManager(shift.id);
          setPendingAction(null);
          if (!result.ok) {
            setErrorMessage(translateShiftCancelError(result.error, t));
            return;
          }
          router.refresh();
          onClose();
        } catch {
          setPendingAction(null);
          setErrorMessage(t("shiftConfirmation.cancel.failed"));
        }
      });
    },
    [onClose, router, t]
  );

  const handleAction = useCallback(
    (action: ShiftCardContextMenuAction, shift: PlanningShift) => {
      setErrorMessage(null);
      setSuccessMessage(null);

      switch (action) {
        case "delete":
          setPendingConfirm({ kind: "delete", shift });
          return;
        case "cancel":
          setPendingConfirm({ kind: "cancel", shift });
          return;
        case "reassign":
          if (onOpenCandidates) {
            onOpenCandidates(row);
          } else {
            router.push(context.areaCalendarHref);
          }
          onClose();
          return;
        case "requestConfirmation":
          setPendingAction(`requestConfirmation:${shift.id}`);
          startTransition(async () => {
            if (blocksOutboundSend && !simulatedProposedOnAssign) {
              setPendingAction(null);
              setErrorMessage(
                getShiftConfirmationSimulationSendBlockedResult().error
              );
              return;
            }
            const result = await submitCommunicationConfirmationRequests({
              shiftIds: [shift.id],
              weekStart: context.weekStart,
              locationId: context.locationId,
              simulatedProposedOnAssign,
              relaxAppRegistrationGate,
            });
            setPendingAction(null);
            if (!result.ok) {
              setErrorMessage(translateActionError(result.error, t));
              return;
            }
            if (result.sentCount === 0) {
              setErrorMessage(
                result.errors[0]
                  ? translateActionError(result.errors[0], t)
                  : t("shiftConfirmation.send.failed")
              );
              return;
            }
            router.refresh();
            if (result.failedCount > 0) {
              setSuccessMessage(
                t("shiftConfirmation.communication.partialResend", {
                  sent: result.sentCount,
                  failed: result.failedCount,
                })
              );
              return;
            }
            setSuccessMessage(
              t("shiftConfirmation.communication.resendSuccess", {
                count: result.sentCount,
              })
            );
          });
          return;
        case "setConfirmed":
          setPendingAction(`setConfirmed:${shift.id}`);
          startTransition(async () => {
            const result = await confirmPastShiftAsManager(shift.id);
            setPendingAction(null);
            if (!result.ok) {
              setErrorMessage(translatePastConfirmError(result.error, t));
              return;
            }
            router.refresh();
            onClose();
          });
          return;
      }
    },
    [
      blocksOutboundSend,
      context.areaCalendarHref,
      context.locationId,
      context.weekStart,
      onClose,
      onOpenCandidates,
      relaxAppRegistrationGate,
      router,
      row,
      simulatedProposedOnAssign,
      t,
    ]
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <div
        className={settingsFixedNestedOverlayClass()}
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pending && !pendingConfirm) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-staffing-window-issues-title"
          className={cn(
            settingsNestedModalDialogClass("2xl", DASHBOARD_MODAL_ROUNDED_CLASS),
            "modal-scrollbar-inline"
          )}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <SettingsModalHeader
            titleId="dashboard-staffing-window-issues-title"
            title={t("dashboard.staffingWindowIssuesTitle")}
            subtitle={
              <p className="mt-1 text-sm text-foreground">{subtitle}</p>
            }
            onClose={onClose}
            closeAriaLabel={t("common.close")}
          />

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              MODAL_SCROLLBAR_CLASS,
              "modal-scrollbar-inline",
              settingsModalBodyPaddingClass()
            )}
          >
            {errorMessage ? (
              <Alert variant="error" className="mb-3">
                {errorMessage}
              </Alert>
            ) : null}

            {successMessage ? (
              <Alert variant="success" className="mb-3">
                {successMessage}
              </Alert>
            ) : null}

            {items.length === 0 ? (
              <p className="text-sm text-muted">
                {t("dashboard.staffingWindowIssuesEmpty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) =>
                  item.kind === "staffing" ? (
                    <StaffingIssueRow key={item.id} issue={item} />
                  ) : (
                    <ConfirmationIssueRow
                      key={item.id}
                      item={item}
                      context={context}
                      planningPastShiftChecker={planningPastShiftChecker}
                      pending={pending}
                      pendingAction={pendingAction}
                      onAction={handleAction}
                      allowPastDayChange={allowPastDayChange}
                    />
                  )
                )}
              </ul>
            )}
          </div>

          <div className={settingsModalFooterClass()}>
            <Button
              type="button"
              variant="outline"
              className={DASHBOARD_UI_BUTTON_CLASS}
              onClick={onClose}
              disabled={pending}
            >
              <CloseIcon />
              {t("common.close")}
            </Button>
          </div>
        </div>
      </div>

      {pendingConfirm?.kind === "delete" && typeof document !== "undefined"
        ? createPortal(
            <AreaCalendarShiftDeleteConfirmModal
              placement="stacked"
              pending={pending}
              onConfirm={() => {
                const shift = pendingConfirm.shift;
                setPendingConfirm(null);
                runDelete(shift);
              }}
              onCancel={() => setPendingConfirm(null)}
            />,
            document.body
          )
        : null}

      {pendingConfirm?.kind === "cancel" && typeof document !== "undefined"
        ? createPortal(
            <ShiftCancelConfirmModal
              placement="stacked"
              variant="manager"
              pending={pending}
              employeeName={
                context.employeeNameById.get(pendingConfirm.shift.employee_id) ?? "—"
              }
              onConfirm={() => {
                const shift = pendingConfirm.shift;
                setPendingConfirm(null);
                runCancel(shift);
              }}
              onCancel={() => setPendingConfirm(null)}
            />,
            document.body
          )
        : null}
    </>,
    document.body
  );
}
