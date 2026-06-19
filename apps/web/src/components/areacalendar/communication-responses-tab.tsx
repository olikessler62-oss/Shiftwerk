"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import {
  cancelShiftsAsManager,
  submitCommunicationConfirmationRequests,
} from "@/app/actions/shift-confirmations";
import { removeShiftsAsManager } from "@/app/actions/shifts";
import { AreaCalendarShiftDeleteConfirmModal } from "@/components/areacalendar/areacalendar-shift-delete-confirm-modal";
import { CommunicationCategoryTabs } from "@/components/areacalendar/communication-category-tabs";
import { Alert, Button } from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { formatDayHeader } from "@/lib/planning-utils";
import {
  COMMUNICATION_LIST_ROW_HEIGHT_PX,
  COMMUNICATION_LIST_SCROLL_THRESHOLD,
  communicationHubCounts,
  defaultSelectedResponseShiftIds,
  groupCommunicationHubData,
  groupCommunicationShiftsByArea,
  type CommunicationHubCategory,
  type CommunicationSwapRequestRow,
} from "@/lib/communication-hub";
import {
  communicationActionRequiresExactlyOneSelection,
  communicationTabActions,
  communicationTabShowsSelection,
  type CommunicationTabAction,
} from "@/lib/communication-tab-actions";
import {
  shiftConfirmationStatusLabelKey,
  shiftConfirmationTooltipStatusTextClass,
} from "@/lib/shift-confirmation-display";
import { absenceTypeLabelKey } from "@/lib/shift-absence-conflict";
import { translateShiftCancelError } from "@/lib/shift-cancellation-policy";
import { translateActionError } from "@/lib/translate-action-error";
import type { AbsenceRequest, ShiftConfirmationStatus } from "@schichtwerk/types";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import {
  useShiftConfirmationSimulation,
  useSimulatedProposedOnAssignRequest,
} from "@/lib/shift-confirmation-simulation-context";
import { getShiftConfirmationSimulationSendBlockedResult } from "@/lib/shift-confirmation-simulation-send-guard";
import type { LocationArea } from "@schichtwerk/types";

type Props = {
  weekStart: string;
  locationId: string | null;
  areas: LocationArea[];
  shifts: AreaCalendarShiftCard[];
  absences?: AbsenceRequest[];
  swapRequests?: CommunicationSwapRequestRow[];
  cancelActors?: ReadonlyMap<string, "employee" | "manager">;
  initialCategory?: CommunicationHubCategory;
  onClose: () => void;
  onReassign: (shift: AreaCalendarShiftCard) => void;
  onBusyChange?: (busy: boolean) => void;
  onLocalShiftRemoved?: (shiftIds: readonly string[]) => void;
  onLocalShiftRestore?: (shiftIds: readonly string[]) => void;
};

type BatchConfirmState =
  | { action: "delete"; shiftIds: string[] }
  | { action: "cancel"; shiftIds: string[] }
  | null;

const RESPONSE_ROW_GRID_WITH_SELECTION_CLASS =
  "grid h-10 grid-cols-[minmax(9.5rem,1.05fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,0.85fr)] items-center gap-x-3";

const RESPONSE_ROW_GRID_READONLY_CLASS =
  "grid h-10 grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,0.85fr)] items-center gap-x-3";

const CELL_CLASS = "min-w-0 truncate text-left text-sm";
const HEADER_CELL_CLASS =
  "min-w-0 truncate text-left text-xs font-semibold uppercase tracking-wide text-muted";
const CHECKBOX_LABEL_CLASS =
  "flex min-w-0 items-center gap-2 whitespace-nowrap text-left text-xs text-muted";

const RESPONSE_ROW_GRID_CONFLICTS_CLASS =
  "grid h-10 grid-cols-[minmax(9.5rem,1.05fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_minmax(0,0.75fr)] items-center gap-x-3";

const SWAP_ROW_GRID_CLASS =
  "grid h-10 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,1fr)] items-center gap-x-3";

function checkboxLabelKey(category: CommunicationHubCategory) {
  if (category === "proposed") {
    return "shiftConfirmation.communication.rowRequest";
  }
  if (category === "pending") {
    return "shiftConfirmation.communication.rowResend";
  }
  if (category === "rejected" || category === "canceled" || category === "conflicts") {
    return "shiftConfirmation.communication.rowReassign";
  }
  return "shiftConfirmation.communication.rowSelect";
}

function actionButtonLabel(
  action: CommunicationTabAction,
  t: ReturnType<typeof useTranslations>
): string {
  switch (action) {
    case "delete":
      return t("shiftConfirmation.communication.actionDelete");
    case "cancel":
      return t("shiftConfirmation.actions.cancelShiftManager");
    case "reassign":
      return t("shiftConfirmation.panel.reassign");
    case "requestConfirmation":
      return t("shiftConfirmation.actions.requestConfirmation");
  }
}

function isActionDisabled(
  action: CommunicationTabAction,
  selectedCount: number,
  pending: boolean
): boolean {
  if (pending) return true;
  if (communicationActionRequiresExactlyOneSelection(action)) {
    return selectedCount !== 1;
  }
  return selectedCount === 0;
}

function resolveAreaNameForGroup(
  areaId: string | null,
  areaNameById: ReadonlyMap<string, string>,
  unknownLabel: string
): string {
  if (areaId && areaNameById.has(areaId)) {
    return areaNameById.get(areaId)!;
  }
  return unknownLabel;
}

function responseStatusLabelKey(
  status: ShiftConfirmationStatus
):
  | ReturnType<typeof shiftConfirmationStatusLabelKey>
  | "shiftConfirmation.communication.statusRequested" {
  if (status === "requested") {
    return "shiftConfirmation.communication.statusRequested";
  }
  return shiftConfirmationStatusLabelKey(status);
}

export function CommunicationResponsesTab({
  weekStart,
  locationId,
  areas,
  shifts,
  absences = [],
  swapRequests = [],
  cancelActors,
  initialCategory = "conflicts",
  onClose,
  onReassign,
  onBusyChange,
  onLocalShiftRemoved,
  onLocalShiftRestore,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const router = useRouter();
  const { blocksOutboundSend } = useShiftConfirmationSimulation();
  const { simulatedProposedOnAssign, relaxAppRegistrationGate } =
    useSimulatedProposedOnAssignRequest();
  const [pending, startTransition] = useTransition();
  const hubOptions = useMemo(
    () => ({
      absences,
      swapRequests,
      cancelActors,
    }),
    [absences, swapRequests, cancelActors]
  );
  const grouped = useMemo(
    () => groupCommunicationHubData(shifts, hubOptions),
    [shifts, hubOptions]
  );
  const counts = useMemo(() => communicationHubCounts(grouped), [grouped]);
  const [activeCategory, setActiveCategory] =
    useState<CommunicationHubCategory>(initialCategory);
  const [selected, setSelected] = useState<Set<string>>(() =>
    defaultSelectedResponseShiftIds(initialCategory, shifts, hubOptions)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [batchConfirm, setBatchConfirm] = useState<BatchConfirmState>(null);

  const categoryActions = communicationTabActions(activeCategory);
  const showSelection = communicationTabShowsSelection(activeCategory);
  const showConflictColumn = activeCategory === "conflicts";
  const rowGridClass = showSelection
    ? showConflictColumn
      ? RESPONSE_ROW_GRID_CONFLICTS_CLASS
      : RESPONSE_ROW_GRID_WITH_SELECTION_CLASS
    : RESPONSE_ROW_GRID_READONLY_CLASS;

  const visibleShifts = useMemo(() => {
    if (activeCategory === "conflicts") return grouped.conflicts;
    if (activeCategory === "swaps") return [];
    return grouped[activeCategory as keyof typeof grouped] as
      | AreaCalendarShiftCard[]
      | undefined ?? [];
  }, [activeCategory, grouped]);

  const visibleSwaps =
    activeCategory === "swaps" ? grouped.swaps : [];

  const categoryLabel = useCallback(
    (category: CommunicationHubCategory) =>
      t(`shiftConfirmation.communication.categories.${category}`),
    [t]
  );

  const areaNameById = useMemo(
    () => new Map(areas.map((area) => [area.id, area.name])),
    [areas]
  );

  const areaGroups = useMemo(
    () => groupCommunicationShiftsByArea(visibleShifts, areas),
    [visibleShifts, areas]
  );

  const listItems = useMemo(() => {
    const unknownAreaLabel = t("shiftConfirmation.communication.areaUnknown");
    const items: Array<
      | { kind: "area"; key: string; areaName: string }
      | { kind: "shift"; key: string; shift: AreaCalendarShiftCard }
    > = [];

    for (const group of areaGroups) {
      items.push({
        kind: "area",
        key: `area:${group.areaId ?? "none"}`,
        areaName: resolveAreaNameForGroup(
          group.areaId,
          areaNameById,
          unknownAreaLabel
        ),
      });
      for (const shift of group.shifts) {
        items.push({ kind: "shift", key: shift.id, shift });
      }
    }

    return items;
  }, [areaGroups, areaNameById, t]);

  const listRowCount =
    activeCategory === "swaps" ? visibleSwaps.length : listItems.length;
  const listScrollEnabled = listRowCount > COMMUNICATION_LIST_SCROLL_THRESHOLD;

  const selectedShifts = visibleShifts.filter((shift) => selected.has(shift.id));
  const selectedCount = selectedShifts.length;
  const listIsEmpty =
    activeCategory === "swaps" ? visibleSwaps.length === 0 : visibleShifts.length === 0;

  useEffect(() => {
    setActiveCategory(initialCategory);
    setSelected(defaultSelectedResponseShiftIds(initialCategory, shifts, hubOptions));
  }, [initialCategory, shifts, hubOptions]);

  useEffect(() => {
    setSelected(defaultSelectedResponseShiftIds(activeCategory, shifts, hubOptions));
    setErrorMessage(null);
    setSuccessMessage(null);
    setBatchConfirm(null);
  }, [activeCategory, shifts, hubOptions]);

  useEffect(() => {
    onBusyChange?.(pending);
  }, [onBusyChange, pending]);

  const allVisibleSelected =
    visibleShifts.length > 0 && visibleShifts.every((shift) => selected.has(shift.id));
  const someVisibleSelected = visibleShifts.some((shift) => selected.has(shift.id));

  function toggleShift(shiftId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(shiftId)) next.delete(shiftId);
      else next.add(shiftId);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelected(
      checked ? new Set(visibleShifts.map((shift) => shift.id)) : new Set()
    );
  }

  function handleSendSelected() {
    setErrorMessage(null);
    setSuccessMessage(null);

    const shiftIds = selectedShifts.map((shift) => shift.id);
    if (!shiftIds.length) {
      setErrorMessage(t("shiftConfirmation.send.noSelection"));
      return;
    }

    startTransition(async () => {
      if (blocksOutboundSend && !simulatedProposedOnAssign) {
        setErrorMessage(getShiftConfirmationSimulationSendBlockedResult().error);
        return;
      }

      const result = await submitCommunicationConfirmationRequests({
        shiftIds,
        weekStart,
        locationId: locationId ?? undefined,
        simulatedProposedOnAssign,
        relaxAppRegistrationGate,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      router.refresh();

      if (result.sentCount === 0) {
        setErrorMessage(t("shiftConfirmation.send.failed"));
        return;
      }

      if (result.failedCount > 0) {
        setSuccessMessage(
          t("shiftConfirmation.communication.partialResend", {
            sent: result.sentCount,
            failed: result.failedCount,
          })
        );
      } else {
        setSuccessMessage(
          t("shiftConfirmation.communication.resendSuccess", {
            count: result.sentCount,
          })
        );
        setSelected(new Set());
      }
    });
  }

  function handleReassignSelected() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (selectedShifts.length !== 1) {
      setErrorMessage(t("shiftConfirmation.communication.reassignRequiresOne"));
      return;
    }

    onReassign(selectedShifts[0]!);
  }

  function handleActionClick(action: CommunicationTabAction) {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (action === "reassign") {
      handleReassignSelected();
      return;
    }

    if (action === "requestConfirmation") {
      handleSendSelected();
      return;
    }

    const shiftIds = selectedShifts.map((shift) => shift.id);
    if (!shiftIds.length) {
      setErrorMessage(t("shiftConfirmation.send.noSelection"));
      return;
    }

    setBatchConfirm({ action, shiftIds });
  }

  function handleConfirmBatchAction() {
    if (!batchConfirm) return;

    startTransition(async () => {
      if (batchConfirm.action === "delete") {
        const result = await removeShiftsAsManager(batchConfirm.shiftIds);
        setBatchConfirm(null);
        if (!result.ok) {
          setErrorMessage(translateActionError(result.error, t));
          return;
        }
        router.refresh();
        if (result.failedCount > 0) {
          setSuccessMessage(
            t("shiftConfirmation.communication.partialDelete", {
              done: result.deletedCount,
              failed: result.failedCount,
            })
          );
        } else {
          setSuccessMessage(
            t("shiftConfirmation.communication.deleteSuccess", {
              count: result.deletedCount,
            })
          );
          setSelected(new Set());
        }
        return;
      }

      const shiftIds = batchConfirm.shiftIds;
      setBatchConfirm(null);
      onLocalShiftRemoved?.(shiftIds);

      const result = await cancelShiftsAsManager(shiftIds);
      if (!result.ok) {
        onLocalShiftRestore?.(shiftIds);
        setErrorMessage(translateShiftCancelError(result.error, t));
        return;
      }
      if (result.failedCount > 0) {
        onLocalShiftRestore?.(shiftIds);
        router.refresh();
        setSuccessMessage(
          t("shiftConfirmation.communication.partialCancel", {
            done: result.canceledCount,
            failed: result.failedCount,
          })
        );
      } else {
        setSuccessMessage(
          t("shiftConfirmation.communication.cancelSuccess", {
            count: result.canceledCount,
          })
        );
        setSelected(new Set());
      }
    });
  }

  const batchConfirmMessage = batchConfirm
    ? batchConfirm.action === "delete"
      ? batchConfirm.shiftIds.length === 1
        ? t("shiftConfirmation.communication.deleteConfirmOne")
        : t("shiftConfirmation.communication.deleteConfirmMany", {
            count: batchConfirm.shiftIds.length,
          })
      : batchConfirm.shiftIds.length === 1
        ? t("shiftConfirmation.communication.cancelConfirmOne")
        : t("shiftConfirmation.communication.cancelConfirmMany", {
            count: batchConfirm.shiftIds.length,
          })
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}

      <CommunicationCategoryTabs
        counts={counts}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
        labelFor={categoryLabel}
        disabled={pending}
      />

      {activeCategory === "swaps" ? (
        listIsEmpty ? (
          <p className="py-6 text-sm text-muted">{t("shiftConfirmation.panel.empty")}</p>
        ) : (
          <div className="min-h-0 flex-1 rounded border border-border">
            <div className={cn(SWAP_ROW_GRID_CLASS, "border-b border-border bg-subtle/40 px-3")}>
              <span className={HEADER_CELL_CLASS}>
                {t("shiftConfirmation.communication.swapColRequester")}
              </span>
              <span className={HEADER_CELL_CLASS}>
                {t("shiftConfirmation.send.colEmployee")}
              </span>
              <span className={HEADER_CELL_CLASS}>
                {t("shiftConfirmation.send.colDate")}
              </span>
              <span className={HEADER_CELL_CLASS}>
                {t("shiftConfirmation.send.colTime")}
              </span>
              <span className={HEADER_CELL_CLASS}>
                {t("shiftConfirmation.communication.swapColTarget")}
              </span>
            </div>
            <ul
              className={cn(
                "divide-y divide-border",
                listScrollEnabled && "overflow-y-auto",
                listScrollEnabled && MODAL_SCROLLBAR_CLASS
              )}
              style={
                listScrollEnabled
                  ? {
                      maxHeight:
                        COMMUNICATION_LIST_SCROLL_THRESHOLD *
                        COMMUNICATION_LIST_ROW_HEIGHT_PX,
                    }
                  : undefined
              }
            >
              {visibleSwaps.map((swap) => {
                const { weekday, label } = formatDayHeader(
                  swap.shiftDate,
                  intlLocale,
                  "long"
                );
                return (
                  <li key={swap.id} className={cn(SWAP_ROW_GRID_CLASS, "px-3")}>
                    <span className={cn(CELL_CLASS, "font-medium text-foreground")}>
                      {swap.requesterName}
                    </span>
                    <span className={cn(CELL_CLASS, "text-muted")}>
                      {swap.assigneeName}
                    </span>
                    <span className={cn(CELL_CLASS, "text-muted")}>
                      {weekday}, {label}
                    </span>
                    <span className={cn(CELL_CLASS, "whitespace-nowrap text-muted")}>
                      {swap.startTime} - {swap.endTime}
                    </span>
                    <span className={cn(CELL_CLASS, "text-muted")}>
                      {swap.targetEmployeeName ??
                        t("shiftConfirmation.communication.swapOpenTarget")}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-border px-3 py-2 text-xs text-muted">
              {t("shiftConfirmation.communication.swapActionsHint")}
            </p>
          </div>
        )
      ) : listIsEmpty ? (
        <p className="py-6 text-sm text-muted">{t("shiftConfirmation.panel.empty")}</p>
      ) : (
        <div className="min-h-0 flex-1 rounded border border-border">
          <div
            className={cn(rowGridClass, "border-b border-border bg-subtle/40 px-3")}
          >
            {showSelection ? (
              <span className={HEADER_CELL_CLASS}>
                {t("shiftConfirmation.communication.colSelection")}
              </span>
            ) : null}
            <span className={HEADER_CELL_CLASS}>
              {t("shiftConfirmation.send.colEmployee")}
            </span>
            <span className={HEADER_CELL_CLASS}>
              {t("shiftConfirmation.send.colDate")}
            </span>
            <span className={HEADER_CELL_CLASS}>
              {t("shiftConfirmation.send.colTemplate")}
            </span>
            <span className={HEADER_CELL_CLASS}>
              {t("shiftConfirmation.send.colTime")}
            </span>
            <span className={HEADER_CELL_CLASS}>
              {t("shiftConfirmation.send.colStatus")}
            </span>
            {showConflictColumn ? (
              <span className={HEADER_CELL_CLASS}>
                {t("shiftConfirmation.communication.colConflict")}
              </span>
            ) : null}
          </div>

          <ul
            className={cn(
              "divide-y divide-border",
              listScrollEnabled && "overflow-y-auto",
              listScrollEnabled && MODAL_SCROLLBAR_CLASS
            )}
            style={
              listScrollEnabled
                ? {
                    maxHeight:
                      COMMUNICATION_LIST_SCROLL_THRESHOLD *
                      COMMUNICATION_LIST_ROW_HEIGHT_PX,
                  }
                : undefined
            }
          >
            {listItems.map((item) =>
              item.kind === "area" ? (
                <li
                  key={item.key}
                  className="flex h-10 items-center bg-subtle/50 px-3"
                  aria-hidden
                >
                  <span className={HEADER_CELL_CLASS}>{item.areaName}</span>
                </li>
              ) : (
                (() => {
                  const shift = item.shift;
                  const { weekday, label } = formatDayHeader(
                    shift.shift_date,
                    intlLocale,
                    "long"
                  );
                  const hasTemplate = Boolean(shift.shiftName?.trim());
                  const templateLabel = hasTemplate
                    ? shift.shiftName.trim()
                    : t("shiftConfirmation.send.noTemplate");
                  const status = shift.confirmationStatus;
                  const conflict = grouped.conflictDetailsByShiftId.get(shift.id);

                  return (
                    <li key={item.key} className={cn(rowGridClass, "px-3")}>
                      {showSelection ? (
                        <label className={CHECKBOX_LABEL_CLASS}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 rounded border-border"
                            checked={selected.has(shift.id)}
                            disabled={pending}
                            onChange={() => toggleShift(shift.id)}
                            aria-label={t(checkboxLabelKey(activeCategory))}
                          />
                          <span className="truncate">
                            {t(checkboxLabelKey(activeCategory))}
                          </span>
                        </label>
                      ) : null}
                      <span className={cn(CELL_CLASS, "font-medium text-foreground")}>
                        {shift.employeeName}
                      </span>
                      <span className={cn(CELL_CLASS, "text-muted")}>
                        {weekday}, {label}
                      </span>
                      <span
                        className={cn(
                          CELL_CLASS,
                          hasTemplate ? "font-medium text-foreground" : "text-muted"
                        )}
                      >
                        {templateLabel}
                      </span>
                      <span className={cn(CELL_CLASS, "whitespace-nowrap text-muted")}>
                        {shift.startTime} - {shift.endTime}
                      </span>
                      <span
                        className={cn(
                          CELL_CLASS,
                          "font-medium",
                          status
                            ? shiftConfirmationTooltipStatusTextClass(status) ||
                                "text-foreground/80"
                            : "text-muted"
                        )}
                      >
                        {status ? t(responseStatusLabelKey(status)) : "—"}
                      </span>
                      {showConflictColumn ? (
                        <span className={cn(CELL_CLASS, "font-medium text-rose-700")}>
                          {conflict
                            ? t(absenceTypeLabelKey(conflict.absenceType))
                            : "—"}
                        </span>
                      ) : null}
                    </li>
                  );
                })()
              )
            )}
          </ul>

          {showSelection ? (
            <div className={cn(rowGridClass, "border-t border-border px-3")}>
              <label className={CHECKBOX_LABEL_CLASS}>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-border"
                  checked={allVisibleSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = someVisibleSelected && !allVisibleSelected;
                    }
                  }}
                  disabled={pending || visibleShifts.length === 0}
                  onChange={(event) => toggleAllVisible(event.target.checked)}
                  aria-label={t("shiftConfirmation.send.selectAll")}
                />
                <span>{t("shiftConfirmation.send.selectAll")}</span>
              </label>
              <span aria-hidden className="min-w-0" />
              <span aria-hidden className="min-w-0" />
              <span aria-hidden className="min-w-0" />
              <span aria-hidden className="min-w-0" />
              {showConflictColumn ? <span aria-hidden className="min-w-0" /> : null}
            </div>
          ) : null}

          {categoryActions.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-3 py-2">
              {categoryActions.map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant={action === "delete" ? "outline" : "primary"}
                  onClick={() => handleActionClick(action)}
                  disabled={isActionDisabled(action, selectedCount, pending)}
                >
                  {actionButtonLabel(action, t)}
                  {selectedCount > 0 &&
                  !communicationActionRequiresExactlyOneSelection(action)
                    ? ` (${selectedCount})`
                    : null}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          {t("common.close")}
        </Button>
      </div>

      {batchConfirm && batchConfirmMessage ? (
        <AreaCalendarShiftDeleteConfirmModal
          message={batchConfirmMessage}
          pending={pending}
          onCancel={() => {
            if (pending) return;
            setBatchConfirm(null);
          }}
          onConfirm={handleConfirmBatchAction}
        />
      ) : null}
    </div>
  );
}
