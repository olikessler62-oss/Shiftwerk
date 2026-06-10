"use client";

import { useEffect, useRef, useState } from "react";
import { SHIFT_TEMPLATE_PICKER_COLORS } from "@schichtwerk/database";
import { cn } from "@/lib/cn";
import { shiftColorStyle } from "@/lib/shift-color-style";

function ColorSwatch({
  hex,
  selected,
  className,
}: {
  hex: string;
  selected?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "box-border inline-block h-[12px] w-[12px] shrink-0 border border-black",
        selected && "ring-2 ring-primary ring-offset-1",
        className
      )}
      style={shiftColorStyle(hex)}
      aria-hidden
    />
  );
}

type Props = {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  ariaLabel: string;
};

export function ShiftTemplateColorCombobox({
  value,
  onChange,
  disabled,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 min-h-9 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm",
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-subtle"
        )}
      >
        <ColorSwatch hex={value} />
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={cn(
            "shrink-0 text-muted transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && !disabled ? (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface p-2 shadow-lg"
        >
          <li role="presentation" className="grid grid-cols-4 gap-2">
            {SHIFT_TEMPLATE_PICKER_COLORS.map((hex) => {
              const isSelected = hex.toUpperCase() === value.toUpperCase();
              return (
                <button
                  key={hex}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-label={ariaLabel}
                  onClick={() => {
                    onChange(hex);
                    setOpen(false);
                  }}
                  className="flex items-center justify-center p-0.5 hover:bg-subtle"
                >
                  <ColorSwatch hex={hex} selected={isSelected} />
                </button>
              );
            })}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
