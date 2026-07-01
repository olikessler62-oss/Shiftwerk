"use client";

import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  Button,
  Checkbox,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  IconButton,
  ListIcon,
  Tooltip,
  TrashIcon,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { settingsModalHeaderPaddingClass, settingsConfirmDialogClass, settingsModalBodyPaddingClass, settingsModalFooterClass } from "@/components/settings/settings-modal-shell";
export {
  SETTINGS_LIST_ITEM_ID_ATTR,
  applyCreatedListSelection,
  settingsListItemAttrs,
  scrollSettingsListItemIntoView,
  useScrollToSettingsListItem,
} from "@/lib/settings-list-scroll";

/** Modal- und Slide-Panel-Überschriften — skaliert auf schmalen Viewports. */
export const SETTINGS_MODAL_TITLE_CLASS =
  "text-base font-semibold leading-tight text-foreground sm:text-lg md:text-xl";

type SettingsModalHeaderProps = {
  title?: ReactNode;
  titleId?: string;
  subtitle?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  closeAriaLabel: string;
  className?: string;
  children?: ReactNode;
};

/** Modal-Kopf mit Schließen-Button oben rechts. */
export function SettingsModalHeader({
  title,
  titleId,
  subtitle,
  onClose,
  closeDisabled = false,
  closeAriaLabel,
  className,
  children,
}: SettingsModalHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-border",
        settingsModalHeaderPaddingClass(),
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {children ?? (
          <>
            {title != null ? (
              <h2 id={titleId} className={SETTINGS_MODAL_TITLE_CLASS}>
                {title}
              </h2>
            ) : null}
            {subtitle != null ? (
              typeof subtitle === "string" ? (
                <p className="mt-1 text-sm text-muted">{subtitle}</p>
              ) : (
                subtitle
              )
            ) : null}
          </>
        )}
      </div>
      <IconButton
        size="sm"
        onClick={onClose}
        disabled={closeDisabled}
        aria-label={closeAriaLabel}
        className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
      >
        <CloseIcon className="h-[18px] w-[18px]" />
      </IconButton>
    </div>
  );
}

/** Nur Schließen-Button für kleine Bestätigungsdialoge (ohne farbige Kopfleiste). */
export function SettingsConfirmDialogCloseHeader({
  onClose,
  closeDisabled = false,
  closeAriaLabel,
  title,
  titleId,
}: {
  onClose: () => void;
  closeDisabled?: boolean;
  closeAriaLabel: string;
  title?: ReactNode;
  titleId?: string;
}) {
  if (title != null && titleId != null) {
    return (
      <SettingsModalHeader
        title={title}
        titleId={titleId}
        onClose={onClose}
        closeDisabled={closeDisabled}
        closeAriaLabel={closeAriaLabel}
      />
    );
  }

  return (
    <div className="flex justify-end px-4 pt-3 sm:px-5 sm:pt-4">
      <IconButton
        size="sm"
        onClick={onClose}
        disabled={closeDisabled}
        aria-label={closeAriaLabel}
        className="border-transparent bg-transparent hover:bg-subtle"
      >
        <CloseIcon className="h-[18px] w-[18px]" />
      </IconButton>
    </div>
  );
}

type SettingsConfirmDialogShellProps = {
  title: ReactNode;
  titleId: string;
  onClose: () => void;
  closeDisabled?: boolean;
  closeAriaLabel: string;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
};

/** Einheitliches Layout für kleine Bestätigungsdialoge. */
export function SettingsConfirmDialogShell({
  title,
  titleId,
  onClose,
  closeDisabled = false,
  closeAriaLabel,
  children,
  footer,
  className,
}: SettingsConfirmDialogShellProps) {
  return (
    <div className={cn(settingsConfirmDialogClass(), "overflow-hidden p-0", className)}>
      <SettingsModalHeader
        title={title}
        titleId={titleId}
        onClose={onClose}
        closeDisabled={closeDisabled}
        closeAriaLabel={closeAriaLabel}
      />
      <div className={settingsModalBodyPaddingClass()}>{children}</div>
      <div className={settingsModalFooterClass()}>{footer}</div>
    </div>
  );
}

/** Untertitel in Slide-Panels (PlanningSidePanel). */
export const PLANNING_SIDE_PANEL_SUBTITLE_CLASS =
  "mt-0.5 min-w-0 break-words text-xs text-muted sm:text-sm";

export {
  MODAL_SCROLLBAR_CLASS,
  SETTINGS_MODAL_MAX_WIDTH,
  settingsConfirmDialogClass,
  settingsFixedNestedOverlayClass,
  settingsMasterDetailLayoutClass,
  settingsMasterDetailListsClass,
  settingsModalBackdropClass,
  settingsModalBodyPaddingClass,
  settingsModalDialogClass,
  settingsModalFooterClass,
  settingsModalHeaderClass,
  settingsModalHeaderPaddingClass,
  SETTINGS_MODAL_HEADER_BG_CLASS,
  settingsNestedModalDialogClass,
  settingsNestedModalOverlayClass,
  settingsResponsiveTableWrapClass,
  settingsResponsiveWindowFieldsClass,
  settingsModalRootClass,
  settingsSubModalDialogClass,
  settingsSubModalOverlayClass,
  areaCalendarAlertDialogClass,
  areaCalendarModalBackdropClass,
  areaCalendarModalDialogClass,
  areaCalendarNestedModalOverlayClass,
} from "./settings-modal-shell";

export const SETTINGS_LIST_SCROLL_CLASS =
  "max-h-[min(calc(1.75rem+10.5rem),calc(100dvh-18rem))] overflow-auto";

/** Tabellenkopf (~1.75rem) + max. 4 sichtbare Datenzeilen à ~1.75rem */
export const SETTINGS_FOUR_ROW_TABLE_LIST_SCROLL_CLASS =
  "h-[calc(1.75rem+7rem)] min-h-[calc(1.75rem+7rem)] max-h-[calc(1.75rem+7rem)] overflow-auto";

/** Personalbedarf-Panel: Tabellenkopf (~1.25rem) + 7 Zeilen à 25px + 100px */
export const SETTINGS_STAFFING_PANEL_LIST_SCROLL_CLASS =
  "h-[calc(1.25rem+7*25px+100px)] min-h-[calc(1.25rem+7*25px+100px)] max-h-[calc(1.25rem+7*25px+100px)] overflow-y-auto overflow-x-hidden";

export const SETTINGS_LIST_SCROLL_COMPACT_CLASS =
  SETTINGS_FOUR_ROW_TABLE_LIST_SCROLL_CLASS;

/** Tabellenkopf (~1.75rem) + max. 10 sichtbare Datenzeilen à ~1.75rem */
export const OVERVIEW_ABSENCES_LIST_SCROLL_CLASS =
  "max-h-[calc(1.75rem+17.5rem)] overflow-auto";

/** Mitarbeiter-Combobox Übersicht Verfügbarkeiten/Abwesenheiten: Listenpadding + max. 10 Zeilen à h-9 (2.25rem) */
export const OVERVIEW_EMPLOYEE_JUMP_COMBOBOX_LIST_SCROLL_CLASS =
  "max-h-[calc(0.5rem+22.5rem)] overflow-y-auto";

/** Tabellenkopf (~1.75rem) + max. 4 sichtbare Datenzeilen à ~1.75rem */
export const SETTINGS_ABSENCES_LIST_SCROLL_CLASS =
  "max-h-[calc(1.75rem+7rem)] overflow-auto";

/** Tabellenkopf + max. 6 Zeilen — Bulk-Schichtzuweisung */
export const BULK_SHIFT_LIST_SCROLL_CLASS =
  "max-h-[calc(2.5rem+18rem)] overflow-y-auto";

/** Tabellenkopf (~1.75rem) + 8 Datenzeilen à ~1.75rem — Profile-Liste (fest) */
export const SETTINGS_PROFILES_LIST_SCROLL_CLASS =
  "h-[calc(1.75rem+14rem)] min-h-[calc(1.75rem+14rem)] max-h-[calc(1.75rem+14rem)]";

/** Profile master list: wächst mit dem Inhalt unterhalb der Scroll-Schwelle */
export const SETTINGS_PROFILES_LIST_COMPACT_CLASS = "shrink-0";

/** Ab 11 Mitarbeitern: Tabellenkopf (~2rem) + max. 10 sichtbare Zeilen à h-9 (2.25rem) */
export const SETTINGS_PROFILES_LIST_SCROLL_THRESHOLD = 11;
export const SETTINGS_PROFILES_LIST_SCROLL_FROM_ELEVEN_CLASS =
  "min-h-0 max-h-[calc(2rem+22.5rem)] overflow-y-auto";

/** @deprecated Use SETTINGS_PROFILES_LIST_SCROLL_FROM_ELEVEN_CLASS */
export const SETTINGS_PROFILES_LIST_SCROLL_FROM_TEN_CLASS =
  SETTINGS_PROFILES_LIST_SCROLL_FROM_ELEVEN_CLASS;
/** @deprecated Use SETTINGS_PROFILES_LIST_SCROLL_FROM_ELEVEN_CLASS */
export const SETTINGS_PROFILES_LIST_SCROLL_FROM_NINE_CLASS =
  SETTINGS_PROFILES_LIST_SCROLL_FROM_ELEVEN_CLASS;
export const SETTINGS_PROFILES_LIST_AUTO_SCROLL_CLASS =
  SETTINGS_PROFILES_LIST_COMPACT_CLASS;

/**
 * Profile master-detail: Spaltenkopf + Listenpadding + 10 Tabellenzeilen (h-9) + Action-Bar.
 * Verhindert Größenänderungen der Maske beim Profilwechsel.
 */
export const SETTINGS_PROFILES_MASTER_DETAIL_MIN_HEIGHT_CLASS =
  "min-h-[calc(2.75rem+1rem+2rem+22.5rem+2.75rem)]";

/** Halbe Listenhöhe — Funktion / Verfügbarkeiten in der Profil-Spalte */
export const SETTINGS_PROFILES_HALF_LIST_SCROLL_CLASS =
  "h-[calc(1.75rem+7rem)] min-h-[calc(1.75rem+7rem)] max-h-[calc(1.75rem+7rem)]";

/** Eingebettete Profil-Detail-Listen — wächst mit Inhalt, scrollt ab ~4 Zeilen. */
export const SETTINGS_EMBEDDED_DETAIL_LIST_SCROLL_CLASS =
  "w-full max-h-[calc(1.75rem+7rem)] overflow-auto shrink-0";

export const SETTINGS_EMBEDDED_EMPTY_STATE_CLASS = "min-h-[5rem]";

/** Shell eingebetteter Profil-Detail-Panels — kompakt vertikal, volle Panelbreite. */
export function settingsEmbeddedDetailPanelShellClass(className?: string) {
  return cn("relative flex w-full flex-col shrink-0", className);
}

export function settingsEmbeddedDetailPanelInnerClass(className?: string) {
  return cn(
    "flex w-full flex-col shrink-0 overflow-hidden bg-background",
    className
  );
}

export function settingsEmbeddedDetailPanelBodyClass(className?: string) {
  return cn("w-full shrink-0 overflow-hidden px-4 py-3", className);
}

/** Listenhöhe in eingebetteten Profil-Detail-Panels (kompakt bei wenigen Zeilen). */
export function settingsProfileEmbeddedListScrollClass(itemCount: number) {
  return itemCount > 4
    ? SETTINGS_EMBEDDED_DETAIL_LIST_SCROLL_CLASS
    : cn(SETTINGS_PROFILES_LIST_COMPACT_CLASS, "w-full");
}

export function settingsPanelHeaderClass() {
  return "shrink-0 truncate border-b border-border bg-subtle px-3 py-2.5 text-sm font-medium text-foreground";
}

export function settingsColumnHeaderClass(
  align: "left" | "center" | "right" = "left"
) {
  return cn(
    "px-2 py-1 pb-1 text-xs font-medium text-muted",
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left"
  );
}

/** Scroll-Container für Tabellenlisten — ein Scrollport, kein overflow-x-Wrapper (sticky thead). */
export function settingsScrollableTableListClass(className?: string) {
  return cn(
    "min-h-0 overflow-auto rounded-md border border-border bg-surface",
    className
  );
}

export function settingsStickyIndicatorHeaderClass(className?: string) {
  return cn("sticky top-0 z-[2] w-1 bg-subtle p-0", className);
}

export function settingsStickyColumnHeaderClass(
  align: "left" | "center" | "right" = "left",
  className?: string
) {
  return cn(
    settingsColumnHeaderClass(align),
    "sticky top-0 z-[1] bg-subtle",
    className
  );
}

export function settingsDataRowClass(isSelected: boolean) {
  return cn(
    "cursor-pointer select-none border-b border-border/70 transition-[background-color,box-shadow] last:border-0",
    "hover:cursor-pointer hover:bg-subtle hover:shadow-sm",
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
        "group flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
        disabled
          ? "cursor-not-allowed opacity-45"
          : "cursor-pointer hover:cursor-pointer hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted transition-colors",
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
        <span className="block min-h-5 min-w-0">
          {typeof hint === "string" ? (
            <span className="block truncate text-xs text-muted">{hint}</span>
          ) : (
            hint
          )}
        </span>
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

export function settingsListRowDeleteHeaderClass(className?: string) {
  return cn(
    settingsStickyColumnHeaderClass("center"),
    "w-8 px-0 py-1 pb-1",
    className
  );
}

export function settingsListRowCheckboxHeaderClass(className?: string) {
  return cn(
    settingsStickyColumnHeaderClass("center"),
    "w-9 px-0 py-1 pb-1",
    className
  );
}

export function settingsListRowCheckboxCellClass(
  isSelected: boolean,
  className?: string
) {
  return cn(
    settingsDataCellClass(isSelected, { align: "center" }),
    "w-9 px-0",
    className
  );
}

export function settingsListRowDeleteCellClass(
  isSelected: boolean,
  className?: string
) {
  return cn(
    settingsDataCellClass(isSelected, { align: "center" }),
    "w-8 px-0",
    className
  );
}

/** Übersicht Verfügbarkeiten/Abwesenheiten: Checkbox + Papierkorb als eine Aktionsgruppe */
export function settingsOverviewListRowActionsHeaderClass(className?: string) {
  return cn(
    settingsStickyColumnHeaderClass("center"),
    "w-[3.125rem] px-0 py-1 pb-1",
    className
  );
}

export function settingsOverviewListRowActionsCellClass(
  isSelected: boolean,
  className?: string
) {
  return cn(
    settingsDataCellClass(isSelected, { align: "center" }),
    "w-[3.125rem] px-0",
    className
  );
}

export function SettingsOverviewListRowActions({
  isSelected,
  checkbox,
  deleteButton,
  className,
}: {
  isSelected: boolean;
  checkbox: ReactNode;
  deleteButton: ReactNode;
  className?: string;
}) {
  return (
    <td className={settingsOverviewListRowActionsCellClass(isSelected, className)}>
      <div className="flex items-center justify-center -space-x-0.5">
        {checkbox}
        {deleteButton}
      </div>
    </td>
  );
}

export function SettingsListRowDeleteButton({
  label,
  disabled,
  onClick,
  className,
  title,
  showTooltip = true,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  title?: string;
  showTooltip?: boolean;
}) {
  const button = (
    <IconButton
      size="sm"
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "mb-0 shrink-0 border-transparent bg-transparent hover:bg-subtle disabled:opacity-40",
        className
      )}
    >
      <TrashIcon className="h-4 w-4" />
    </IconButton>
  );

  if (!showTooltip) return button;

  return <Tooltip content={title ?? label}>{button}</Tooltip>;
}

export function shouldIgnoreSettingsListRowActivation(
  event: MouseEvent<HTMLElement>
): boolean {
  return !!(event.target as HTMLElement | null)?.closest(
    "label, button, input, textarea, select, a, [role='checkbox']"
  );
}

export function SettingsListRowCheckbox({
  checked,
  disabled,
  ariaLabel,
  onChange,
  className,
}: {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onChange: () => void;
  className?: string;
}) {
  return (
    <span
      className="inline-flex"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn("mx-auto", className)}
        onChange={(event) => {
          event.stopPropagation();
          onChange();
        }}
      />
    </span>
  );
}

export function SettingsListSelectAllCheckbox({
  checked,
  indeterminate,
  disabled,
  ariaLabel,
  onChange,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onChange: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate ?? false;
    }
  }, [indeterminate]);

  return (
    <Checkbox
      ref={inputRef}
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn("mx-auto", className)}
      onChange={onChange}
    />
  );
}

export function SettingsBulkDeleteActionButton({
  label,
  disabled,
  onClick,
  className,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <SettingsIconActionButton
      label={label}
      tooltip={label}
      icon={<TrashIcon />}
      variant="outline"
      disabled={disabled}
      className={className}
      onClick={onClick}
    />
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
    "min-h-0 px-2 py-0.5 text-sm leading-tight tabular-nums text-foreground",
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

/** Platzhalter bis alle Modal-Daten geladen sind — verhindert Layout-Sprünge. */
export function SettingsModalLoadingBody({
  message,
  variant = "list-panel",
  className,
}: {
  message: string;
  variant?: "list-panel" | "form" | "staffing-panel";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center px-4 py-6",
        variant === "list-panel" &&
          "min-h-[calc(1.75rem+7rem+3.5rem)]",
        variant === "form" && "min-h-[12rem]",
        variant === "staffing-panel" &&
          "min-h-[calc(1.25rem+8.75rem+3.5rem)]",
        className
      )}
      aria-live="polite"
    >
      <p className="text-sm text-muted">{message}</p>
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
      <Tooltip content={label}>
        <span className="text-sm text-muted" aria-label={label}>
          —
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={label}>
      <span
        className={cn(
          "inline-block size-2.5 rounded-full",
          variant === "success" && "bg-emerald-600",
          variant === "danger" && "bg-red-600"
        )}
        aria-label={label}
      />
    </Tooltip>
  );
}

export function SettingsPrimaryActionButton({
  label,
  icon,
  className,
  tooltip,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: string;
  icon: ReactNode;
  tooltip?: string;
}) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
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

  if (!tooltip) return button;

  return <Tooltip content={tooltip}>{button}</Tooltip>;
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
  tooltip,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: string;
  icon: ReactNode;
  tooltip?: string;
}) {
  return (
    <Tooltip content={tooltip ?? label}>
      <Button
        type="button"
        variant={variant}
        size="sm"
        aria-label={label}
        className={cn(
          "h-8 w-8 shrink-0 cursor-pointer gap-0 p-0 text-sm hover:cursor-pointer",
          className
        )}
        {...props}
      >
        {icon}
      </Button>
    </Tooltip>
  );
}

type SettingsActionBarProps = {
  primary: ReactNode;
  secondary?: ReactNode;
  destructive?: ReactNode;
  trailing?: ReactNode;
};

export function SettingsActionBar({
  primary,
  secondary,
  destructive,
  trailing,
}: SettingsActionBarProps) {
  const rightSlot = trailing ?? destructive;
  return (
    <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-1.5 border-t border-border bg-subtle px-2 py-1.5 sm:h-11 sm:flex-nowrap sm:py-0">
      {primary}
      {secondary}
      {rightSlot ? (
        <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-border pl-2">
          {rightSlot}
        </div>
      ) : null}
    </div>
  );
}
