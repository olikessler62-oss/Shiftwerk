"use client";

import { useEffect, useMemo, useState } from "react";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import { Button, CloseIcon, IconButton } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  countCommunicationActionItems,
  groupCommunicationHubData,
  resolveCommunicationOpenCategory,
  resolveDefaultCommunicationHubCategory,
  type CommunicationOpenOptions,
  type CommunicationSwapRequestRow,
} from "@/lib/communication-hub";
import type { ShiftForWeeklyHoursConflict } from "@schichtwerk/database";
import { CommunicationResponsesTab } from "./communication-responses-tab";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalHeaderPaddingClass,
} from "@/components/settings/settings-list-ui";

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div
      className={cn(
        settingsModalBackdropClass(),
        busy && "cursor-wait [&_*]:cursor-wait"
      )}
      role="presentation"
      aria-busy={busy}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="communication-hub-title"
        className={cn(settingsModalDialogClass(), "max-w-6xl")}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            settingsModalHeaderPaddingClass(),
            "flex items-start justify-between gap-3 border-b border-border"
          )}
        >
          <div className="min-w-0">
            <h2 id="communication-hub-title" className={SETTINGS_MODAL_TITLE_CLASS}>
              {t("shiftConfirmation.communication.title")}
            </h2>
            {locationName ? (
              <p className="mt-0.5 truncate font-semibold text-base text-[#0f766e]">
                {locationName}
              </p>
            ) : null}
          </div>
          <IconButton
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
            disabled={busy}
          >
            <CloseIcon />
          </IconButton>
        </div>

        <div className={cn(settingsModalBodyPaddingClass(), "flex min-h-0 flex-col gap-4")}>
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
        </div>
      </div>
    </div>
  );
}

export function communicationBadgeCount(
  shifts: readonly AreaCalendarShiftCard[],
  options?: Parameters<typeof countCommunicationActionItems>[1]
): number {
  return countCommunicationActionItems(shifts, options);
}
