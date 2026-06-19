"use client";

import {
  type BulkShiftColumnPrefs,
  type BulkShiftSortColumn,
  toggleBulkShiftPrefillColumn,
  cycleBulkShiftSortPrefs,
} from "@/lib/bulk-shift-column-prefs";
import { ChevronDownIcon, ChevronUpIcon } from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";

type PrefillColumn = keyof BulkShiftColumnPrefs["prefill"];

type Props = {
  label: string;
  sortColumn?: BulkShiftSortColumn;
  prefillColumn?: PrefillColumn;
  prefs: BulkShiftColumnPrefs;
  onPrefsChange: (prefs: BulkShiftColumnPrefs) => void;
  sortColumnLabel: string;
  sortAscLabel: string;
  sortDescLabel: string;
  prefillLabel: string;
  prefillActiveLabel: string;
};

function SortToggleIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: BulkShiftColumnPrefs["sort"]["direction"];
}) {
  if (active && direction === "asc") {
    return <ChevronUpIcon className="h-3 w-3" />;
  }
  if (active && direction === "desc") {
    return <ChevronDownIcon className="h-3 w-3" />;
  }
  return (
    <span className="inline-flex flex-col leading-none opacity-70">
      <ChevronUpIcon className="-mb-1 h-2.5 w-2.5" />
      <ChevronDownIcon className="h-2.5 w-2.5" />
    </span>
  );
}

export function BulkShiftColumnHeader({
  label,
  sortColumn,
  prefillColumn,
  prefs,
  onPrefsChange,
  sortColumnLabel,
  sortAscLabel,
  sortDescLabel,
  prefillLabel,
  prefillActiveLabel,
}: Props) {
  const sortActive = sortColumn != null && prefs.sort.column === sortColumn;
  const sortDirection = sortActive ? prefs.sort.direction : null;
  const prefillActive =
    prefillColumn != null && prefs.prefill[prefillColumn] === true;

  const sortAriaLabel = sortActive
    ? sortDirection === "asc"
      ? sortAscLabel
      : sortDescLabel
    : sortColumnLabel;

  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <span className="min-w-0 truncate">{label}</span>
      {sortColumn ? (
        <Tooltip content={sortAriaLabel}>
          <button
            type="button"
            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${
              sortActive ? "text-primary" : "text-muted hover:text-foreground"
            }`}
            aria-label={sortAriaLabel}
            aria-pressed={sortActive}
            onClick={() =>
              onPrefsChange(cycleBulkShiftSortPrefs(prefs, sortColumn))
            }
          >
            <SortToggleIcon active={sortActive} direction={sortDirection} />
          </button>
        </Tooltip>
      ) : null}
      {prefillColumn ? (
        <Tooltip
          content={
            prefillActive
              ? prefillActiveLabel
              : prefillLabel
          }
        >
          <button
            type="button"
            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${
              prefillActive ? "text-primary" : "text-muted hover:text-foreground"
            }`}
            aria-label={
              prefillActive
                ? prefillActiveLabel
                : prefillLabel
            }
            aria-pressed={prefillActive}
            onClick={() =>
              onPrefsChange(toggleBulkShiftPrefillColumn(prefs, prefillColumn))
            }
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                prefillActive ? "bg-primary" : "border border-current"
              }`}
              aria-hidden
            />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
