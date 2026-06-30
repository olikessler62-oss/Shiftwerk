"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/sign-out";
import { Button } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  buildSettingsModalUrl as buildSettingsModalUrlFromLib,
  type SettingsModalQueryFlag,
} from "@/lib/settings-modal-navigation";
import {
  buildOverviewModalUrl as buildOverviewModalUrlFromLib,
  type OverviewModalQueryFlag,
} from "@/lib/overview-modal-navigation";
import { COMPENSATION_SURCHARGES_UI_ENABLED } from "@/lib/compensation-surcharges-feature";
import { useOrgFeatures, useShowCompensationInPlanningUi } from "@/lib/org-features-provider";
import {
  buildPlanningPageUrl,
} from "@/lib/planning-week";
import { useBeginMainNavPending } from "@/lib/app-shell-main-nav-pending";
import { useSuperadminModal } from "@/components/settings/superadmin-modal-context";

function buildOverviewLinks(
  includeQualifications: boolean,
  showCompensationInPlanningUi: boolean
) {
  return [
    {
      kind: "modal" as const,
      flag: "uebersichtAbwesenheiten" as const,
      labelKey: "nav.overviewAbsences",
    },
    ...(showCompensationInPlanningUi
      ? [
          {
            kind: "modal" as const,
            flag: "uebersichtEntgelt" as const,
            labelKey: "nav.overviewCompensation",
          },
          ...(COMPENSATION_SURCHARGES_UI_ENABLED
            ? [
                {
                  kind: "modal" as const,
                  flag: "uebersichtZuschlaege" as const,
                  labelKey: "nav.overviewSurcharges" as const,
                },
              ]
            : []),
        ]
      : []),
    {
      kind: "modal" as const,
      flag: "uebersichtVerfuegbarkeiten" as const,
      labelKey: "nav.overviewAvailabilities",
    },
    {
      kind: "modal" as const,
      flag: "uebersichtWuensche" as const,
      labelKey: "nav.overviewPreferences",
    },
    ...(includeQualifications
      ? [
          {
            kind: "modal" as const,
            flag: "uebersichtTaetigkeiten" as const,
            labelKey: "nav.overviewQualifications" as const,
          },
        ]
      : []),
  ] as const;
}

const OVERVIEW_SECTION_ID = "uebersicht";
const CALENDAR_SECTION_ID = "kalender";
const SETTINGS_SECTION_ID = "einstellungen";

const navItemClass = (active: boolean) =>
  cn(
    "block w-full min-w-0 rounded-none border-l-2 py-2 pl-[calc(0.75rem-2px)] pr-3 text-left text-sm font-medium leading-snug transition-colors",
    active
      ? "border-l-primary bg-white/[0.16] text-foreground"
      : "border-l-transparent text-foreground hover:bg-white/[0.12]"
  );

const subLinkClass = (active: boolean) =>
  cn(
    "block w-full min-w-0 rounded-none border-l-2 py-1.5 pl-[calc(2rem-2px)] pr-3 text-left text-sm font-medium leading-snug transition-colors",
    active
      ? "border-l-primary bg-white/[0.16] text-foreground"
      : "border-l-transparent text-muted hover:bg-white/[0.12] hover:text-foreground"
  );

const settingsSubLinkClass = subLinkClass;

type Props = {
  onNavigate?: () => void;
  viewerRole?: string;
  superadminEnabled?: boolean;
};

export function SidebarNav({ onNavigate, viewerRole, superadminEnabled = false }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const features = useOrgFeatures();
  const showCompensationInPlanningUi = useShowCompensationInPlanningUi();
  const areaCalendarActive = pathname === "/bereich-kalender";
  const employeeCalendarActive = pathname === "/mitarbeiter-kalender";
  const calendarActive = areaCalendarActive || employeeCalendarActive;
  const overviewActive =
    pathname.startsWith("/uebersicht") ||
    searchParams.get("uebersichtAbwesenheiten") === "1" ||
    searchParams.get("uebersichtVerfuegbarkeiten") === "1" ||
    searchParams.get("uebersichtWuensche") === "1" ||
    searchParams.get("uebersichtEntgelt") === "1" ||
    searchParams.get("uebersichtZuschlaege") === "1" ||
    searchParams.get("uebersichtTaetigkeiten") === "1";
  const overviewAbsencesOpen = searchParams.get("uebersichtAbwesenheiten") === "1";
  const overviewAvailabilitiesOpen =
    searchParams.get("uebersichtVerfuegbarkeiten") === "1";
  const overviewPreferencesOpen = searchParams.get("uebersichtWuensche") === "1";
  const overviewCompensationOpen = searchParams.get("uebersichtEntgelt") === "1";
  const overviewSurchargesOpen = searchParams.get("uebersichtZuschlaege") === "1";
  const overviewQualificationsOpen = searchParams.get("uebersichtTaetigkeiten") === "1";
  const overviewLinks = buildOverviewLinks(
    features.qualifications,
    showCompensationInPlanningUi
  );
  const standorteOpen = searchParams.get("standorte") === "1";
  const allgemeinOpen = searchParams.get("allgemein") === "1";
  const profilesOpen = searchParams.get("profiles") === "1";
  const rollenOpen = searchParams.get("rollen") === "1";
  const qualifikationenOpen = searchParams.get("qualifikationen") === "1";
  const sonderzuschlaegeOpen = searchParams.get("sonderzuschlaege") === "1";
  const abwesenheitenOpen = searchParams.get("abwesenheiten") === "1";
  const { open: superadminOpen, openSuperadminModal } = useSuperadminModal();
  const beginMainNavPending = useBeginMainNavPending();
  const settingsModalOpen =
    allgemeinOpen ||
    standorteOpen ||
    profilesOpen ||
    rollenOpen ||
    qualifikationenOpen ||
    sonderzuschlaegeOpen ||
    abwesenheitenOpen;
  const dashboardActive =
    pathname === "/dashboard" &&
    !calendarActive &&
    !overviewActive &&
    !settingsModalOpen &&
    !superadminOpen;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    [CALENDAR_SECTION_ID]: calendarActive,
    [OVERVIEW_SECTION_ID]: overviewActive,
    [SETTINGS_SECTION_ID]: settingsModalOpen,
  });

  useEffect(() => {
    setExpanded((prev) => ({
      ...prev,
      [CALENDAR_SECTION_ID]: calendarActive,
    }));
  }, [calendarActive]);

  useEffect(() => {
    setExpanded((prev) => ({
      ...prev,
      [OVERVIEW_SECTION_ID]: overviewActive,
    }));
  }, [overviewActive]);

  useEffect(() => {
    setExpanded((prev) => ({
      ...prev,
      [SETTINGS_SECTION_ID]: settingsModalOpen,
    }));
  }, [settingsModalOpen]);

  const calendarExpanded = expanded[CALENDAR_SECTION_ID] ?? false;
  const overviewExpanded = expanded[OVERVIEW_SECTION_ID] ?? false;
  const settingsExpanded = expanded[SETTINGS_SECTION_ID] ?? false;

  function toggleSection(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function buildSettingsModalUrl(flag: SettingsModalQueryFlag) {
    return buildSettingsModalUrlFromLib(pathname, searchParams, flag);
  }

  function buildOverviewModalUrl(flag: OverviewModalQueryFlag) {
    return buildOverviewModalUrlFromLib(pathname, searchParams, flag);
  }

  const settingsLinks = [
    {
      flag: "allgemein" as const,
      labelKey: "nav.compensationSettings",
      open: allgemeinOpen,
    },
    ...(features.areas
      ? [{ flag: "standorte" as const, labelKey: "nav.locations", open: standorteOpen }]
      : []),
    { flag: "profiles" as const, labelKey: "nav.profiles", open: profilesOpen },
    { flag: "rollen" as const, labelKey: "nav.roles", open: rollenOpen },
    ...(features.qualifications
      ? [
          {
            flag: "qualifikationen" as const,
            labelKey: "nav.qualifications",
            open: qualifikationenOpen,
          },
        ]
      : []),
    ...(COMPENSATION_SURCHARGES_UI_ENABLED
      ? [
          {
            flag: "sonderzuschlaege" as const,
            labelKey: "nav.surcharges" as const,
            open: sonderzuschlaegeOpen,
          },
        ]
      : []),
    {
      flag: "abwesenheiten" as const,
      labelKey: "nav.absences",
      open: abwesenheitenOpen,
    },
  ];

  function handlePageNav(pathname: string) {
    beginMainNavPending({ kind: "page", pathname });
    onNavigate?.();
  }

  const dashboardHref = buildPlanningPageUrl("/dashboard", searchParams);
  const areaCalendarHref = buildPlanningPageUrl("/bereich-kalender", searchParams);
  const employeeCalendarHref = buildPlanningPageUrl(
    "/mitarbeiter-kalender",
    searchParams
  );

  function handleSettingsNav(flag: SettingsModalQueryFlag) {
    beginMainNavPending({ kind: "settings-modal", flag });
    onNavigate?.();
  }

  function handleOverviewNav(flag: OverviewModalQueryFlag) {
    beginMainNavPending({ kind: "overview-modal", flag });
    onNavigate?.();
  }

  function isOverviewModalLinkOpen(flag: OverviewModalQueryFlag): boolean {
    if (flag === "uebersichtAbwesenheiten") return overviewAbsencesOpen;
    if (flag === "uebersichtVerfuegbarkeiten") return overviewAvailabilitiesOpen;
    if (flag === "uebersichtWuensche") return overviewPreferencesOpen;
    if (flag === "uebersichtEntgelt") return overviewCompensationOpen;
    if (flag === "uebersichtZuschlaege") return overviewSurchargesOpen;
    if (flag === "uebersichtTaetigkeiten") return overviewQualificationsOpen;
    return searchParams.get(flag) === "1";
  }

  return (
    <nav className="app-shell-sidebar-nav-slot flex w-full shrink-0 flex-col gap-0.5 py-2">
      <Link
        href={dashboardHref}
        onClick={() => handlePageNav("/dashboard")}
        className={navItemClass(dashboardActive)}
      >
        {t("nav.dashboard")}
      </Link>

      <div>
        <button
          type="button"
          onClick={() => toggleSection(CALENDAR_SECTION_ID)}
          aria-expanded={calendarExpanded}
          className={cn(
            navItemClass(calendarActive),
            "flex min-w-0 items-center justify-between gap-1"
          )}
        >
          <span className="min-w-0 truncate">{t("nav.calendar")}</span>
          <Chevron open={calendarExpanded} />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            calendarExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden space-y-0.5 pt-0.5">
            <Link
              href={employeeCalendarHref}
              onClick={() => handlePageNav("/mitarbeiter-kalender")}
              className={subLinkClass(employeeCalendarActive)}
            >
              {t("nav.employeeCalendar")}
            </Link>
            <Link
              href={areaCalendarHref}
              onClick={() => handlePageNav("/bereich-kalender")}
              className={subLinkClass(areaCalendarActive)}
            >
              {t("nav.areaCalendar")}
            </Link>
          </div>
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={() => toggleSection(OVERVIEW_SECTION_ID)}
          aria-expanded={overviewExpanded}
          className={cn(
            navItemClass(overviewActive),
            "flex min-w-0 items-center justify-between gap-1"
          )}
        >
          <span className="min-w-0 truncate">{t("nav.overview")}</span>
          <Chevron open={overviewExpanded} />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            overviewExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden space-y-0.5 pt-0.5">
            {overviewLinks.map((item) => (
                <Link
                  key={item.flag}
                  href={buildOverviewModalUrl(item.flag)}
                  onClick={() => handleOverviewNav(item.flag)}
                  className={subLinkClass(isOverviewModalLinkOpen(item.flag))}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
          </div>
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={() => toggleSection(SETTINGS_SECTION_ID)}
          aria-expanded={settingsExpanded}
          className={cn(
            navItemClass(settingsModalOpen),
            "flex min-w-0 items-center justify-between gap-1"
          )}
        >
          <span className="min-w-0 truncate">{t("nav.settings")}</span>
          <Chevron open={settingsExpanded} />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            settingsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden space-y-0.5 pt-0.5">
            {settingsLinks.map((item) => (
              <Link
                key={item.flag}
                href={buildSettingsModalUrl(item.flag)}
                onClick={() => handleSettingsNav(item.flag)}
                className={settingsSubLinkClass(item.open)}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {superadminEnabled ? (
        <button
          type="button"
          onClick={() => {
            beginMainNavPending({ kind: "superadmin" });
            openSuperadminModal();
            onNavigate?.();
          }}
          className={navItemClass(superadminOpen)}
        >
          {t("nav.superadmin")}
        </button>
      ) : null}
      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          className={cn(
            navItemClass(false),
            "!rounded-none h-auto w-full justify-start font-normal"
          )}
        >
          {t("common.signOut")}
        </Button>
      </form>
    </nav>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn(
        "shrink-0 text-muted transition-transform duration-200",
        open && "rotate-180"
      )}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
