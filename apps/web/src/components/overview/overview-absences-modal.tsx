"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AbsenceRequest, AbsenceType, Profile, RequestStatus } from "@schichtwerk/types";
import { fetchOrganizationAbsences } from "@/app/actions/absences";
import { fetchOverviewAbsencesProfiles } from "@/app/actions/overview-absences";
import {
  SETTINGS_MODAL_TITLE_CLASS,
  SettingsEmptyState,
  settingsDataCellClass,
  settingsDataRowClass,
  settingsModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsModalRootClass,
  settingsPanelHeaderClass,
  settingsScrollableTableListClass,
  settingsStickyColumnHeaderClass,
  OVERVIEW_ABSENCES_LIST_SCROLL_CLASS,
} from "@/components/settings/settings-list-ui";
import { Button, CloseIcon, IconButton } from "@/components/ui";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { toIntlLocale } from "@/i18n/intl-locale";
import { cn } from "@/lib/cn";
import {
  buildOverviewAbsenceDisplayRows,
  countOverviewAbsenceEmployees,
} from "@/lib/overview-absences-display";

type Props = {
  onClose: () => void;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatEndDateLabel(
  row: { endDate: string | null; isOpenEnded: boolean },
  dateFormatter: Intl.DateTimeFormat,
  openLabel: string
): string {
  if (row.isOpenEnded && !row.endDate) return openLabel;
  if (!row.endDate) return "—";
  return dateFormatter.format(new Date(`${row.endDate}T12:00:00`));
}

export function OverviewAbsencesModal({ onClose }: Props) {
  const t = useTranslations();
  const { locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [absences, setAbsences] = useState<AbsenceRequest[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(toIntlLocale(locale), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const [profilesResult, absencesResult] = await Promise.all([
      fetchOverviewAbsencesProfiles(),
      fetchOrganizationAbsences(),
    ]);

    if (!profilesResult.ok) {
      setErrorMessage(profilesResult.error);
      setLoading(false);
      return;
    }
    if (!absencesResult.ok) {
      setErrorMessage(absencesResult.error);
      setLoading(false);
      return;
    }

    setProfiles(profilesResult.profiles);
    setAbsences(absencesResult.absences);
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
      buildOverviewAbsenceDisplayRows({
        absences,
        profiles,
        todayISO: todayISO(),
      }),
    [absences, profiles]
  );

  const employeeCount = useMemo(() => countOverviewAbsenceEmployees(rows), [rows]);
  const enableScroll = employeeCount >= 10;

  function typeLabel(type: AbsenceType): string {
    switch (type) {
      case "vacation":
        return t("settings.absences.typeVacation");
      case "sick":
        return t("settings.absences.typeSick");
      case "other":
        return t("settings.absences.typeOther");
    }
  }

  function statusLabel(status: RequestStatus): string {
    switch (status) {
      case "pending":
        return t("settings.absences.statusPending");
      case "approved":
        return t("settings.absences.statusApproved");
      case "rejected":
        return t("settings.absences.statusRejected");
      case "cancelled":
        return t("settings.absences.statusCancelled");
    }
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
            aria-labelledby="overview-absences-modal-title"
            className={settingsModalDialogClass()}
          >
            <div
              className={cn(
                "flex items-center justify-between border-b border-border",
                settingsModalHeaderPaddingClass()
              )}
            >
              <h2 id="overview-absences-modal-title" className={SETTINGS_MODAL_TITLE_CLASS}>
                {t("overview.absences.title")}
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

              <div className="flex flex-col overflow-hidden rounded-[var(--radius-control)] border border-border bg-surface shadow-sm ring-1 ring-border/60">
                <h3 className={settingsPanelHeaderClass()}>
                  {t("overview.absences.listTitle")}
                </h3>

                <div className="space-y-1 bg-background px-2 py-2">
                  {rows.length === 0 ? (
                    <SettingsEmptyState message={t("overview.absences.emptyList")} />
                  ) : (
                    <div
                      className={cn(
                        settingsScrollableTableListClass(),
                        enableScroll && OVERVIEW_ABSENCES_LIST_SCROLL_CLASS
                      )}
                    >
                      <table className="w-full min-w-[32rem] border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.employee")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.type")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("overview.absences.period")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("overview.absences.time")}
                            </th>
                            <th className={settingsStickyColumnHeaderClass()}>
                              {t("settings.absences.status")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.id} className={settingsDataRowClass(false)}>
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
                                {typeLabel(row.type)}
                              </td>
                              <td className={settingsDataCellClass(false)}>
                                {dateFormatter.format(new Date(`${row.startDate}T12:00:00`))}
                                {" – "}
                                {formatEndDateLabel(
                                  row,
                                  dateFormatter,
                                  t("settings.absences.openEnded")
                                )}
                              </td>
                              <td className={settingsDataCellClass(false)}>
                                {t("overview.absences.fullDay")}
                              </td>
                              <td className={settingsDataCellClass(false)}>
                                {statusLabel(row.status)}
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
