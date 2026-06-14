"use client";

import { cn } from "@/lib/cn";

type Props = {
  label: string;
  className?: string;
};

/** Tag-Bereich-Footer: Gesamtstunden und Gesamtkosten. */
export function TagAreaFooterStrip({ label, className }: Props) {
  if (!label.trim()) return null;

  return (
    <div
      className={cn(
        "flex h-full w-full min-w-0 items-center justify-center overflow-hidden px-0.5",
        className
      )}
    >
      <span
        className="truncate text-[11px] font-medium leading-none text-neutral-600"
        title={label}
      >
        {label}
      </span>
    </div>
  );
}
