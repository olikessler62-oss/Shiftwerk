"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelShiftAsManager,
  confirmPastShiftAsManager,
  submitCommunicationConfirmationRequests,
} from "@/app/actions/shift-confirmations";
import { removeShift } from "@/app/actions/shifts";
import { AreaCalendarShiftDeleteConfirmModal } from "@/components/areacalendar/areacalendar-shift-delete-confirm-modal";
import { ShiftCancelConfirmModal } from "@/components/shifts/shift-cancel-confirm-modal";
import {
  DashboardStaffingRowCandidatesModal,
  type DashboardStaffingCandidatesPlanningContext,
} from "@/components/dashboard/dashboard-staffing-row-candidates-modal";
import { createPortal } from "react-dom";
import { SettingsModalHeader } from "@/components/settings/settings-list-ui";
import {
  MODAL_SCROLLBAR_CLASS,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsNestedModalDialogClass,
} from "@/components/settings/settings-modal-shell";
import { Alert, Button } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { STAFFING_OCHER_TEXT_CLASS } from "@/lib/staffing-ocher-styles";
import {
  buildDashboardAreaAssignmentOverview,
  type DashboardAssignmentOverviewDayGroup,
} from "@/lib/dashboard-area-assignment-overview";
import type {
  DashboardStaffingWindowRow,
  DashboardStaffingWindowRowStatus,
} from "@/lib/dashboard-area-week-stats";
import {
  listShiftsForStaffingWindow,
  type DashboardStaffingWindowIssuesContext,
} from "@/lib/dashboard-staffing-window-issues";
import {
  DASHBOARD_ASSIGNMENT_OVERVIEW_PANEL_CLASS,
  DASHBOARD_MODAL_ROUNDED_CLASS,
  DASHBOARD_PANEL_ROUNDED_CLASS,
} from "@/lib/dashboard-panel-styles";
import { DASHBOARD_UI_BUTTON_CLASS } from "@/lib/dashboard-toolbar-ui";
import { areaCalendarAssignmentPresetsForArea } from "@/lib/areacalendar-assignment-presets";
import { isPastCalendarDate, getISOWeek, parseISODate } from "@/lib/dates";
import type { PlanningShift } from "@/lib/planning-shift-card";
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
import {
  shiftConfirmationStatusLabelKey,
} from "@/lib/shift-confirmation-display";
import {
  useShiftConfirmationSimulation,
  useSimulatedProposedOnAssignRequest,
} from "@/lib/shift-confirmation-simulation-context";
import { getShiftConfirmationSimulationSendBlockedResult } from "@/lib/shift-confirmation-simulation-send-guard";
import { translateActionError } from "@/lib/translate-action-error";
import { useAppShellModalLockActive } from "@/lib/app-shell-modal-lock";
import { formatPlanningLocationAreaLabel } from "@/lib/planning-location-ui";

export type DashboardAreaAssignmentOverviewContext =
  DashboardStaffingCandidatesPlanningContext & {
    shiftConfirmationEnabled: boolean;
    todayISO: string;
  };

type Props = {
  rows: readonly DashboardStaffingWindowRow[];
  context: DashboardAreaAssignmentOverviewContext;
  scopeLabel: string;
  showDayHeaders: boolean;
  locationName?: string | null;
  locationCount?: number;
  onClose: () => void;
};

type PendingConfirm =
  | { kind: "delete"; shift: PlanningShift }
  | { kind: "cancel"; shift: PlanningShift }
  | null;

function isShiftActionDisabled(
  action: ShiftCardContextMenuAction,
  shift: PlanningShift,
  context: DashboardAreaAssignmentOverviewContext,
  pending: boolean
): boolean {
  if (pending || context.readOnlyWeek) return true;

  const menuOptions = {
    shiftDate: shift.shift_date,
    isPastShiftDate: (shiftDate: string) =>
      isPastCalendarDate(shiftDate, context.todayISO),
    displayState: shift.displayState,
  };

  switch (action) {
    case "delete":
      return !canDeleteShift({
        shiftDate: shift.shift_date,
        confirmationStatus: shift.confirmationStatus,
        requestedAt: shift.requestedAt,
        isPastShiftDate: menuOptions.isPastShiftDate,
      });
    case "cancel":
      return !canCancelShift({
        shiftDate: shift.shift_date,
        confirmationStatus: shift.confirmationStatus,
        requestedAt: shift.requestedAt,
        isPastShiftDate: menuOptions.isPastShiftDate,
      });
    case "requestConfirmation":
    case "setConfirmed":
    case "reassign":
      return false;
  }
}

function assignmentOverviewWindowStatusLabelKey(
  status: DashboardStaffingWindowRowStatus
): string {
  switch (status) {
    case "understaffed":
      return "dashboard.areaAssignmentOverviewWindowStatusUnderstaffed";
    case "planned":
      return "dashboard.areaAssignmentOverviewWindowStatusPlanned";
    case "overstaffed":
      return "dashboard.areaAssignmentOverviewWindowStatusOverstaffed";
    case "met":
      return "dashboard.areaAssignmentOverviewWindowStatusMet";
  }
}

function assignmentOverviewStaffingCountsClassName(
  assigned: number,
  required: number,
  status: DashboardStaffingWindowRowStatus,
  hasConflict?: boolean
): string {
  if (hasConflict && assigned >= required) return STAFFING_OCHER_TEXT_CLASS;
  if (assigned < required) return "text-red-600";
  if (assigned > required) return "text-blue-600";
  if (status === "met") return "text-emerald-700";
  if (status === "planned" || status === "overstaffed") return STAFFING_OCHER_TEXT_CLASS;
  return "text-foreground/90";
}

function assignmentOverviewWindowStatusClassName(
  status: DashboardStaffingWindowRowStatus
): string {
  switch (status) {
    case "understaffed":
      return "text-red-600";
    case "planned":
    case "overstaffed":
      return STAFFING_OCHER_TEXT_CLASS;
    case "met":
      return "text-emerald-700";
  }
}

function ShiftRowActions({
  actions,
  shift,
  context,
  pending,
  pendingAction,
  onAction,
}: {
  actions: readonly ShiftCardContextMenuAction[];
  shift: PlanningShift;
  context: DashboardAreaAssignmentOverviewContext;
  pending: boolean;
  pendingAction: string | null;
  onAction: (action: ShiftCardContextMenuAction, shift: PlanningShift) => void;
}) {
  const t = useTranslations();
  if (actions.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      {actions.map((action) => (
        <Button
          key={action}
          type="button"
          variant="outline"
          size="sm"
          className="h-7 whitespace-nowrap px-2 text-xs"
          disabled={
            isShiftActionDisabled(action, shift, context, pending) ||
            pendingAction === `${shift.id}:${action}`
          }
          onClick={() => onAction(action, shift)}
        >
          {t(shiftCardContextMenuActionLabelKey(action))}
        </Button>
      ))}
    </div>
  );
}

const overviewWindowBodyIndentClass = "pl-8 pr-3";
const overviewWindowBodyRowClass = cn("flex gap-3 py-2", overviewWindowBodyIndentClass);

function OverviewWindowSection({
  section,
  context,
  pending,
  pendingAction,
  onAction,
  onAssignRow,
  showDayLabelInHeader,
}: {
  section: DashboardAssignmentOverviewDayGroup["windows"][number];
  context: DashboardAreaAssignmentOverviewContext;
  pending: boolean;
  pendingAction: string | null;
  onAction: (action: ShiftCardContextMenuAction, shift: PlanningShift) => void;
  onAssignRow: (row: DashboardStaffingWindowRow) => void;
  showDayLabelInHeader: boolean;
}) {
  const t = useTranslations();
  const { row, shifts, openSlots } = section;
  const isNoService = row.rowKind === "no_service_hours";
  const shiftName = !isNoService && row.shiftName?.trim() ? row.shiftName.trim() : null;
  const timeRange =
    !isNoService && row.timeFrom && row.timeTo
      ? `${row.timeFrom}–${row.timeTo}`
      : null;
  const headerLine = [
    showDayLabelInHeader ? row.weekdayLabel : null,
    isNoService ? t("areaCalendar.noServiceHours") : shiftName,
    !isNoService ? timeRange : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const headerSeparator = (
    <span className="font-normal text-foreground/50"> · </span>
  );

  return (
    <section
      className={cn(
        "overflow-hidden border border-border/70 bg-background/30",
        DASHBOARD_PANEL_ROUNDED_CLASS
      )}
    >
      <header className="border-b border-border/60 bg-[#c7d4e5]/60 px-3 py-1.5">
        <div className="flex items-start justify-between gap-3">
          <p
            className="min-w-0 flex-1 text-sm leading-snug text-foreground"
            title={headerLine}
          >
            {showDayLabelInHeader ? (
              <>
                <span className="font-semibold">{row.weekdayLabel}</span>
                {isNoService || shiftName || timeRange ? headerSeparator : null}
              </>
            ) : null}
            {isNoService ? (
              <span className="font-semibold">{t("areaCalendar.noServiceHours")}</span>
            ) : (
              <>
                {shiftName ? (
                  <>
                    <span className="font-semibold">{shiftName}</span>
                    {timeRange ? (
                      <>
                        {headerSeparator}
                        <span className="font-normal">{timeRange}</span>
                      </>
                    ) : null}
                  </>
                ) : timeRange ? (
                  <span className="font-semibold">{timeRange}</span>
                ) : null}
              </>
            )}
          </p>
          {!isNoService && row.required > 0 ? (
            <p className="shrink-0 text-right text-sm font-normal leading-snug text-foreground/90">
              <span
                className={cn(
                  "tabular-nums",
                  assignmentOverviewStaffingCountsClassName(
                    row.assigned,
                    row.required,
                    row.status,
                    row.hasConflict
                  )
                )}
              >
                {t("dashboard.areaAssignmentOverviewStaffingCounts", {
                  assigned: row.assigned,
                  required: row.required,
                })}
              </span>
              <span className="text-foreground/50"> · </span>
              <span>
                {t("dashboard.areaAssignmentOverviewStatusLabel")}:{" "}
                <span
                  className={assignmentOverviewWindowStatusClassName(row.status)}
                >
                  {t(assignmentOverviewWindowStatusLabelKey(row.status))}
                </span>
              </span>
            </p>
          ) : null}
        </div>
      </header>

      <div className="space-y-0 divide-y divide-border/50">
        {shifts.map(({ shift, employeeName, qualificationName, confirmationStatus, actions }) => (
          <div
            key={shift.id}
            className={cn(overviewWindowBodyRowClass, "items-start")}
          >
            <div className="min-w-0 flex-1 text-sm leading-snug">
              <p className="font-medium text-foreground">{employeeName}</p>
              <p className="text-muted">
                {[qualificationName, shift.shiftName].filter(Boolean).join(" · ")}
                {confirmationStatus ? (
                  <>
                    {qualificationName || shift.shiftName ? (
                      <span className="text-foreground/50"> · </span>
                    ) : null}
                    <span className="text-foreground/70">
                      {t("dashboard.areaAssignmentOverviewStatusLabel")}:{" "}
                      {t(shiftConfirmationStatusLabelKey(confirmationStatus))}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <ShiftRowActions
              actions={actions}
              shift={shift}
              context={context}
              pending={pending}
              pendingAction={pendingAction}
              onAction={onAction}
            />
          </div>
        ))}

        {openSlots.map((slot) => (
          <div
            key={`${row.dateISO}:${row.serviceHourId}:${slot.qualificationId ?? "headcount"}`}
            className={cn(overviewWindowBodyRowClass, "items-center")}
          >
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-red-700">
                {t("dashboard.areaAssignmentOverviewOpenSlot", {
                  qualification: slot.qualificationName,
                  count: slot.missingCount,
                })}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              disabled={
                context.readOnlyWeek ||
                isPastCalendarDate(row.dateISO, context.todayISO)
              }
              onClick={() => onAssignRow(row)}
            >
              {t("dashboard.areaAssignmentOverviewAssign")}
            </Button>
          </div>
        ))}

        {isNoService && shifts.length === 0 && openSlots.length === 0 ? (
          <p className={cn("py-2 text-sm text-muted", overviewWindowBodyIndentClass)}>
            {t("areaCalendar.noServiceHours")}
          </p>
        ) : null}

        {!isNoService && shifts.length === 0 && openSlots.length === 0 ? (
          <p className={cn("py-2 text-sm text-muted", overviewWindowBodyIndentClass)}>
            {t("dashboard.areaAssignmentOverviewEmptyWindow")}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function DashboardAreaAssignmentOverviewModal({
  rows,
  context,
  scopeLabel,
  showDayHeaders,
  locationName = null,
  locationCount = 0,
  onClose,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [candidatesRow, setCandidatesRow] =
    useState<DashboardStaffingWindowRow | null>(null);
  const [reassignShiftId, setReassignShiftId] = useState<string | null>(null);
  const { blocksOutboundSend } = useShiftConfirmationSimulation();
  const { simulatedProposedOnAssign, relaxAppRegistrationGate } =
    useSimulatedProposedOnAssignRequest();

  useAppShellModalLockActive(true);

  const nestedDialogOpen = pendingConfirm !== null || candidatesRow !== null;

  useEffect(() => {
    if (pending || nestedDialogOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nestedDialogOpen, onClose, pending]);

  const openCandidatesForRow = useCallback((row: DashboardStaffingWindowRow) => {
    setCandidatesRow(row);
    setReassignShiftId(null);
  }, []);

  const closeCandidatesModal = useCallback(() => {
    setCandidatesRow(null);
    setReassignShiftId(null);
  }, []);

  const handleAssignSuccess = useCallback(async () => {
    await router.refresh();
  }, [router]);

  const windowIssuesContext = useMemo(
    (): DashboardStaffingWindowIssuesContext => ({
      areaId: context.areaId,
      areaName: context.areaName,
      areaCalendarHref: context.areaCalendarHref,
      weekStart: context.weekStart,
      locationId: context.locationId,
      calendarShifts: context.calendarShifts,
      serviceHours: context.serviceHours,
      employeeNameById: context.employeeNameById ?? new Map(),
      shiftConfirmationEnabled: context.shiftConfirmationEnabled,
      readOnlyWeek: context.readOnlyWeek,
      todayISO: context.todayISO,
    }),
    [context]
  );

  const assignmentPresets = useMemo(
    () =>
      areaCalendarAssignmentPresetsForArea(
        context.areaShiftTemplates.filter(
          (template) => template.location_area_id === context.areaId
        )
      ),
    [context.areaId, context.areaShiftTemplates]
  );

  const dayGroups = useMemo(
    () =>
      buildDashboardAreaAssignmentOverview({
        rows,
        context: windowIssuesContext,
        showDayHeaders,
        formatCalendarTimeLabel: context.formatCalendarTimeLabel,
        headcountSectionLabel: t("dashboard.staffingCandidatesHeadcountSection"),
        slotInputBase: {
          areaId: context.areaId,
          simplePlanning: context.simplePlanning,
          shifts: context.calendarShifts,
          staffingRules: context.staffingRules,
          staffingOverrides: context.staffingOverrides,
          serviceHours: context.serviceHours,
          assignmentPresets,
          qualifications: context.qualifications,
          profileQualificationIds: context.profileQualificationIds,
          employeeNameById: context.employeeNameById,
          formatTimeLabel: context.formatTimeLabel,
          weekdayLabel: context.weekdayLabel,
          formatCalendarTimeLabel: context.formatCalendarTimeLabel,
        },
      }),
    [
      assignmentPresets,
      context,
      rows,
      showDayHeaders,
      t,
      windowIssuesContext,
    ]
  );

  const calendarWeek = useMemo(
    () => getISOWeek(parseISODate(context.weekStart)),
    [context.weekStart]
  );

  const panelSubtitle = useMemo(() => {
    const areaDisplayName = formatPlanningLocationAreaLabel(
      locationName ?? "",
      context.areaName,
      locationCount
    );

    return (
      <p className="mt-0.5 min-w-0 break-words text-xs font-normal leading-tight text-foreground sm:text-sm">
        <span className="text-sm font-bold sm:text-base md:text-lg">
          {areaDisplayName}
        </span>
        {scopeLabel ? <span>{` ${scopeLabel}`}</span> : null}
        <span className="tabular-nums">{` KW ${calendarWeek}`}</span>
      </p>
    );
  }, [calendarWeek, context.areaName, locationCount, locationName, scopeLabel]);

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
      });
    },
    [router, t]
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
        } catch {
          setPendingAction(null);
          setErrorMessage(t("shiftConfirmation.cancel.failed"));
        }
      });
    },
    [router, t]
  );

  const handleAction = useCallback(
    (action: ShiftCardContextMenuAction, shift: PlanningShift) => {
      setErrorMessage(null);

      switch (action) {
        case "delete":
          setPendingConfirm({ kind: "delete", shift });
          return;
        case "cancel":
          setPendingConfirm({ kind: "cancel", shift });
          return;
        case "reassign": {
          const row = rows.find((item) =>
            listShiftsForStaffingWindow(item, windowIssuesContext).some(
              (listedShift) => listedShift.id === shift.id
            )
          );
          if (row) {
            setCandidatesRow(row);
            setReassignShiftId(shift.id);
          }
          return;
        }
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
          });
          return;
      }
    },
    [
      blocksOutboundSend,
      context.locationId,
      context.weekStart,
      relaxAppRegistrationGate,
      router,
      rows,
      simulatedProposedOnAssign,
      t,
      windowIssuesContext,
    ]
  );

  return (
    <>
      {typeof document !== "undefined"
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-[110] flex items-center justify-center bg-black/30 p-2 sm:p-4",
                "md:left-[var(--app-shell-sidebar-width)]"
              )}
              role="presentation"
              onMouseDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !pending &&
                  !nestedDialogOpen
                ) {
                  onClose();
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dashboard-area-assignment-overview-title"
                className={cn(
                  settingsNestedModalDialogClass(
                    "2xl",
                    DASHBOARD_MODAL_ROUNDED_CLASS
                  ),
                  DASHBOARD_ASSIGNMENT_OVERVIEW_PANEL_CLASS,
                  "!max-h-[80%] max-sm:!max-h-[80%] max-sm:!h-auto",
                  "modal-scrollbar-inline"
                )}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <SettingsModalHeader
                  titleId="dashboard-area-assignment-overview-title"
                  title={t("dashboard.areaAssignmentOverviewTitle")}
                  subtitle={panelSubtitle}
                  onClose={onClose}
                  closeDisabled={pending}
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

                  {dayGroups.length === 0 ? (
                    <p className="text-sm text-muted">
                      {t("dashboard.areaAssignmentOverviewEmpty")}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {dayGroups.map((dayGroup) => (
                        <div key={dayGroup.dateISO} className="space-y-2">
                          {dayGroup.windows.map((section) => (
                            <OverviewWindowSection
                              key={`${section.row.dateISO}:${section.row.serviceHourId}`}
                              section={section}
                              context={context}
                              pending={pending}
                              pendingAction={pendingAction}
                              onAction={handleAction}
                              onAssignRow={openCandidatesForRow}
                              showDayLabelInHeader={showDayHeaders}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
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
                    {t("common.close")}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {pendingConfirm?.kind === "delete" && typeof document !== "undefined"
        ? createPortal(
          <AreaCalendarShiftDeleteConfirmModal
            placement="fixed"
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
            placement="fixed"
            variant="manager"
            employeeName={
              context.employeeNameById?.get(pendingConfirm.shift.employee_id) ?? "—"
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

      {candidatesRow && typeof document !== "undefined"
        ? createPortal(
          <DashboardStaffingRowCandidatesModal
            row={candidatesRow}
            planning={context}
            existingShiftId={reassignShiftId}
            onAssigned={handleAssignSuccess}
            onClose={closeCandidatesModal}
          />,
          document.body
        )
        : null}
    </>
  );
}
