"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  buildSettingsModalUrl as buildSettingsModalUrlFromLib,
  isSettingsModalOpen,
} from "@/lib/settings-modal-navigation";
import { COMPENSATION_SURCHARGES_UI_ENABLED } from "@/lib/compensation-surcharges-feature";
import { useOrgFeatures, useOrganization } from "@/lib/org-features-provider";

const NAV_LINKS_AFTER_PLANNING = [
  { href: "/berichte", labelKey: "nav.reports" },
] as const;

const PLANNING_SECTION_ID = "planung";
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
};

export function SidebarNav({ onNavigate, viewerRole }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const features = useOrgFeatures();
  const organization = useOrganization();
  const planungActive = pathname === "/planung";
  const outboxPath = "/settings/notifications-outbox";
  const outboxActive = pathname === outboxPath;
  const showOutboxLink =
    organization.shift_confirmation_enabled &&
    (viewerRole === "admin" || process.env.NODE_ENV === "development");
  const standorteOpen = searchParams.get("standorte") === "1";
  const profilesOpen = searchParams.get("profiles") === "1";
  const rollenOpen = searchParams.get("rollen") === "1";
  const qualifikationenOpen = searchParams.get("qualifikationen") === "1";
  const sonderzuschlaegeOpen = searchParams.get("sonderzuschlaege") === "1";
  const abwesenheitenOpen = searchParams.get("abwesenheiten") === "1";
  const planungsmodusOpen = searchParams.get("planungsmodus") === "1";
  const arbeitsentgeltOpen = searchParams.get("arbeitsentgelt") === "1";
  const settingsModalOpen =
    isSettingsModalOpen(searchParams) || outboxActive;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    [PLANNING_SECTION_ID]: planungActive,
    [SETTINGS_SECTION_ID]: settingsModalOpen,
  });

  useEffect(() => {
    if (planungActive) {
      setExpanded((prev) => ({ ...prev, [PLANNING_SECTION_ID]: true }));
    }
  }, [planungActive]);

  useEffect(() => {
    if (settingsModalOpen) {
      setExpanded((prev) => ({ ...prev, [SETTINGS_SECTION_ID]: true }));
    }
  }, [settingsModalOpen]);

  const planningExpanded = expanded[PLANNING_SECTION_ID] ?? false;
  const settingsExpanded = expanded[SETTINGS_SECTION_ID] ?? false;

  function toggleSection(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function buildSettingsModalUrl(
    flag:
      | "standorte"
      | "profiles"
      | "rollen"
      | "qualifikationen"
      | "sonderzuschlaege"
      | "abwesenheiten"
      | "planungsmodus"
      | "arbeitsentgelt"
  ) {
    return buildSettingsModalUrlFromLib(pathname, searchParams, flag);
  }

  const settingsLinks = [
    {
      flag: "planungsmodus" as const,
      labelKey: "nav.planningMode",
      open: planungsmodusOpen,
    },
    {
      flag: "arbeitsentgelt" as const,
      labelKey: "nav.compensationSettings",
      open: arbeitsentgeltOpen,
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
    ...(features.qualifications && COMPENSATION_SURCHARGES_UI_ENABLED
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

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={navItemClass(pathname === "/dashboard")}
      >
        {t("nav.dashboard")}
      </Link>

      <div>
        <div
          className={cn(
            navItemClass(planungActive || planningExpanded),
            "flex items-center justify-between gap-1 pr-1"
          )}
        >
          <Link href="/planung" onClick={onNavigate} className="min-w-0 flex-1">
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
          onClick={onNavigate}
          className={navItemClass(pathname === item.href)}
        >
          {t(item.labelKey)}
        </Link>
      ))}

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
                onClick={onNavigate}
                className={cn(settingsSubLinkClass(item.open), index === 0 && "mt-0.5")}
              >
                {t(item.labelKey)}
              </Link>
            ))}
            {showOutboxLink ? (
              <Link
                href={outboxPath}
                onClick={onNavigate}
                className={settingsSubLinkClass(outboxActive)}
              >
                {t("nav.notificationOutbox")}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
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
