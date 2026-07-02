"use client";

import { useBodyWaitCursor } from "@/lib/use-body-wait-cursor";
import { cn } from "@/lib/cn";
import { PlanningPageLoadingProgressBarTrack } from "@/components/planning/planning-page-loading-progress-bar-track";

/** Vollbild-Ladezustand während Manager-Session und App-Shell aufgebaut werden. */
export function ManagerRouteLoading() {
  useBodyWaitCursor(true);

  return (
    <div
      className={cn(
        "flex min-h-dvh w-full flex-col bg-background",
        "cursor-wait [&_*]:cursor-wait"
      )}
      aria-busy="true"
      aria-live="polite"
      aria-label="Laden…"
    >
      <PlanningPageLoadingProgressBarTrack ariaLabel="Laden…" />
      <div className="flex-1" aria-hidden />
    </div>
  );
}
