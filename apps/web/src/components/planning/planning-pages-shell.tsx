"use client";

import { usePathname } from "next/navigation";
import type { Location } from "@schichtwerk/types";
import { cn } from "@/lib/cn";
import {
  AREA_CALENDAR_VIEW_CONTENT_CLASS,
  DASHBOARD_VIEW_CONTENT_CLASS,
  PLANNING_PAGES_SHELL_CLASS,
} from "@/lib/app-shell-layout";
import { PlanningToolbarPageBridgeProvider } from "@/lib/planning-toolbar-page-bridge";
import { PlanningPageToolbar } from "@/components/planning/planning-page-toolbar";

type Props = {
  locations: Location[];
  children: React.ReactNode;
};

export function PlanningPagesShell({ locations, children }: Props) {
  const pathname = usePathname();
  const isAreaCalendar = pathname === "/bereich-kalender";

  return (
    <PlanningToolbarPageBridgeProvider>
      <div className={PLANNING_PAGES_SHELL_CLASS}>
        <PlanningPageToolbar locations={locations} />
        <div
          className={cn(
            isAreaCalendar
              ? AREA_CALENDAR_VIEW_CONTENT_CLASS
              : DASHBOARD_VIEW_CONTENT_CLASS
          )}
        >
          {children}
        </div>
      </div>
    </PlanningToolbarPageBridgeProvider>
  );
}
