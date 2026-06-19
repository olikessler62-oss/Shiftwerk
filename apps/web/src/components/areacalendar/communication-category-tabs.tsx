"use client";

import { cn } from "@/lib/cn";
import {
  COMMUNICATION_HUB_CATEGORY_ORDER,
  communicationHubCategoryLabelClass,
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
      className="flex flex-wrap gap-1 border-b border-border"
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
              "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
              communicationHubCategoryLabelClass(category),
              selected
                ? "border-current bg-subtle/60"
                : "border-transparent hover:border-border hover:bg-subtle/40",
              !hasItems && !selected && "opacity-45"
            )}
          >
            <span className="whitespace-nowrap">{labelFor(category)}</span>
            <span
              className={cn(
                "inline-flex min-w-[1.5rem] shrink-0 items-center justify-center tabular-nums leading-none",
                hasItems ? "text-lg font-bold" : "text-sm font-medium opacity-70"
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
