"use client";

// Responsive layout — see apps/web/RESPONSIVE_ROLLBACK.md to revert.

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
  Suspense,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { IconButton } from "@/components/ui";
import { AppShellBrandHeader } from "@/components/brand/app-shell-brand-header";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/i18n/locale-provider";
import { SidebarNav } from "./sidebar-nav";
import { SettingsModalsAppShellFallback } from "@/components/settings/settings-modals-app-shell-fallback";
import { OverviewModalsAppShellFallback } from "@/components/overview/overview-modals-app-shell-fallback";
import { SuperadminModalProvider } from "@/components/settings/superadmin-modal-context";
import { AppShellModalLockBridge } from "@/components/areacalendar/app-shell-modal-lock-bridge";
import {
  AppShellMainNavPendingBridge,
  AppShellMainNavPendingProvider,
} from "@/lib/app-shell-main-nav-pending";
import {
  APP_SHELL_CONTENT_COLUMN_CLASS,
  APP_SHELL_MAIN_CLASS,
  APP_SHELL_ROOT_CLASS,
  APP_SHELL_SIDEBAR_CLASS,
} from "@/lib/app-shell-layout";
import {
  AppShellControlsGuard,
  AppShellModalLockProvider,
  useIsAppShellLocked,
  useIsAppShellWaitCursor,
} from "@/lib/app-shell-modal-lock";

const APP_SHELL_MENU_WIDTH_PX = 224;

type MenuAnchor = {
  top: number;
  left: number;
  width: number;
};

function useMenuAnchor(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>
): MenuAnchor | null {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const width = Math.min(APP_SHELL_MENU_WIDTH_PX, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, rect.right - width),
      window.innerWidth - width - 8
    );

    setAnchor({
      top: rect.bottom + 4,
      left,
      width,
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  return anchor;
}

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
  const isAreaCalendar = pathname.startsWith("/bereich-kalender");
  const menuButtonRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuButtonRef.current?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("keydown", onKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
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
            brandHeaderAlignContentStart={isAreaCalendar}
            menuButtonRef={menuButtonRef}
            menuPanelRef={menuPanelRef}
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
  brandHeaderAlignContentStart,
  menuButtonRef,
  menuPanelRef,
  superadminEnabled,
  role,
  children,
}: {
  orgName?: string;
  open: boolean;
  setOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  brandHeaderAlignContentStart: boolean;
  menuButtonRef: RefObject<HTMLDivElement | null>;
  menuPanelRef: RefObject<HTMLDivElement | null>;
  superadminEnabled: boolean;
  role?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const shellLocked = useIsAppShellLocked();
  const shellWaitCursor = useIsAppShellWaitCursor();
  const menuAnchor = useMenuAnchor(open, menuButtonRef);

  const menuPanel =
    open && menuAnchor && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuPanelRef}
            role="menu"
            style={{
              position: "fixed",
              top: menuAnchor.top,
              left: menuAnchor.left,
              width: menuAnchor.width,
            }}
            className={cn(
              "z-[200] max-h-[min(70vh,calc(100dvh-6rem))] overflow-y-auto rounded-[var(--radius-control)] border shadow-lg",
              APP_SHELL_SIDEBAR_CLASS
            )}
          >
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
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        className={cn(
          APP_SHELL_ROOT_CLASS,
          shellWaitCursor && "cursor-wait [&_*]:cursor-wait"
        )}
      >
        <div
          className={cn(
            "relative z-50 flex w-full shrink-0 flex-col overflow-visible border-b md:h-full md:w-56 md:min-h-0 md:border-b-0",
            APP_SHELL_SIDEBAR_CLASS
          )}
        >
          <AppShellBrandHeader
            orgName={orgName}
            alignContentStart={brandHeaderAlignContentStart}
            trailing={
              <div ref={menuButtonRef} className="relative shrink-0">
                <IconButton
                  size="sm"
                  onClick={() => setOpen((v) => !v)}
                  disabled={shellLocked}
                  aria-expanded={open}
                  aria-haspopup="menu"
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
            }
          />
        </div>

        <div className={APP_SHELL_CONTENT_COLUMN_CLASS}>
          <main className={APP_SHELL_MAIN_CLASS}>
            {children}
            <SettingsModalsAppShellFallback />
            <OverviewModalsAppShellFallback />
          </main>
        </div>
      </div>
      {menuPanel}
    </>
  );
}
