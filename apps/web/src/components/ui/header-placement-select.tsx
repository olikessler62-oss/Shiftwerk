"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { headerToolbarSelectClass } from "@/lib/header-toolbar-styles";
import { useComboboxCloseOnPointerDistance } from "@/lib/use-combobox-close";
import { useHeaderToolbarDropdownPosition } from "@/lib/use-header-toolbar-dropdown-position";

export type HeaderPillSelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: readonly HeaderPillSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  "aria-label": string;
  wrapperClassName?: string;
  triggerClassName?: string;
  /** Trigger-Oberfläche — Standard: Pill-Select; Sprache nutzt Text-Variante. */
  selectClassName?: string;
};

export function HeaderPillSelect({
  value,
  options,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  wrapperClassName,
  triggerClassName,
  selectClassName = headerToolbarSelectClass,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const close = () => setOpen(false);
  useComboboxCloseOnPointerDistance(open, close, [rootRef, listRef]);

  const selected = options.find((option) => option.value === value) ?? options[0];
  const dropdownStyle = useHeaderToolbarDropdownPosition(open, rootRef, {}, [
    options.length,
  ]);

  const dropdownPanel =
    open && !disabled && options.length > 0 && dropdownStyle ? (
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        style={dropdownStyle}
        className="header-toolbar-combobox-panel max-h-60 overflow-y-auto rounded-none border py-1 shadow-lg"
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
                className={cn(
                  "header-toolbar-combobox-option w-full truncate rounded-none px-3 py-2 text-left text-sm transition",
                  isSelected
                    ? "header-toolbar-combobox-option-selected font-medium"
                    : "text-foreground"
                )}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative inline-flex min-w-0 max-w-[12rem] shrink-0",
        wrapperClassName
      )}
    >
      <button
        type="button"
        disabled={disabled || options.length === 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        data-open={open ? "true" : "false"}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          selectClassName,
          "flex cursor-pointer items-center justify-between gap-2 pr-8 text-left",
          triggerClassName
        )}
      >
        <span className="min-w-0 truncate">{selected?.label ?? "—"}</span>
      </button>
      <svg
        viewBox="0 0 12 8"
        fill="currentColor"
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-2.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-muted transition-transform",
          open && "rotate-180"
        )}
      >
        <path d="M1.5 1 6 5.5 10.5 1 12 2.5l-6 6-6-6L1.5 1Z" />
      </svg>

      {typeof document !== "undefined" && dropdownPanel
        ? createPortal(dropdownPanel, document.body)
        : null}
    </div>
  );
}

/** @deprecated Alias — bitte HeaderPillSelect verwenden. */
export const HeaderPlacementSelect = HeaderPillSelect;
