"use client";

import { cn } from "@/lib/cn";
import {
  shiftConfirmationBadgeSymbol,
  shiftConfirmationBadgeSymbolClass,
  SHIFT_CONFIRMATION_BADGE_PANEL_CLASS,
  SHIFT_CONFIRMATION_OVERLAY_COLOR_CLASS,
} from "@/lib/shift-confirmation-display";

/** Overlay für offene MA-Absage — gleiches Muster wie Bestätigungs-Overlays (Badge rechts oben). */
export function ShiftPendingCancellationOverlay() {
  const symbolClass = shiftConfirmationBadgeSymbolClass("canceled");

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          SHIFT_CONFIRMATION_OVERLAY_COLOR_CLASS
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center px-0.5",
          SHIFT_CONFIRMATION_BADGE_PANEL_CLASS
        )}
        aria-hidden
      >
        <span
          className={cn("text-[12px] font-bold leading-none", symbolClass)}
        >
          {shiftConfirmationBadgeSymbol("canceled")}
        </span>
      </div>
    </>
  );
}
