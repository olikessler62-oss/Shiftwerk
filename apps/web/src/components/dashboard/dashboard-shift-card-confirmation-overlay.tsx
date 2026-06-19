"use client";

import { cn } from "@/lib/cn";
import {
  shiftConfirmationBadgeSymbol,
  shiftConfirmationBadgeSymbolClass,
  shiftConfirmationShowsOverlay,
  SHIFT_CONFIRMATION_BADGE_PANEL_CLASS,
  SHIFT_CONFIRMATION_OVERLAY_COLOR_CLASS,
} from "@/lib/shift-confirmation-display";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

type Props = {
  status: ShiftConfirmationStatus | undefined;
};

function ConfirmationBadgeSymbol({ status }: { status: ShiftConfirmationStatus }) {
  const symbolClass = shiftConfirmationBadgeSymbolClass(status);
  const iconClass = cn(
    "shrink-0",
    status === "pending" ? "h-3 w-3" : "h-2.5 w-2.5",
    symbolClass
  );

  if (status === "proposed") {
    return (
      <svg
        viewBox="0 0 12 12"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8.25 1.75 10.25 3.75 3.75 10.25 1.75 10.75 2.25 8.75 8.25 1.75Z" />
        <path d="M7 3.25 8.75 5" />
      </svg>
    );
  }

  if (status === "pending") {
    return (
      <svg
        viewBox="0 0 12 12"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="6" cy="6.5" r="4.25" />
        <path d="M6 3.25V6.5l2 1.25" />
        <path d="M4.5 1.5h3" />
      </svg>
    );
  }

  return (
    <span
      className={cn(
        "text-[12px] font-bold leading-none",
        symbolClass
      )}
    >
      {shiftConfirmationBadgeSymbol(status)}
    </span>
  );
}

export function DashboardShiftCardConfirmationOverlay({ status }: Props) {
  if (!status || !shiftConfirmationShowsOverlay(status)) {
    return null;
  }

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
        <ConfirmationBadgeSymbol status={status} />
      </div>
    </>
  );
}
