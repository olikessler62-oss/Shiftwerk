"use client";

import { useMemo, useState } from "react";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import { Button, CloseIcon, IconButton } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { shiftConfirmationStatusLabelKey } from "@/lib/shift-confirmation-display";
import { MODAL_SCROLLBAR_CLASS, SETTINGS_MODAL_HEADER_BG_CLASS } from "@/components/settings/settings-list-ui";

type PanelTab = "pending" | "rejected" | "proposed";

type Props = {
  shifts: AreaCalendarShiftCard[];
  initialTab?: PanelTab;
  onClose: () => void;
  onReassign: (shift: AreaCalendarShiftCard) => void;
  onSendConfirmation?: () => void;
};

function tabForStatus(status: AreaCalendarShiftCard["confirmationStatus"]): PanelTab | null {
  if (status === "pending" || status === "rejected" || status === "proposed") {
    return status;
  }
  return null;
}

export function OpenConfirmationsPanel({
  shifts,
  initialTab = "pending",
  onClose,
  onReassign,
  onSendConfirmation,
}: Props) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<PanelTab>(initialTab);

  const grouped = useMemo(() => {
    const pending: AreaCalendarShiftCard[] = [];
    const rejected: AreaCalendarShiftCard[] = [];
    const proposed: AreaCalendarShiftCard[] = [];

    for (const shift of shifts) {
      const tab = tabForStatus(shift.confirmationStatus);
      if (tab === "pending") pending.push(shift);
      else if (tab === "rejected") rejected.push(shift);
      else if (tab === "proposed") proposed.push(shift);
    }

    const byDateThenName = (a: AreaCalendarShiftCard, b: AreaCalendarShiftCard) => {
      const dateDiff = a.shift_date.localeCompare(b.shift_date);
      if (dateDiff !== 0) return dateDiff;
      return a.employeeName.localeCompare(b.employeeName, "de");
    };

    pending.sort(byDateThenName);
    rejected.sort(byDateThenName);
    proposed.sort(byDateThenName);

    return { pending, rejected, proposed };
  }, [shifts]);

  const tabs: { id: PanelTab; label: string; count: number }[] = [
    {
      id: "pending",
      label: t("shiftConfirmation.panel.tabs.pending"),
      count: grouped.pending.length,
    },
    {
      id: "rejected",
      label: t("shiftConfirmation.panel.tabs.rejected"),
      count: grouped.rejected.length,
    },
    {
      id: "proposed",
      label: t("shiftConfirmation.panel.tabs.proposed"),
      count: grouped.proposed.length,
    },
  ];

  const visibleShifts = grouped[activeTab];

  return (
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/20"
        role="presentation"
        onMouseDown={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-confirmations-title"
        className="fixed inset-y-0 right-0 z-[95] flex w-full max-w-md flex-col border-l border-border bg-surface shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-3 border-b border-border px-4 py-3",
            SETTINGS_MODAL_HEADER_BG_CLASS
          )}
        >
          <div>
            <h2 id="open-confirmations-title" className="text-lg font-semibold text-foreground">
              {t("shiftConfirmation.panel.title")}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{t("shiftConfirmation.panel.hint")}</p>
          </div>
          <IconButton type="button" aria-label={t("common.close")} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="flex gap-1 border-b border-border px-3 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-subtle hover:text-foreground"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className="ml-1 tabular-nums text-muted">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-2", MODAL_SCROLLBAR_CLASS)}>
          {visibleShifts.length === 0 ? (
            <p className="px-1 py-6 text-sm text-muted">{t("shiftConfirmation.panel.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {visibleShifts.map((shift) => (
                <li
                  key={shift.id}
                  className="rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {shift.employeeName}
                      </p>
                      <p className="text-xs text-muted">
                        {shift.shift_date} · {shift.startTime}–{shift.endTime}
                      </p>
                      {shift.shiftName ? (
                        <p className="truncate text-xs text-muted">{shift.shiftName}</p>
                      ) : null}
                      {shift.confirmationStatus ? (
                        <p className="mt-1 text-xs text-muted">
                          {t(shiftConfirmationStatusLabelKey(shift.confirmationStatus))}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: shift.color }}
                      aria-hidden
                    />
                  </div>

                  <div className="mt-2 flex justify-end gap-2">
                    {activeTab === "proposed" && onSendConfirmation ? (
                      <Button type="button" size="sm" variant="outline" onClick={onSendConfirmation}>
                        {t("shiftConfirmation.actions.requestConfirmation")}
                      </Button>
                    ) : null}
                    {activeTab !== "proposed" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onReassign(shift)}
                      >
                        {t("shiftConfirmation.panel.reassign")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
