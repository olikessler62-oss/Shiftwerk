"use client";

import { useEffect, useMemo, useState } from "react";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import { Button } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  countCommunicationActionItems,
  resolveCommunicationOpenCategory,
  resolveDefaultCommunicationHubCategory,
  type CommunicationOpenOptions,
  type CommunicationSwapRequestRow,
} from "@/lib/communication-hub";
import type { ShiftForWeeklyHoursConflict } from "@schichtwerk/database";
import { PlanningRightSidePanel, PLANNING_SIDE_PANEL_FOOTER_CLASS } from "@/components/planning/planning-side-panel";
import { PLANNING_SIDE_PANEL_SUBTITLE_CLASS } from "@/components/settings/settings-list-ui";
import { CommunicationResponsesTab } from "./communication-responses-tab";

import type { AbsenceRequest, LocationArea } from "@schichtwerk/types";

type Props = {
  weekStart: string;
  locationId: string | null;
  locationName?: string;
  areas: LocationArea[];
  shifts: AreaCalendarShiftCard[];
  absences?: AbsenceRequest[];
  swapRequests?: CommunicationSwapRequestRow[];
  cancelActors?: ReadonlyMap<string, "employee" | "manager">;
  todayISO?: string;
  weeklyHoursByEmployeeId?: ReadonlyMap<string, number | null | undefined>;
  weeklyHoursCheckShifts?: readonly ShiftForWeeklyHoursConflict[];
  shiftConfirmationEnabled: boolean;
  initialOptions?: CommunicationOpenOptions;
  onClose: () => void;
  onReassign: (shift: AreaCalendarShiftCard) => void;
  onBusyChange?: (busy: boolean) => void;
  onLocalShiftRemoved?: (shiftIds: readonly string[]) => void;
  onLocalShiftRestore?: (shiftIds: readonly string[]) => void;
};

export function CommunicationHubModal({
  weekStart,
  locationId,
  locationName,
  areas,
  shifts,
  absences = [],
  swapRequests = [],
  cancelActors,
  todayISO,
  weeklyHoursByEmployeeId,
  weeklyHoursCheckShifts,
  shiftConfirmationEnabled,
  initialOptions,
  onClose,
  onReassign,
  onBusyChange,
  onLocalShiftRemoved,
  onLocalShiftRestore,
}: Props) {
  const t = useTranslations();
  const hubOptions = useMemo(
    () => ({
      absences,
      swapRequests,
      cancelActors,
      todayISO,
      weeklyHoursByEmployeeId,
      weeklyHoursCheckShifts,
    }),
    [
      absences,
      swapRequests,
      cancelActors,
      todayISO,
      weeklyHoursByEmployeeId,
      weeklyHoursCheckShifts,
    ]
  );
  const initialCategory = useMemo(() => {
    const requested = resolveCommunicationOpenCategory(initialOptions);
    if (requested) return requested;
    return resolveDefaultCommunicationHubCategory(shifts, hubOptions);
  }, [initialOptions, shifts, hubOptions]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  return (
    <PlanningRightSidePanel
      size="wide"
      title={t("shiftConfirmation.communication.title")}
      subtitleNode={
        locationName ? (
          <p
            className={cn(
              PLANNING_SIDE_PANEL_SUBTITLE_CLASS,
              "truncate font-semibold text-[#0f766e]"
            )}
          >
            {locationName}
          </p>
        ) : undefined
      }
      titleId="communication-hub-title"
      onClose={onClose}
      closeDisabled={busy}
      closeAriaLabel={t("common.close")}
      dismissOnBackdrop={!busy}
      panelClassName={cn(busy && "cursor-wait [&_*]:cursor-wait")}
      bodyClassName="flex min-h-0 flex-col gap-4 overflow-hidden"
      footer={
        shiftConfirmationEnabled ? (
          <div className={cn(PLANNING_SIDE_PANEL_FOOTER_CLASS, "justify-end")}>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t("common.close")}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!shiftConfirmationEnabled ? (
        <div className="space-y-3 py-4">
          <p className="text-sm text-muted">
            {t("shiftConfirmation.communication.disabledHint")}
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <CommunicationResponsesTab
          key={`responses-${initialCategory}-${initialOptions?.preselectedShiftIds?.join(",") ?? ""}`}
          weekStart={weekStart}
          locationId={locationId}
          areas={areas}
          shifts={shifts}
          absences={absences}
          swapRequests={swapRequests}
          cancelActors={cancelActors}
          todayISO={todayISO}
          weeklyHoursByEmployeeId={weeklyHoursByEmployeeId}
          weeklyHoursCheckShifts={weeklyHoursCheckShifts}
          initialCategory={initialCategory}
          initialPreselectedShiftIds={initialOptions?.preselectedShiftIds}
          onClose={onClose}
          onReassign={(shift) => {
            onClose();
            onReassign(shift);
          }}
          onBusyChange={setBusy}
          onLocalShiftRemoved={onLocalShiftRemoved}
          onLocalShiftRestore={onLocalShiftRestore}
        />
      )}
    </PlanningRightSidePanel>
  );
}

export function communicationBadgeCount(
  shifts: readonly AreaCalendarShiftCard[],
  options?: Parameters<typeof countCommunicationActionItems>[1]
): number {
  return countCommunicationActionItems(shifts, options);
}
