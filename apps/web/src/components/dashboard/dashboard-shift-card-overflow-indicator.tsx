"use client";

export function DashboardShiftCardOverflowIndicator() {
  return (
    <div
      className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-sm bg-white/90 px-0.5 text-[10px] font-semibold leading-none text-foreground shadow-sm"
      aria-hidden
    >
      !
    </div>
  );
}
