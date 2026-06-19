"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { MODAL_DROPDOWN_Z_INDEX } from "@/components/settings/settings-modal-shell";
import type { OverviewEmployeeJumpOption } from "@/lib/overview-employee-jump";
import { useComboboxCloseOnPointerDistance } from "@/lib/use-combobox-close";

function EmployeeColorSwatch({ hex }: { hex: string | null }) {
  return (
    <span
      className={cn(
        "size-3 shrink-0 rounded-full border border-border/60",
        !hex && "bg-subtle"
      )}
      style={hex ? { backgroundColor: hex } : undefined}
      aria-hidden
    />
  );
}

/** Dropdown list height for ~10 employee rows (py-2 + text-sm). */
const EMPLOYEE_JUMP_COMBOBOX_VISIBLE_ROWS = 10;
const EMPLOYEE_JUMP_COMBOBOX_ROW_HEIGHT_REM = 2.5;

function dropdownMaxHeightClass(visibleRows: number): string {
  return `max-h-[calc(${EMPLOYEE_JUMP_COMBOBOX_ROW_HEIGHT_REM}rem*${visibleRows}+0.5rem)]`;
}

function normalizeFilterQuery(value: string): string {
  return value.trim().toLocaleLowerCase("de");
}

function optionMatchesFilter(
  option: OverviewEmployeeJumpOption,
  query: string
): boolean {
  if (!query) return true;
  return option.employeeName.toLocaleLowerCase("de").includes(query);
}

type Props = {
  options: readonly OverviewEmployeeJumpOption[];
  onJump: (employeeId: string, firstRowId: string | null) => void;
  selectedEmployeeId?: string;
  disabled?: boolean;
  className?: string;
};

export function OverviewAvailabilitiesEmployeeJumpCombobox({
  options,
  onJump,
  selectedEmployeeId: selectedEmployeeIdProp,
  disabled = false,
  className,
}: Props) {
  const t = useTranslations();
  const listboxId = useId();
  const filterInputId = `${listboxId}-filter`;
  const [open, setOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    selectedEmployeeIdProp ?? ""
  );
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const closeCombobox = () => {
    setOpen(false);
    setFilterQuery("");
  };
  useComboboxCloseOnPointerDistance(open, closeCombobox, [rootRef, dropdownRef]);

  const placeholder = t("overview.availabilities.jumpToEmployee");
  const selected = useMemo(
    () => options.find((option) => option.employeeId === selectedEmployeeId) ?? null,
    [options, selectedEmployeeId]
  );

  const normalizedFilter = normalizeFilterQuery(filterQuery);
  const filteredOptions = useMemo(
    () => options.filter((option) => optionMatchesFilter(option, normalizedFilter)),
    [normalizedFilter, options]
  );

  const visibleRows = Math.min(
    EMPLOYEE_JUMP_COMBOBOX_VISIBLE_ROWS,
    Math.max(filteredOptions.length, 1)
  );

  useEffect(() => {
    if (selectedEmployeeIdProp !== undefined) {
      setSelectedEmployeeId(selectedEmployeeIdProp);
    }
  }, [selectedEmployeeIdProp]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;

    const updatePosition = () => {
      const trigger = rootRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const minWidth = 224;
      const width = Math.max(rect.width, minWidth);
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.right - width,
        width,
        zIndex: MODAL_DROPDOWN_Z_INDEX,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, filteredOptions.length]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      filterRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (options.length === 0) return null;

  const dropdown =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="rounded-lg border border-border bg-surface py-1 shadow-lg"
          >
            <div className="border-b border-border px-2 py-1.5">
              <input
                ref={filterRef}
                id={filterInputId}
                type="search"
                value={filterQuery}
                placeholder={t("overview.availabilities.jumpToEmployeeFilter")}
                aria-controls={listboxId}
                className="h-8 w-full rounded-[var(--radius-control)] border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                onChange={(event) => setFilterQuery(event.target.value)}
              />
            </div>
            <ul
              id={listboxId}
              role="listbox"
              aria-label={placeholder}
              className={cn(
                "overflow-y-auto py-1",
                dropdownMaxHeightClass(visibleRows)
              )}
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted">
                  {t("overview.availabilities.jumpToEmployeeEmpty")}
                </li>
              ) : (
                filteredOptions.map((option) => (
                  <li
                    key={option.employeeId}
                    role="option"
                    aria-selected={selectedEmployeeId === option.employeeId}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-subtle"
                      onClick={() => {
                        setSelectedEmployeeId(option.employeeId);
                        onJump(option.employeeId, option.firstRowId);
                        closeCombobox();
                      }}
                    >
                      <EmployeeColorSwatch hex={option.employeeColor} />
                      <span className="min-w-0 flex-1 truncate">
                        {option.employeeName}
                      </span>
                      {selectedEmployeeId === option.employeeId ? (
                        <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={placeholder}
        className={cn(
          "flex h-8 min-h-8 w-full items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-2.5 text-left text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        <EmployeeColorSwatch hex={selected?.employeeColor ?? null} />
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted")}>
          {selected?.employeeName ?? placeholder}
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {dropdown}
    </div>
  );
}
