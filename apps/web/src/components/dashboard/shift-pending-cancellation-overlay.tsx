"use client";

import { cn } from "@/lib/cn";

/** Rotes X über der Schichtkarte — MA-Absage wartet auf Admin-Bestätigung. */
export function ShiftPendingCancellationOverlay() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-red-500/15"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className={cn("h-[72%] w-[72%] max-h-10 max-w-10 text-red-600")}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.25"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </div>
    </>
  );
}
