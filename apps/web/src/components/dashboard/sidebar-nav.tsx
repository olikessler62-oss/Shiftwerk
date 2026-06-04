"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/planung", label: "Planung" },
  { href: "/team", label: "Team" },
  { href: "/abwesenheiten", label: "Abwesenheiten" },
  { href: "/berichte", label: "Berichte" },
] as const;

const SETTINGS_SECTION_ID = "einstellungen";

const navItemClass = (active: boolean) =>
  cn(
    "block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
    active
      ? "bg-background font-medium text-foreground"
      : "text-foreground hover:bg-background"
  );

type Props = {
  onNavigate?: () => void;
};

export function SidebarNav({ onNavigate }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const schichtartenOpen = searchParams.get("schichtarten") === "1";
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    [SETTINGS_SECTION_ID]: schichtartenOpen,
  });

  useEffect(() => {
    if (schichtartenOpen) {
      setExpanded((prev) => ({ ...prev, [SETTINGS_SECTION_ID]: true }));
    }
  }, [schichtartenOpen]);

  const settingsExpanded = expanded[SETTINGS_SECTION_ID] ?? false;

  function toggleSection(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function buildSchichtartenUrl() {
    const params = new URLSearchParams({ schichtarten: "1" });
    if (pathname === "/dashboard") {
      const week = searchParams.get("week");
      if (week) params.set("week", week);
    }
    return `/dashboard?${params.toString()}`;
  }

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV_LINKS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={navItemClass(pathname === item.href)}
        >
          {item.label}
        </Link>
      ))}

      <div>
        <button
          type="button"
          onClick={() => toggleSection(SETTINGS_SECTION_ID)}
          aria-expanded={settingsExpanded}
          className={cn(
            navItemClass(settingsExpanded || schichtartenOpen),
            "flex items-center justify-between"
          )}
        >
          <span>Einstellungen</span>
          <Chevron open={settingsExpanded} />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            settingsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <Link
              href={buildSchichtartenUrl()}
              onClick={onNavigate}
              className={cn(
                "mt-0.5 block rounded-lg py-2 pl-8 pr-3 text-sm transition-colors",
                schichtartenOpen
                  ? "bg-subtle font-medium text-foreground"
                  : "text-muted hover:bg-background hover:text-foreground"
              )}
            >
              Schichtarten
            </Link>
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
