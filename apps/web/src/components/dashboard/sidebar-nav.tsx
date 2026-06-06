"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/planung", labelKey: "nav.planning" },
  { href: "/abwesenheiten", labelKey: "nav.absences" },
  { href: "/berichte", labelKey: "nav.reports" },
] as const;

const SETTINGS_SECTION_ID = "einstellungen";

const navItemClass = (active: boolean) =>
  cn(
    "block w-full rounded-lg border-l-2 py-2 pl-[calc(0.75rem-2px)] pr-3 text-left text-sm transition-colors",
    active
      ? "border-l-primary bg-primary/5 font-medium text-foreground"
      : "border-l-transparent text-foreground hover:bg-primary/5"
  );

const settingsSubLinkClass = (active: boolean) =>
  cn(
    "block rounded-lg border-l-2 py-2 pl-[calc(2rem-2px)] pr-3 text-sm transition-colors",
    active
      ? "border-l-primary bg-primary/5 font-medium text-foreground"
      : "border-l-transparent text-muted hover:bg-primary/5 hover:text-foreground"
  );

type Props = {
  onNavigate?: () => void;
};

export function SidebarNav({ onNavigate }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const standorteOpen = searchParams.get("standorte") === "1";
  const profilesOpen = searchParams.get("profiles") === "1";
  const rollenOpen = searchParams.get("rollen") === "1";
  const schichtartenOpen = searchParams.get("schichtarten") === "1";
  const qualifikationenOpen = searchParams.get("qualifikationen") === "1";
  const settingsModalOpen =
    standorteOpen ||
    profilesOpen ||
    rollenOpen ||
    schichtartenOpen ||
    qualifikationenOpen;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    [SETTINGS_SECTION_ID]: settingsModalOpen,
  });

  useEffect(() => {
    if (settingsModalOpen) {
      setExpanded((prev) => ({ ...prev, [SETTINGS_SECTION_ID]: true }));
    }
  }, [settingsModalOpen]);

  const settingsExpanded = expanded[SETTINGS_SECTION_ID] ?? false;

  function toggleSection(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function buildSettingsModalUrl(
    flag:
      | "standorte"
      | "profiles"
      | "rollen"
      | "schichtarten"
      | "qualifikationen"
  ) {
    const params = new URLSearchParams({ [flag]: "1" });
    if (pathname === "/dashboard") {
      const week = searchParams.get("week");
      const location = searchParams.get("location");
      if (week) params.set("week", week);
      if (location) params.set("location", location);
    }
    return `/dashboard?${params.toString()}`;
  }

  const settingsLinks = [
    { flag: "schichtarten" as const, labelKey: "nav.shiftTypes", open: schichtartenOpen },
    { flag: "standorte" as const, labelKey: "nav.locations", open: standorteOpen },
    { flag: "profiles" as const, labelKey: "nav.profiles", open: profilesOpen },
    { flag: "rollen" as const, labelKey: "nav.roles", open: rollenOpen },
    {
      flag: "qualifikationen" as const,
      labelKey: "nav.qualifications",
      open: qualifikationenOpen,
    },
  ];

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV_LINKS.map((item) => (
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
