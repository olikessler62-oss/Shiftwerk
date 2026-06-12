"use client";

import { useState } from "react";
import type { Industry } from "@schichtwerk/types";
import { cn } from "@/lib/cn";

export type RegisterIndustryOption = {
  id: Industry;
  title: string;
  hint: string;
};

type Props = {
  options: RegisterIndustryOption[];
  defaultIndustry?: Industry;
  ariaLabelledBy?: string;
};

export function RegisterIndustryPicker({
  options,
  defaultIndustry = "other",
  ariaLabelledBy,
}: Props) {
  const [selected, setSelected] = useState<Industry>(defaultIndustry);

  return (
    <div
      role="group"
      aria-labelledby={ariaLabelledBy}
      className="grid gap-2 sm:grid-cols-2"
    >
      <input type="hidden" name="industry" value={selected} />
      {options.map((option) => {
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(option.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-surface hover:border-primary/40 hover:bg-primary/5"
              )}
            >
              <span className="block text-sm font-semibold text-foreground">
                {option.title}
              </span>
              <span className="mt-1 block text-xs leading-snug text-muted">
                {option.hint}
              </span>
            </button>
          );
      })}
    </div>
  );
}
