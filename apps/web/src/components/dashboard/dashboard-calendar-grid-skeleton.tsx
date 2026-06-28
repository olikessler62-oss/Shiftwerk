import {
  PLANNING_PAGE_CALENDAR_MAIN_CLASS,
  PLANNING_PAGE_CALENDAR_SECTION_CLASS,
  APP_SHELL_CONTENT_OFFSET_CLASS,
} from "@/lib/app-shell-layout";
import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";

export function DashboardCalendarGridSkeleton() {
  return (
    <div className={PLANNING_PAGE_CALENDAR_SECTION_CLASS} aria-busy="true" aria-live="polite">
      <main
        className={cn(
          PLANNING_PAGE_CALENDAR_MAIN_CLASS,
          "px-3 pb-3 md:px-4 md:pb-4",
          APP_SHELL_CONTENT_OFFSET_CLASS
        )}
      >
        <div className={cn("min-h-[320px] animate-pulse bg-muted/50 md:min-h-[480px]", DASHBOARD_PANEL_ROUNDED_CLASS)} />
      </main>
    </div>
  );
}
