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
import { useOrgFeatures } from "@/lib/org-features-provider";
import {
  buildPlanningPageUrl,
} from "@/lib/planning-week";
import { useBeginMainNavPending } from "@/lib/app-shell-main-nav-pending";
import { useSuperadminModal } from "@/components/settings/superadmin-modal-context";

const NAV_LINKS_AFTER_PLANNING = [
  { href: "/berichte", labelKey: "nav.reports" },
] as const;

function buildOverviewLinks(includeQualifications: boolean) {
  return [
    {
      kind: "modal" as const,
      flag: "uebersichtAbwesenheiten" as const,
      labelKey: "nav.overviewAbsences",
    },
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

const PLANNING_SECTION_ID = "planung";
const OVERVIEW_SECTION_ID = "uebersicht";
const SETTINGS_SECTION_ID = "einstellungen";

const navItemClass = (active: boolean) =>
  cn(
    "block w-full rounded-lg border-l-2 py-2 pl-[calc(0.75rem-2px)] pr-3 text-left text-sm transition-colors",
    active
      ? "border-l-primary bg-primary/5 font-medium text-foreground"
      : "border-l-transparent text-foreground hover:bg-primary/5"
  );

const subLinkClass = (active: boolean) =>
  cn(
    "block w-full rounded-lg border-l-2 py-2 pl-[calc(2rem-2px)] pr-3 text-left text-sm transition-colors",
    active
      ? "border-l-primary bg-primary/5 font-medium text-foreground"
      : "border-l-transparent text-muted hover:bg-primary/5 hover:text-foreground"
  );

const subLinkButtonClass =
  "block w-full rounded-lg border-l-2 border-l-transparent py-2 pl-[calc(2rem-2px)] pr-3 text-left text-sm text-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50";

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
  const areaCalendarActive = pathname === "/bereich-kalender";
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
  const overviewLinks = buildOverviewLinks(features.qualifications);
  const standorteOpen = searchParams.get("standorte") === "1";
  const profilesOpen = searchParams.get("profiles") === "1";
  const rollenOpen = searchParams.get("rollen") === "1";
  const qualifikationenOpen = searchParams.get("qualifikationen") === "1";
  const sonderzuschlaegeOpen = searchParams.get("sonderzuschlaege") === "1";
  const abwesenheitenOpen = searchParams.get("abwesenheiten") === "1";
  const { open: superadminOpen, openSuperadminModal } = useSuperadminModal();
  const beginMainNavPending = useBeginMainNavPending();
  const settingsModalOpen =
    standorteOpen ||
    profilesOpen ||
    rollenOpen ||
    qualifikationenOpen ||
    sonderzuschlaegeOpen ||
    abwesenheitenOpen;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    [PLANNING_SECTION_ID]: areaCalendarActive,
    [OVERVIEW_SECTION_ID]: overviewActive,
    [SETTINGS_SECTION_ID]: settingsModalOpen,
  });

  useEffect(() => {
    if (areaCalendarActive) {
      setExpanded((prev) => ({ ...prev, [PLANNING_SECTION_ID]: true }));
    }
  }, [areaCalendarActive]);

  useEffect(() => {
    if (overviewActive) {
      setExpanded((prev) => ({ ...prev, [OVERVIEW_SECTION_ID]: true }));
    }
  }, [overviewActive]);

  useEffect(() => {
    if (settingsModalOpen) {
      setExpanded((prev) => ({ ...prev, [SETTINGS_SECTION_ID]: true }));
    }
  }, [settingsModalOpen]);

  const planningExpanded = expanded[PLANNING_SECTION_ID] ?? false;
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

  const planningPrimaryActions = [
    { labelKey: "nav.planningApplyPreviousWeek" },
    { labelKey: "nav.planningCreateEmpty" },
  ] as const;

  const planningExportActions = [
    { labelKey: "nav.planningExportPdf" },
    { labelKey: "nav.planningExportExcel" },
    { labelKey: "nav.planningNotifyStaff" },
  ] as const;

  function handlePageNav(pathname: string) {
    beginMainNavPending({ kind: "page", pathname });
    onNavigate?.();
  }

  const dashboardHref = buildPlanningPageUrl("/dashboard", searchParams);
  const areaCalendarHref = buildPlanningPageUrl("/bereich-kalender", searchParams);

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
    <nav className="flex flex-col gap-0.5 p-2">
      <Link
        href={dashboardHref}
        onClick={() => handlePageNav("/dashboard")}
        className={navItemClass(pathname === "/dashboard")}
      >
        {t("nav.dashboard")}
      </Link>

      <div>
        <div
          className={cn(
            navItemClass(areaCalendarActive || planningExpanded),
            "flex items-center justify-between gap-1 pr-1"
          )}
        >
          <Link
            href={areaCalendarHref}
            onClick={() => handlePageNav("/bereich-kalender")}
            className="min-w-0 flex-1"
          >
            {t("nav.planning")}
          </Link>
          <button
            type="button"
            onClick={() => toggleSection(PLANNING_SECTION_ID)}
            aria-expanded={planningExpanded}
            aria-label={t("nav.planning")}
            className="shrink-0 rounded p-1 text-muted hover:bg-primary/5 hover:text-foreground"
          >
            <Chevron open={planningExpanded} />
          </button>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            planningExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            {planningPrimaryActions.map((item, index) => (
              <button
                key={item.labelKey}
                type="button"
                disabled
                className={cn(subLinkButtonClass, index === 0 && "mt-0.5")}
              >
                {t(item.labelKey)}
              </button>
            ))}
            <div
              className="mx-3 my-1 border-t border-border"
              role="separator"
              aria-hidden
            />
            {planningExportActions.map((item) => (
              <button
                key={item.labelKey}
                type="button"
                disabled
                className={subLinkButtonClass}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {NAV_LINKS_AFTER_PLANNING.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => handlePageNav(item.href)}
          className={navItemClass(pathname === item.href)}
        >
          {t(item.labelKey)}
        </Link>
      ))}

      <div>
        <button
          type="button"
          onClick={() => toggleSection(OVERVIEW_SECTION_ID)}
          aria-expanded={overviewExpanded}
          className={cn(
            navItemClass(overviewExpanded || overviewActive),
            "flex items-center justify-between"
          )}
        >
          <span>{t("nav.overview")}</span>
          <Chevron open={overviewExpanded} />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            overviewExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            {overviewLinks.map((item, index) => (
                <Link
                  key={item.flag}
                  href={buildOverviewModalUrl(item.flag)}
                  onClick={() => handleOverviewNav(item.flag)}
                  className={cn(
                    subLinkClass(isOverviewModalLinkOpen(item.flag)),
                    index === 0 && "mt-0.5"
                  )}
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
            navItemClass(settingsExpanded || settingsModalOpen),
            "flex items-center justify-between"
          )}
        >
          <span>{t("nav.settings")}</span>
          <Chevron open={settingsExpanded} />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            settingsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            {settingsLinks.map((item, index) => (
              <Link
                key={item.flag}
                href={buildSettingsModalUrl(item.flag)}
                onClick={() => handleSettingsNav(item.flag)}
                className={cn(settingsSubLinkClass(item.open), index === 0 && "mt-0.5")}
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
            "h-auto w-full justify-start font-normal"
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
