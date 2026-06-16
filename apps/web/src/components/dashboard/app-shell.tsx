"use client";

// Responsive layout — see apps/web/RESPONSIVE_ROLLBACK.md to revert.

import { useState, useEffect, useRef, Suspense } from "react";
import { usePathname } from "next/navigation";
import { IconButton } from "@/components/ui";
import { PlanningAppSidebarSlotMount } from "@/components/planning/planning-app-sidebar-slot";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/i18n/locale-provider";
import { SidebarNav } from "./sidebar-nav";
import { SettingsModalsAppShellFallback } from "@/components/settings/settings-modals-app-shell-fallback";
import { SuperadminModalProvider } from "@/components/settings/superadmin-modal-context";
import { AppShellModalLockBridge } from "@/components/dashboard/app-shell-modal-lock-bridge";
import {
  AppShellMainNavPendingBridge,
  AppShellMainNavPendingProvider,
} from "@/lib/app-shell-main-nav-pending";
import {
  APP_SHELL_BRAND_HEADER_CLASS,
  APP_SHELL_CONTENT_OFFSET_CLASS,
} from "@/lib/app-shell-layout";
import {
  AppShellControlsGuard,
  AppShellModalLockProvider,
  useIsAppShellLocked,
  useIsAppShellWaitCursor,
} from "@/lib/app-shell-modal-lock";

interface AppShellProps {
  orgName?: string;
  userName?: string;
  role?: string;
  superadminEnabled?: boolean;
  children: React.ReactNode;
}

export function AppShell({
  orgName,
  userName,
  role,
  superadminEnabled = false,
  children,
}: AppShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const showAppSidebarSlot =
    pathname.startsWith("/planung") || pathname.startsWith("/dashboard");
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
    <SuperadminModalProvider enabled={superadminEnabled}>
      <AppShellModalLockProvider>
        <AppShellMainNavPendingProvider>
          <Suspense fallback={null}>
            <AppShellModalLockBridge />
          </Suspense>
          <Suspense fallback={null}>
            <AppShellMainNavPendingBridge />
          </Suspense>
          <AppShellLayout
          orgName={orgName}
          open={open}
          setOpen={setOpen}
          showAppSidebarSlot={showAppSidebarSlot}
          sidebarRef={sidebarRef}
          superadminEnabled={superadminEnabled}
          role={role}
        >
          {children}
        </AppShellLayout>
        </AppShellMainNavPendingProvider>
      </AppShellModalLockProvider>
    </SuperadminModalProvider>
  );
}

function AppShellLayout({
  orgName,
  open,
  setOpen,
  showAppSidebarSlot,
  sidebarRef,
  superadminEnabled,
  role,
  children,
}: {
  orgName?: string;
  open: boolean;
  setOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  showAppSidebarSlot: boolean;
  sidebarRef: React.RefObject<HTMLDivElement | null>;
  superadminEnabled: boolean;
  role?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const shellLocked = useIsAppShellLocked();
  const shellWaitCursor = useIsAppShellWaitCursor();

  return (
    <div
      className={cn(
        "flex h-dvh min-h-0 flex-col overflow-hidden md:flex-row",
        shellWaitCursor && "cursor-wait [&_*]:cursor-wait"
      )}
    >
      <div
        ref={sidebarRef}
        className="relative z-50 flex w-full shrink-0 flex-col border-b border-border bg-surface md:h-full md:w-56 md:border-b-0 md:border-r"
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 border-b border-border px-3",
            APP_SHELL_BRAND_HEADER_CLASS
          )}
        >
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
            disabled={shellLocked}
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

        {showAppSidebarSlot ? (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3",
              APP_SHELL_CONTENT_OFFSET_CLASS
            )}
          >
            <PlanningAppSidebarSlotMount />
          </div>
        ) : null}

        {open ? (
          <>
            <button
              type="button"
              aria-label={t("nav.closeMenu")}
              className="fixed inset-0 z-40 bg-black/25 md:absolute md:inset-x-0 md:bottom-0 md:top-20 md:bg-black/10"
              onClick={() => setOpen(false)}
            />
            <div className="fixed inset-x-0 top-14 z-50 flex max-h-[min(70vh,calc(100dvh-3.5rem))] flex-col overflow-y-auto border-t border-border bg-surface shadow-lg md:absolute md:inset-x-0 md:bottom-0 md:top-20 md:max-h-none md:border-t-0 md:shadow-xl">
              <AppShellControlsGuard>
                <Suspense
                  fallback={
                    <nav className="p-2 text-sm text-muted">{t("common.loading")}</nav>
                  }
                >
                  <SidebarNav
                    onNavigate={() => setOpen(false)}
                    viewerRole={role}
                    superadminEnabled={superadminEnabled}
                  />
                </Suspense>
              </AppShellControlsGuard>
            </div>
          </>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
          {children}
          <SettingsModalsAppShellFallback />
        </main>
      </div>
    </div>
  );
}
