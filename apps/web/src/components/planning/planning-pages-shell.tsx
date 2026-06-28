"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { Location } from "@schichtwerk/types";
import { cn } from "@/lib/cn";
import {
  AREA_CALENDAR_VIEW_CONTENT_CLASS,
  DASHBOARD_VIEW_CONTENT_CLASS,
  EMPLOYEE_CALENDAR_VIEW_CONTENT_CLASS,
  PLANNING_PAGES_SHELL_CLASS,
} from "@/lib/app-shell-layout";
import { useMainNavPendingTarget } from "@/lib/app-shell-main-nav-pending";
import { PlanningToolbarPageBridgeProvider } from "@/lib/planning-toolbar-page-bridge";
import { PlanningPageToolbar } from "@/components/planning/planning-page-toolbar";

type Props = {
  locations: Location[];
  children: React.ReactNode;
};

export function PlanningPagesShell({ locations, children }: Props) {
  const pathname = usePathname();
  const pendingTarget = useMainNavPendingTarget();
  const frozenContentPathnameRef = useRef(pathname);

  useEffect(() => {
    if (!pendingTarget) {
      frozenContentPathnameRef.current = pathname;
    }
  }, [pendingTarget, pathname]);

  const contentPathname = pendingTarget
    ? frozenContentPathnameRef.current
    : pathname;
  const isAreaCalendar = contentPathname === "/bereich-kalender";
  const isDashboard = contentPathname === "/dashboard";

  return (
    <PlanningToolbarPageBridgeProvider>
      <div className={PLANNING_PAGES_SHELL_CLASS}>
        <PlanningPageToolbar locations={locations} />
        <div
          className={cn(
            isAreaCalendar
              ? AREA_CALENDAR_VIEW_CONTENT_CLASS
              : isDashboard
                ? DASHBOARD_VIEW_CONTENT_CLASS
                : EMPLOYEE_CALENDAR_VIEW_CONTENT_CLASS
          )}
        >
          {children}
        </div>
      </div>
    </PlanningToolbarPageBridgeProvider>
  );
}
