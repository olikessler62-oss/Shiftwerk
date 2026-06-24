import {
  APP_PAGE_TOOLBAR_HEADER_CLASS,
  DASHBOARD_VIEW_CONTENT_CLASS,
  PLANNING_PAGES_SHELL_CLASS,
} from "@/lib/app-shell-layout";
import { cn } from "@/lib/cn";

export function DashboardLoadingSkeleton() {
  return (
    <div className={PLANNING_PAGES_SHELL_CLASS} aria-busy="true" aria-live="polite">
      <header className={cn(APP_PAGE_TOOLBAR_HEADER_CLASS, "pointer-events-none")}>
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 md:gap-3">
          <div className="h-8 w-48 animate-pulse rounded-md bg-white/20" />
          <div className="flex shrink-0 gap-2">
            <div className="h-8 w-8 animate-pulse rounded-md bg-white/15" />
            <div className="h-8 w-16 animate-pulse rounded-md bg-white/15" />
            <div className="h-8 w-8 animate-pulse rounded-md bg-white/15" />
          </div>
          <div className="flex shrink-0 gap-2">
            <div className="h-8 w-28 animate-pulse rounded-full bg-white/15" />
            <div className="h-8 w-24 animate-pulse rounded-full bg-white/15" />
          </div>
        </div>
      </header>

      <div className={cn(DASHBOARD_VIEW_CONTENT_CLASS, "gap-3 p-4 md:p-6")}>
        <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-muted/60" />
        <div className="min-h-[320px] flex-1 animate-pulse rounded-xl bg-muted/50 md:min-h-[480px]" />
      </div>
    </div>
  );
}
