"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  Button,
  ChevronDownIcon,
  ChevronUpIcon,
  ListIcon,
} from "@/components/ui";
import { cn } from "@/lib/cn";
export {
  SETTINGS_LIST_ITEM_ID_ATTR,
  applyCreatedListSelection,
  settingsListItemAttrs,
  scrollSettingsListItemIntoView,
  useScrollToSettingsListItem,
} from "@/lib/settings-list-scroll";

export const SETTINGS_MODAL_TITLE_CLASS = "text-xl font-semibold text-foreground";

export const SETTINGS_LIST_SCROLL_CLASS =
  "max-h-[min(calc(2rem+13.5rem),calc(100dvh-18rem))] overflow-y-auto";

export const SETTINGS_LIST_SCROLL_COMPACT_CLASS =
  "h-[calc(2rem+11rem)] min-h-[calc(2rem+11rem)] max-h-[calc(2rem+11rem)] overflow-y-auto";

/** Tabellenkopf (~2.5rem) + 8 Datenzeilen à ~2.2rem — feste Höhe in beiden Profile-Spalten */
export const SETTINGS_PROFILES_LIST_SCROLL_CLASS =
  "h-[calc(2.5rem+17.6rem)] min-h-[calc(2.5rem+17.6rem)] max-h-[calc(2.5rem+17.6rem)]";

/** Halbe Listenhöhe — Position / Verfügbarkeiten in der Profil-Spalte */
export const SETTINGS_PROFILES_HALF_LIST_SCROLL_CLASS =
  "h-[calc(2.5rem+8.8rem)] min-h-[calc(2.5rem+8.8rem)] max-h-[calc(2.5rem+8.8rem)]";

export function settingsPanelHeaderClass() {
  return "shrink-0 truncate border-b border-border bg-subtle px-3 py-2.5 text-sm font-medium text-foreground";
}

export function settingsColumnHeaderClass(
  align: "left" | "center" | "right" = "left"
) {
  return cn(
    "px-2 pb-2 text-sm font-medium text-muted",
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left"
  );
}

export function settingsDataRowClass(isSelected: boolean) {
  return cn(
    "cursor-pointer select-none border-b border-border/70 transition-[background-color,box-shadow] last:border-0",
    "min-h-[2.75rem] hover:cursor-pointer hover:bg-subtle hover:shadow-sm",
    isSelected && "bg-primary/5 shadow-sm ring-1 ring-inset ring-primary/20"
  );
}

export function SettingsActionRow({
  icon,
  label,
  hint,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
        disabled
          ? "cursor-not-allowed opacity-45"
          : "cursor-pointer hover:cursor-pointer hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted transition-colors",
          !disabled &&
            "group-hover:border-primary/25 group-hover:bg-primary/5 group-hover:text-primary"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {label}
        </span>
        {typeof hint === "string" ? (
          <span className="block truncate text-xs text-muted">{hint}</span>
        ) : (
          hint
        )}
      </span>
    </button>
  );
}

export function settingsIndicatorCellClass(isSelected: boolean) {
  return cn(
    "w-1 border-l-4 p-0",
    isSelected ? "border-l-primary" : "border-l-transparent"
  );
}

export function settingsDataCellClass(
  isSelected: boolean,
  opts?: {
    align?: "left" | "center" | "right";
    withIndicator?: boolean;
    className?: string;
  }
) {
  const align = opts?.align ?? "left";
  const withIndicator = opts?.withIndicator ?? false;
  return cn(
    "min-h-[2.75rem] px-2 py-2 text-sm tabular-nums text-foreground",
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left",
    withIndicator &&
      cn(
        "border-l-4 font-medium",
        isSelected ? "border-l-primary" : "border-l-transparent"
      ),
    opts?.className
  );
}

type EmptyStateProps = {
  message: string;
  hint?: string;
  className?: string;
};

export function SettingsEmptyState({ message, hint, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-10 text-center",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ListIcon className="size-5" />
      </div>
      <p className="text-sm text-foreground">{message}</p>
      {hint ? <p className="max-w-xs text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

type StatusDotProps = {
  variant: "success" | "danger" | "inactive";
  label: string;
};

export function StatusDot({ variant, label }: StatusDotProps) {
  if (variant === "inactive") {
    return (
      <span className="text-sm text-muted" title={label} aria-label={label}>
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-block size-2.5 rounded-full",
        variant === "success" && "bg-emerald-600",
        variant === "danger" && "bg-red-600"
      )}
      title={label}
      aria-label={label}
    />
  );
}

export function SettingsPrimaryActionButton({
  label,
  icon,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: string;
  icon: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      title={label}
      className={cn(
        "h-8 cursor-pointer gap-1.5 px-2.5 text-sm hover:cursor-pointer",
        className
      )}
      {...props}
    >
      {icon}
      {label}
    </Button>
  );
}

export function SettingsReorderButtons({
  moveUpLabel,
  moveDownLabel,
  disabled,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  moveUpLabel: string;
  moveDownLabel: string;
  disabled?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <>
      <SettingsIconActionButton
        label={moveUpLabel}
        icon={<ChevronUpIcon />}
        disabled={disabled || !canMoveUp}
        onClick={onMoveUp}
      />
      <SettingsIconActionButton
        label={moveDownLabel}
        icon={<ChevronDownIcon />}
        disabled={disabled || !canMoveDown}
        onClick={onMoveDown}
      />
    </>
  );
}

export function SettingsIconActionButton({
  label,
  icon,
  className,
  variant = "outline",
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: string;
  icon: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      aria-label={label}
      title={label}
      className={cn(
        "h-8 w-8 shrink-0 cursor-pointer gap-0 p-0 text-sm hover:cursor-pointer",
        className
      )}
      {...props}
    >
      {icon}
    </Button>
  );
}

type SettingsActionBarProps = {
  primary: ReactNode;
  secondary?: ReactNode;
  destructive?: ReactNode;
};

export function SettingsActionBar({
  primary,
  secondary,
  destructive,
}: SettingsActionBarProps) {
  return (
    <div className="flex h-11 shrink-0 flex-nowrap items-center gap-1.5 border-t border-border bg-subtle px-2">
      {primary}
      {secondary}
      {destructive ? (
        <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-border pl-2">
          {destructive}
        </div>
      ) : null}
    </div>
  );
}
