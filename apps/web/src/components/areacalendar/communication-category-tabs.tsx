"use client";

import { cn } from "@/lib/cn";
import {
  COMMUNICATION_HUB_CATEGORY_ORDER,
  communicationHubCategoryPanelClass,
  type CommunicationHubCategory,
  type CommunicationHubCounts,
} from "@/lib/communication-hub";

type Props = {
  counts: CommunicationHubCounts;
  activeCategory: CommunicationHubCategory;
  onSelect: (category: CommunicationHubCategory) => void;
  labelFor: (category: CommunicationHubCategory) => string;
  disabled?: boolean;
};

export function CommunicationCategoryTabs({
  counts,
  activeCategory,
  onSelect,
  labelFor,
  disabled = false,
}: Props) {
  return (
    <div
      className="flex flex-nowrap gap-1 overflow-x-auto overflow-y-hidden border-b border-border"
      role="tablist"
      aria-label="Schicht-Stati"
    >
      {COMMUNICATION_HUB_CATEGORY_ORDER.map((category) => {
        const count = counts[category];
        const selected = activeCategory === category;
        const hasItems = count > 0;

        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onSelect(category)}
            className={cn(
              "relative -mb-px flex shrink-0 items-center gap-1.5 rounded-t-lg border px-2.5 py-2 text-sm font-semibold transition-colors",
              selected
                ? cn(
                    communicationHubCategoryPanelClass(category),
                    "z-10 border-b-surface shadow-sm ring-1 ring-inset ring-black/5"
                  )
                : cn(
                    "border-transparent bg-transparent text-muted",
                    "hover:border-border/70 hover:bg-subtle/60 hover:text-foreground",
                    hasItems && "text-foreground/75",
                    !hasItems && "opacity-45"
                  )
            )}
          >
            <span className="whitespace-nowrap">{labelFor(category)}</span>
            <span
              className={cn(
                "inline-flex min-w-[1.5rem] shrink-0 items-center justify-center rounded-full px-1 tabular-nums leading-none",
                selected
                  ? "bg-black/10 text-[1.05rem] font-bold"
                  : hasItems
                    ? "text-base font-semibold"
                    : "text-sm font-medium opacity-70"
              )}
              aria-label={`${count}`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
