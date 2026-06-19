"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Profile, ProfileRecurringAvailability } from "@schichtwerk/types";
import { isOvernightAvailability } from "@schichtwerk/database";
import { fetchOverviewAvailabilities } from "@/app/actions/overview-availabilities";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsEmptyState,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsListItemAttrs,
  settingsModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsModalRootClass,
  settingsScrollableTableListClass,
  settingsStickyColumnHeaderClass,
  OVERVIEW_ABSENCES_LIST_SCROLL_CLASS,
} from "@/components/settings/settings-list-ui";
import { Button, CloseIcon, IconButton } from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  buildOverviewAvailabilityDisplayRows,
  buildOverviewAvailabilityEmployeeJumpOptions,
  countOverviewAvailabilityEmployees,
} from "@/lib/overview-availabilities-display";
import { useScrollToSettingsListItem } from "@/lib/settings-list-scroll";
import { OverviewAvailabilitiesEmployeeJumpCombobox } from "./overview-availabilities-employee-jump-combobox";
import {
  formatAvailabilityTimeRange,
  weekdayLabel,
} from "@/lib/profile-availability-label";

type Props = {
  onClose: () => void;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OverviewAvailabilitiesModal({ onClose }: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [availability, setAvailability] = useState<ProfileRecurringAvailability[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const result = await fetchOverviewAvailabilities();
    if (!result.ok) {
      setErrorMessage(result.error);
      setLoading(false);
      return;
    }

    setProfiles(result.profiles);
    setAvailability(result.availability);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [loading]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(
    () =>
      buildOverviewAvailabilityDisplayRows({
        availability,
        profiles,
        todayISO: todayISO(),
      }),
    [availability, profiles]
  );

  const employeeCount = useMemo(
    () => countOverviewAvailabilityEmployees(rows),
    [rows]
  );
  const employeeJumpOptions = useMemo(
    () => buildOverviewAvailabilityEmployeeJumpOptions(profiles, rows),
    [profiles, rows]
  );
  const enableScroll = employeeCount >= 10;

  useScrollToSettingsListItem(rows, scrollToItemId, () => setScrollToItemId(null), "top");

  function handleJumpToEmployee(_employeeId: string, firstRowId: string | null) {
    if (firstRowId) setScrollToItemId(firstRowId);
  }

  function dayLabel(row: (typeof rows)[number]): string {
    if (
      isOvernightAvailability(row.startTime, row.endTime) &&
      row.weekday !== 7
    ) {
      const startDay = weekdayLabel(row.weekday, locale, "long");
      const endDay = weekdayLabel((row.weekday + 1) % 7, locale, "long");
      return locale === "en" ? `${startDay} – ${endDay}` : `${startDay} – ${endDay}`;
    }
    return weekdayLabel(row.weekday, locale, "long");
  }

  return (
    <div
      className={cn(settingsModalBackdropClass(), loading && "cursor-wait")}
      role="presentation"
      aria-busy={loading}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      {!loading ? (
        <div
          className={settingsModalRootClass("3xl")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="overview-availabilities-modal-title"
            className={settingsModalDialogClass()}
          >
            <div
              className={cn(
                "flex items-center justify-between border-b border-border",
                settingsModalHeaderPaddingClass()
              )}
            >
              <h2
                id="overview-availabilities-modal-title"
                className={SETTINGS_MODAL_TITLE_CLASS}
              >
                {t("overview.availabilities.title")}
              </h2>
              <IconButton
                size="sm"
                onClick={onClose}
                aria-label={t("common.close")}
                className="border-transparent bg-transparent hover:bg-subtle"
              >
                <CloseIcon className="h-[18px] w-[18px]" />
              </IconButton>
            </div>

            <div className={cn(settingsModalBodyPaddingClass(), "bg-background")}>
              {errorMessage ? (
                <p className="mb-3 text-sm text-red-700">{errorMessage}</p>
              ) : null}

              <div className="flex flex-col rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
                <div className="relative z-30 flex shrink-0 items-center justify-between gap-3 overflow-visible border-b border-border bg-subtle px-3 py-2.5">
                  <h3 className="min-w-0 truncate text-sm font-medium text-foreground">
                    {t("overview.availabilities.listTitle")}
                  </h3>
                  <OverviewAvailabilitiesEmployeeJumpCombobox
                    options={employeeJumpOptions}
                    onJump={handleJumpToEmployee}
                    className="w-56 shrink-0"
                  />
                </div>

                <div className="min-h-0 overflow-hidden bg-background px-2 py-2">
                  {rows.length === 0 ? (
                    <SettingsEmptyState message={t("overview.availabilities.emptyList")} />
                  ) : (
                    <div
                      className={cn(
                        settingsScrollableTableListClass(),
                        enableScroll && OVERVIEW_ABSENCES_LIST_SCROLL_CLASS
                      )}
                    >
                      <table className="w-full min-w-[28rem] border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.employee")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("overview.availabilities.day")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("overview.availabilities.time")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr
                              key={row.id}
                              {...settingsListItemAttrs(row.id)}
                              className={settingsDataRowClass(false)}
                            >
                              <td className={settingsDataCellClass(false)}>
                                {row.showEmployeeName ? (
                                  <span className="flex min-w-0 items-center gap-2">
                                    {row.employeeColor ? (
                                      <span
                                        className="size-3 shrink-0 rounded-full border border-border/60"
                                        style={{ backgroundColor: row.employeeColor }}
                                        aria-hidden
                                      />
                                    ) : null}
                                    <span className="truncate font-medium">
                                      {row.employeeName}
                                    </span>
                                  </span>
                                ) : null}
                              </td>
                              <td className={settingsDataCellClass(false)}>
                                {dayLabel(row)}
                              </td>
                              <td className={settingsDataCellClass(false)}>
                                {formatAvailabilityTimeRange(
                                  row.startTime,
                                  row.endTime,
                                  locale
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={settingsModalFooterClass()}>
              <Button type="button" variant="outline" onClick={onClose}>
                <CloseIcon />
                {t("common.close")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
