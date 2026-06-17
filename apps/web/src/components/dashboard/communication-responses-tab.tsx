"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import { submitCommunicationConfirmationRequests } from "@/app/actions/shift-confirmations";
import { Alert, Button } from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import { formatDayHeader } from "@/lib/planning-utils";
import {
  COMMUNICATION_LIST_ROW_HEIGHT_PX,
  COMMUNICATION_LIST_SCROLL_THRESHOLD,
  COMMUNICATION_RESPONSE_TAB_ORDER,
  communicationResponseTabLabelClass,
  communicationTabHasActionButton,
  communicationTabShowsSelection,
  defaultSelectedResponseShiftIds,
  groupCommunicationResponseShifts,
  groupCommunicationShiftsByArea,
  type CommunicationResponseTab,
} from "@/lib/communication-hub";
import {
  shiftConfirmationStatusLabelKey,
  shiftConfirmationTooltipStatusTextClass,
} from "@/lib/shift-confirmation-display";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";
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
  shifts: DashboardShiftCard[];
  initialTab?: CommunicationResponseTab;
  onClose: () => void;
  onReassign: (shift: DashboardShiftCard) => void;
  onBusyChange?: (busy: boolean) => void;
};

const RESPONSE_ROW_GRID_WITH_SELECTION_CLASS =
  "grid h-10 grid-cols-[minmax(9.5rem,1.05fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,0.85fr)] items-center gap-x-3";

const RESPONSE_ROW_GRID_READONLY_CLASS =
  "grid h-10 grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,0.85fr)] items-center gap-x-3";

const CELL_CLASS = "min-w-0 truncate text-left text-sm";
const HEADER_CELL_CLASS =
  "min-w-0 truncate text-left text-xs font-semibold uppercase tracking-wide text-muted";
const CHECKBOX_LABEL_CLASS =
  "flex min-w-0 items-center gap-2 whitespace-nowrap text-left text-xs text-muted";

function checkboxLabelKey(tab: CommunicationResponseTab) {
  return tab === "proposed"
    ? "shiftConfirmation.communication.rowRequest"
    : "shiftConfirmation.communication.rowResend";
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

function tabActionLabel(
  tab: CommunicationResponseTab,
  t: ReturnType<typeof useTranslations>
): string {
  switch (tab) {
    case "pending":
      return t("shiftConfirmation.actions.requestConfirmation");
    case "proposed":
      return t("shiftConfirmation.communication.tabActionSend");
    case "rejected":
      return t("shiftConfirmation.panel.reassign");
    default:
      return "";
  }
}

export function CommunicationResponsesTab({
  weekStart,
  locationId,
  areas,
  shifts,
  initialTab = "rejected",
  onClose,
  onReassign,
  onBusyChange,
}: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);
  const router = useRouter();
  const { blocksOutboundSend } = useShiftConfirmationSimulation();
  const { simulatedProposedOnAssign } = useSimulatedProposedOnAssignRequest();
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<CommunicationResponseTab>(initialTab);
  const [selected, setSelected] = useState<Set<string>>(() =>
    defaultSelectedResponseShiftIds(initialTab, shifts)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSelection = communicationTabShowsSelection(activeTab);
  const rowGridClass = showSelection
    ? RESPONSE_ROW_GRID_WITH_SELECTION_CLASS
    : RESPONSE_ROW_GRID_READONLY_CLASS;

  const grouped = useMemo(() => groupCommunicationResponseShifts(shifts), [shifts]);
  const visibleShifts = grouped[activeTab];

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
      | { kind: "shift"; key: string; shift: DashboardShiftCard }
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

  const listRowCount = listItems.length;
  const listScrollEnabled = listRowCount > COMMUNICATION_LIST_SCROLL_THRESHOLD;

  const tabs = COMMUNICATION_RESPONSE_TAB_ORDER.map((id) => ({
    id,
    label: t(`shiftConfirmation.panel.tabs.${id}`),
    count: grouped[id].length,
  }));

  const selectedCount = visibleShifts.filter((shift) => selected.has(shift.id)).length;

  useEffect(() => {
    setActiveTab(initialTab);
    setSelected(defaultSelectedResponseShiftIds(initialTab, shifts));
  }, [initialTab, shifts]);

  useEffect(() => {
    setSelected(defaultSelectedResponseShiftIds(activeTab, shifts));
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [activeTab, shifts]);

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

    const shiftIds = visibleShifts
      .filter((shift) => selected.has(shift.id))
      .map((shift) => shift.id);

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

    const selectedShifts = visibleShifts.filter((shift) => selected.has(shift.id));
    if (selectedShifts.length !== 1) {
      setErrorMessage(t("shiftConfirmation.communication.reassignRequiresOne"));
      return;
    }

    onReassign(selectedShifts[0]!);
  }

  function handleTabAction() {
    if (activeTab === "rejected") {
      handleReassignSelected();
      return;
    }
    if (activeTab === "pending" || activeTab === "proposed") {
      handleSendSelected();
    }
  }

  const tabActionDisabled =
    pending ||
    (activeTab === "rejected"
      ? selectedCount !== 1
      : activeTab === "pending" || activeTab === "proposed"
        ? selectedCount === 0
        : true);

  const tabActionLabelWithCount =
    activeTab === "rejected" || activeTab === "requested"
      ? tabActionLabel(activeTab, t)
      : selectedCount > 0
        ? `${tabActionLabel(activeTab, t)} (${selectedCount})`
        : tabActionLabel(activeTab, t);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              "rounded-md px-3 py-2 text-base font-semibold transition-colors",
              communicationResponseTabLabelClass(tab.id),
              tab.count <= 0 && "opacity-50",
              activeTab === tab.id
                ? "bg-subtle ring-1 ring-border"
                : "hover:bg-subtle/70"
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <span className="ml-1.5 tabular-nums">({tab.count})</span>
          </button>
        ))}
      </div>

      {visibleShifts.length === 0 ? (
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
                            aria-label={t(checkboxLabelKey(activeTab))}
                          />
                          <span className="truncate">
                            {t(checkboxLabelKey(activeTab))}
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
              <span aria-hidden className="min-w-0" />
            </div>
          ) : null}

          {communicationTabHasActionButton(activeTab) ? (
            <div className="flex justify-end border-t border-border px-3 py-2">
              <Button
                type="button"
                onClick={handleTabAction}
                disabled={tabActionDisabled}
              >
                {tabActionLabelWithCount}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          {t("common.close")}
        </Button>
      </div>
    </div>
  );
}
