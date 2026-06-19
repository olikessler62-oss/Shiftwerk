"use client";

import { useEffect, useState } from "react";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-shift-card-view";
import { Button, CloseIcon, IconButton } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  countCommunicationActionItems,
  resolveDefaultCommunicationResponseTab,
  type CommunicationOpenOptions,
  type CommunicationResponseTab,
} from "@/lib/communication-hub";
import { CommunicationResponsesTab } from "./communication-responses-tab";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalHeaderPaddingClass,
} from "@/components/settings/settings-list-ui";

import type { LocationArea } from "@schichtwerk/types";

type Props = {
  weekStart: string;
  locationId: string | null;
  locationName?: string;
  areas: LocationArea[];
  shifts: DashboardShiftCard[];
  shiftConfirmationEnabled: boolean;
  initialOptions?: CommunicationOpenOptions;
  onClose: () => void;
  onReassign: (shift: DashboardShiftCard) => void;
  onBusyChange?: (busy: boolean) => void;
};

export function CommunicationHubModal({
  weekStart,
  locationId,
  locationName,
  areas,
  shifts,
  shiftConfirmationEnabled,
  initialOptions,
  onClose,
  onReassign,
  onBusyChange,
}: Props) {
  const t = useTranslations();
  const [responseTab] = useState<CommunicationResponseTab>(
    initialOptions?.responseTab ?? resolveDefaultCommunicationResponseTab(shifts)
  );
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
              key={`responses-${responseTab}`}
              weekStart={weekStart}
              locationId={locationId}
              areas={areas}
              shifts={shifts}
              initialTab={responseTab}
              onClose={onClose}
              onReassign={(shift) => {
                onClose();
                onReassign(shift);
              }}
              onBusyChange={setBusy}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function communicationBadgeCount(shifts: readonly DashboardShiftCard[]): number {
  return countCommunicationActionItems(shifts);
}
