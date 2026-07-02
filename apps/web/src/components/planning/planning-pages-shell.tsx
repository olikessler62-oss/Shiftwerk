"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { Location } from "@schichtwerk/types";
import { cn } from "@/lib/cn";
import {
  AREA_CALENDAR_VIEW_CONTENT_CLASS,
  DASHBOARD_VIEW_CONTENT_CLASS,
  EMPLOYEE_CALENDAR_VIEW_CONTENT_CLASS,
  PLANNING_PAGE_CONTENT_BLEED_CLASS,
  PLANNING_PAGES_SHELL_CLASS,
  PLANNING_TOOLBAR_BLEED_SHELL_CLASS,
} from "@/lib/app-shell-layout";
import {
  PLANNING_CALENDAR_PAGE_PATHS,
  useBeginMainNavPending,
  useMainNavPendingTarget,
} from "@/lib/app-shell-main-nav-pending";
import { consumePlanningPostLoginPending } from "@/lib/planning-post-login-pending";
import { PlanningToolbarPageBridgeProvider } from "@/lib/planning-toolbar-page-bridge";
import { PlanningPageToolbar } from "@/components/planning/planning-page-toolbar";
import { PlanningPageLoadingProgressBar } from "@/components/planning/planning-page-loading-progress-bar";

type Props = {
  locations: Location[];
  children: React.ReactNode;
};

export function PlanningPagesShell({ locations, children }: Props) {
  const pathname = usePathname();
  const pendingTarget = useMainNavPendingTarget();
  const beginMainNavPending = useBeginMainNavPending();
  const frozenContentPathnameRef = useRef(pathname);
  const postLoginPendingStartedRef = useRef(false);

  useEffect(() => {
    if (!pendingTarget) {
      frozenContentPathnameRef.current = pathname;
    }
  }, [pendingTarget, pathname]);

  useEffect(() => {
    if (postLoginPendingStartedRef.current) return;
    if (!consumePlanningPostLoginPending()) return;
    if (!PLANNING_CALENDAR_PAGE_PATHS.has(pathname)) return;
    postLoginPendingStartedRef.current = true;
    beginMainNavPending({ kind: "page", pathname });
  }, [beginMainNavPending, pathname]);

  const contentPathname = pendingTarget
    ? frozenContentPathnameRef.current
    : pathname;
  const isAreaCalendar = contentPathname === "/bereich-kalender";
  const isDashboard = contentPathname === "/dashboard";
  const showPageNavLoadingBar =
    pendingTarget?.kind === "page" &&
    PLANNING_CALENDAR_PAGE_PATHS.has(pendingTarget.pathname);

  return (
    <PlanningToolbarPageBridgeProvider>
      <div className={PLANNING_PAGES_SHELL_CLASS}>
        <div className={PLANNING_TOOLBAR_BLEED_SHELL_CLASS}>
          <PlanningPageToolbar locations={locations} />
        </div>
        <div
          className={cn(
            PLANNING_PAGE_CONTENT_BLEED_CLASS,
            "relative",
            isAreaCalendar
              ? AREA_CALENDAR_VIEW_CONTENT_CLASS
              : isDashboard
                ? DASHBOARD_VIEW_CONTENT_CLASS
                : EMPLOYEE_CALENDAR_VIEW_CONTENT_CLASS
          )}
        >
          {showPageNavLoadingBar ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
                <PlanningPageLoadingProgressBar />
              </div>
              <div
                className="pointer-events-none absolute inset-0 z-10 bg-background/15"
                aria-hidden
              />
            </>
          ) : null}
          {children}
        </div>
      </div>
    </PlanningToolbarPageBridgeProvider>
  );
}
