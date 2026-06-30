"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-modal-shell";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import { DASHBOARD_DAY_DRILLDOWN_AREA_COMBOBOX_TRIGGER_CLASS } from "@/lib/dashboard-toolbar-ui";
import { useComboboxCloseOnPointerDistance } from "@/lib/use-combobox-close";
import { useHeaderToolbarDropdownPosition } from "@/lib/use-header-toolbar-dropdown-position";

export const DASHBOARD_DAY_DRILLDOWN_ALL_AREAS_VALUE = "__all__";

type AreaOption = {
  id: string;
  name: string;
};

type Props = {
  areas: readonly AreaOption[];
  value: string | null;
  onChange: (areaId: string | null) => void;
  /** Gemessene Breite des Buttons „Wochenübersicht“ — Standardbreite der Combobox. */
  referenceWidthPx?: number | null;
  disabled?: boolean;
};

function measureElementWidth(element: HTMLElement | null): number {
  if (!element) return 0;
  return Math.ceil(element.getBoundingClientRect().width);
}

export function DashboardDayDrilldownAreaCombobox({
  areas,
  value,
  onChange,
  referenceWidthPx = null,
  disabled = false,
}: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [contentWidthPx, setContentWidthPx] = useState(0);

  const options = useMemo(
    () => [
      {
        value: DASHBOARD_DAY_DRILLDOWN_ALL_AREAS_VALUE,
        label: t("dashboard.dayDrilldownAllAreas"),
      },
      ...areas.map((area) => ({ value: area.id, label: area.name })),
    ],
    [areas, t]
  );

  const selectedValue = value ?? DASHBOARD_DAY_DRILLDOWN_ALL_AREAS_VALUE;
  const selected =
    options.find((option) => option.value === selectedValue) ?? options[0];

  useLayoutEffect(() => {
    const measureRoot = measureRef.current;
    if (!measureRoot) {
      setContentWidthPx(0);
      return;
    }

    let maxWidth = 0;
    for (const element of measureRoot.children) {
      maxWidth = Math.max(maxWidth, measureElementWidth(element as HTMLElement));
    }
    setContentWidthPx(maxWidth);
  }, [options]);

  const controlWidthPx = useMemo(() => {
    if (referenceWidthPx == null && contentWidthPx <= 0) {
      return null;
    }
    if (referenceWidthPx == null) {
      return contentWidthPx;
    }
    if (contentWidthPx <= 0) {
      return referenceWidthPx;
    }
    return Math.max(referenceWidthPx, contentWidthPx);
  }, [contentWidthPx, referenceWidthPx]);

  const close = () => setOpen(false);
  useComboboxCloseOnPointerDistance(open, close, [rootRef, listRef]);

  const resolveDropdownWidth = useCallback(
    (rect: DOMRect) => controlWidthPx ?? rect.width,
    [controlWidthPx]
  );

  const dropdownStyle = useHeaderToolbarDropdownPosition(
    open,
    rootRef,
    { resolveWidth: resolveDropdownWidth },
    [controlWidthPx, options.length, value]
  );

  const dropdownPanel =
    open && !disabled && options.length > 0 && dropdownStyle ? (
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={t("dashboard.dayDrilldownAreaComboboxAriaLabel")}
        style={dropdownStyle}
        className={cn(
          "max-h-60 overflow-y-auto rounded-[5px] border border-border bg-surface py-1 shadow-lg",
          MODAL_SCROLLBAR_CLASS,
          "modal-scrollbar-inline"
        )}
      >
        {options.map((option) => {
          const isSelected = option.value === selectedValue;
          return (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(
                    option.value === DASHBOARD_DAY_DRILLDOWN_ALL_AREAS_VALUE
                      ? null
                      : option.value
                  );
                  close();
                }}
                className={cn(
                  "w-full whitespace-nowrap px-3 py-2 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-primary/10 font-semibold text-foreground"
                    : "text-foreground hover:bg-subtle"
                )}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  const controlWidthStyle =
    controlWidthPx != null
      ? ({
          ["--drilldown-combo-width" as string]: `${controlWidthPx}px`,
        } as CSSProperties)
      : undefined;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex w-full min-w-0 max-w-full sm:inline-flex sm:w-[var(--drilldown-combo-width)]"
      )}
      style={controlWidthStyle}
    >
      <div
        ref={measureRef}
        className="pointer-events-none invisible absolute left-0 top-0 -z-10 h-0 overflow-hidden"
        aria-hidden
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            tabIndex={-1}
            className={DASHBOARD_DAY_DRILLDOWN_AREA_COMBOBOX_TRIGGER_CLASS}
          >
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled || areas.length === 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={t("dashboard.dayDrilldownAreaComboboxAriaLabel")}
        data-open={open ? "true" : "false"}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          DASHBOARD_DAY_DRILLDOWN_AREA_COMBOBOX_TRIGGER_CLASS,
          "w-full"
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
