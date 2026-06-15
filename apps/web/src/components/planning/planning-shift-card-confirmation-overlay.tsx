"use client";

import {
  shiftConfirmationBadgeSymbol,
  shiftConfirmationShowsOverlay,
} from "@/lib/shift-confirmation-display";
import type { ShiftConfirmationStatus } from "@schichtwerk/types";

type Props = {
  status: ShiftConfirmationStatus | undefined;
};

export function PlanningShiftCardConfirmationOverlay({ status }: Props) {
  if (!status || !shiftConfirmationShowsOverlay(status)) {
    return null;
  }

  return (
    <>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-black/25"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-sm bg-white/90 px-0.5 text-[10px] font-semibold leading-none text-foreground shadow-sm"
        aria-hidden
      >
        {shiftConfirmationBadgeSymbol(status)}
      </div>
    </>
  );
}
