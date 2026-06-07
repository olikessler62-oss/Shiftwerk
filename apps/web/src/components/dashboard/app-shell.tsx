"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/sign-out";
import { Button, IconButton } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { SidebarNav } from "./sidebar-nav";

interface AppShellProps {
  orgName?: string;
  userName?: string;
  role?: string;
  children: React.ReactNode;
}

export function AppShell({ orgName, userName, role, children }: AppShellProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden">
      <div
        ref={sidebarRef}
        className="relative flex w-56 shrink-0 flex-col border-r border-border bg-surface"
      >
        <div className="flex items-center gap-2 px-3 py-4">
          <div className="grid h-9 w-9 shrink-0 grid-cols-2 gap-0.5 rounded-lg bg-primary p-1">
            <span className="rounded-sm bg-primary-foreground/90" />
            <span className="rounded-sm bg-primary-foreground/60" />
            <span className="rounded-sm bg-primary-foreground/60" />
            <span className="rounded-sm bg-primary-foreground/90" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Schichtwerk</p>
            {orgName && (
              <p className="truncate text-xs text-muted leading-tight">{orgName}</p>
            )}
          </div>

          <IconButton
            size="sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
          >
            {open ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </IconButton>
        </div>

        {open && (
          <div className="flex flex-col border-t border-border">
            <Suspense
              fallback={
                <nav className="p-2 text-sm text-muted">{t("common.loading")}</nav>
              }
            >
              <SidebarNav onNavigate={() => setOpen(false)} />
            </Suspense>

            <div className="mt-auto border-t border-border p-2">
              <p className="px-3 py-1.5 text-xs text-muted">
                {userName} ·{" "}
                {role === "admin"
                  ? t("common.admin")
                  : role === "manager"
                    ? t("common.manager")
                    : t("common.basic")}
              </p>
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  className="h-auto w-full justify-start px-3 py-2 text-sm font-normal"
                >
                  {t("common.signOut")}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
