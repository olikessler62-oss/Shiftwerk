import {
  APP_PAGE_TOOLBAR_HEADER_CLASS,
  DASHBOARD_VIEW_ROOT_CLASS,
} from "@/lib/app-shell-layout";
import { cn } from "@/lib/cn";

export function DashboardLoadingSkeleton() {
  return (
    <div className={DASHBOARD_VIEW_ROOT_CLASS} aria-busy="true" aria-live="polite">
      <header className={cn(APP_PAGE_TOOLBAR_HEADER_CLASS, "pointer-events-none")}>
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-4">
          <div className="h-8 w-48 animate-pulse rounded-md bg-foreground/20" />
          <div className="flex gap-2">
            <div className="h-8 w-8 animate-pulse rounded-md bg-foreground/15" />
            <div className="h-8 w-16 animate-pulse rounded-md bg-foreground/15" />
            <div className="h-8 w-8 animate-pulse rounded-md bg-foreground/15" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-28 animate-pulse rounded-full bg-foreground/15" />
            <div className="h-8 w-24 animate-pulse rounded-full bg-foreground/15" />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:p-6">
        <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-muted/60" />
        <div className="min-h-[320px] flex-1 animate-pulse rounded-xl bg-muted/50 md:min-h-[480px]" />
      </div>
    </div>
  );
}
