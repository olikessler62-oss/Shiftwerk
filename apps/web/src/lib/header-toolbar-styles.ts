import { cn } from "@/lib/cn";

export const HEADER_TOOLBAR_CONTROL_H = "h-8 min-h-8";

const headerToolbarControlRadius = "rounded-[var(--radius-control)]";

const headerToolbarControlSurface = cn(
  headerToolbarControlRadius,
  "border shadow-none transition",
  "border-[var(--header-toolbar-combobox-border,#e2e8f0)] bg-[var(--header-toolbar-control-bg,color-mix(in_srgb,var(--color-foreground)_7%,transparent))]",
  "hover:bg-[var(--header-toolbar-control-bg-hover,color-mix(in_srgb,var(--color-foreground)_11%,transparent))]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-toolbar-combobox-ring,rgb(92_122_158/0.35))]"
);

/** Selects (Standort, Bereich, Sprache). */
export const headerToolbarSelectClass = cn(
  HEADER_TOOLBAR_CONTROL_H,
  headerToolbarControlSurface,
  "header-toolbar-combobox-trigger w-full appearance-none truncate py-0 pl-3 pr-8 text-sm font-medium leading-8 text-foreground disabled:cursor-not-allowed disabled:opacity-50"
);

/** Standort/Bereich/Sprache — nur Text, eckig; Hover/Open: Blau-Türkis, ohne Rahmen. */
const headerToolbarTextSelectTriggerClass = cn(
  HEADER_TOOLBAR_CONTROL_H,
  "header-toolbar-combobox-trigger w-full appearance-none truncate py-0 pl-3 pr-8 text-sm font-medium leading-8 text-white",
  "rounded-none border-0 bg-transparent shadow-none transition-colors duration-150",
  "hover:border-0 hover:bg-transparent hover:text-[var(--header-toolbar-text-action-hover,#9ee8ff)] hover:shadow-none",
  "focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0 focus-visible:bg-transparent focus-visible:text-[var(--header-toolbar-text-action-hover,#9ee8ff)]",
  "data-[open=true]:border-0 data-[open=true]:bg-transparent data-[open=true]:text-[var(--header-toolbar-text-action-hover,#9ee8ff)] data-[open=true]:shadow-none",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export const headerToolbarLanguageSelectTriggerClass = cn(
  headerToolbarTextSelectTriggerClass,
  "header-toolbar-language-trigger"
);

export const headerToolbarPlacementSelectTriggerClass = cn(
  headerToolbarTextSelectTriggerClass,
  "header-toolbar-placement-trigger"
);

/** Schicht-Stati — Text-Aktion ohne Button-Fläche; Hover: helles Blau-Türkis. */
export const headerToolbarCommunicationButtonClass = cn(
  "header-toolbar-communication-trigger inline-flex shrink-0 cursor-pointer select-none items-center gap-1.5",
  "m-0 appearance-none border-0 bg-transparent p-0 text-sm font-semibold leading-none text-white shadow-none outline-none ring-0",
  "transition-colors duration-150",
  "hover:bg-transparent hover:text-[var(--header-toolbar-text-action-hover,#9ee8ff)]",
  "focus-visible:bg-transparent focus-visible:text-[var(--header-toolbar-text-action-hover,#9ee8ff)] focus-visible:outline-none focus-visible:ring-0",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

/** Glocke — Icon-Aktion ohne Fläche; Hover/Open: helles Blau-Türkis. */
export const headerToolbarBellTriggerClass = cn(
  "header-toolbar-bell-trigger relative inline-flex h-8 w-8 shrink-0 cursor-pointer select-none items-center justify-center",
  "m-0 appearance-none border-0 bg-transparent p-0 text-white shadow-none outline-none ring-0",
  "transition-colors duration-150",
  "hover:bg-transparent hover:text-[var(--header-toolbar-text-action-hover,#9ee8ff)]",
  "focus-visible:bg-transparent focus-visible:text-[var(--header-toolbar-text-action-hover,#9ee8ff)] focus-visible:outline-none focus-visible:ring-0",
  "data-[open=true]:bg-transparent data-[open=true]:text-[var(--header-toolbar-text-action-hover,#9ee8ff)]",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

/** Text-Buttons (Heute, Kommunikation). */
export const headerToolbarPillButtonClass = cn(
  HEADER_TOOLBAR_CONTROL_H,
  headerToolbarControlSurface,
  "inline-flex items-center justify-center !border px-3.5 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
);

/** Icon-Buttons (Woche ±, Glocke). */
export const headerToolbarPillIconButtonClass = cn(
  HEADER_TOOLBAR_CONTROL_H,
  "!h-8 !min-h-8 !w-8 !min-w-8",
  headerToolbarControlSurface,
  "inline-flex shrink-0 items-center justify-center text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
);

/** Wochennavigation: gemeinsame Fläche für Pfeil- und Heute-Button. */
const headerToolbarWeekNavSurface = cn(
  headerToolbarControlRadius,
  "border shadow-none transition",
  "!border-[var(--header-toolbar-combobox-border,#e2e8f0)] !bg-[var(--header-toolbar-control-bg,color-mix(in_srgb,var(--color-foreground)_7%,transparent))]",
  "hover:!bg-[var(--header-toolbar-control-bg-hover,color-mix(in_srgb,var(--color-foreground)_11%,transparent))]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-toolbar-combobox-ring,rgb(92_122_158/0.35))]",
  "!h-8 !min-h-8 inline-flex shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
);

export const headerToolbarWeekNavIconButtonClass = cn(
  headerToolbarWeekNavSurface,
  "!w-8 !min-w-8 text-muted hover:text-foreground"
);

export const headerToolbarWeekNavTodayButtonClass = cn(
  headerToolbarWeekNavSurface,
  "px-3.5 text-sm font-medium text-foreground"
);

/** Hervorgehobene Toolbar-Aktion — im Dark-Header dunkle Fläche, Text bleibt hell. */
export const headerToolbarPillPrimaryClass = cn(
  HEADER_TOOLBAR_CONTROL_H,
  headerToolbarControlRadius,
  "header-toolbar-accent-button inline-flex items-center justify-center border border-[var(--header-toolbar-combobox-border,#e2e8f0)] px-3.5 text-sm font-medium shadow-none",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-toolbar-combobox-ring,rgb(92_122_158/0.35))] disabled:cursor-not-allowed disabled:opacity-50"
);

/** Badge für Zähler (Glocke, Kommunikation). */
export const headerToolbarCountBadgeClass =
  "header-toolbar-count-badge rounded-full px-1.5 text-[11px] font-bold tabular-nums";

/** Wochennavigation: drei getrennte Buttons (zurück · heute · vor). */
export const headerToolbarWeekNavGroupClass =
  "flex shrink-0 items-center gap-1.5 sm:gap-2";

/** Wochen-Pfeile — Icon-Aktion ohne Fläche (wie Glocke). */
export const headerToolbarWeekNavChevronButtonClass = cn(
  "header-toolbar-week-nav-chevron relative inline-flex h-8 w-8 shrink-0 cursor-pointer select-none items-center justify-center",
  "m-0 appearance-none border-0 bg-transparent p-0 text-white shadow-none outline-none ring-0",
  "transition-colors duration-150",
  "hover:bg-transparent hover:text-[var(--header-toolbar-text-action-hover,#9ee8ff)]",
  "focus-visible:bg-transparent focus-visible:text-[var(--header-toolbar-text-action-hover,#9ee8ff)] focus-visible:outline-none focus-visible:ring-0",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

/** Heute — Text-Aktion ohne Fläche. */
export const headerToolbarWeekNavTodayTextButtonClass = cn(
  "header-toolbar-week-nav-today inline-flex shrink-0 cursor-pointer select-none items-center",
  "m-0 appearance-none border-0 bg-transparent p-0 text-sm font-medium leading-none text-white shadow-none outline-none ring-0",
  "transition-colors duration-150",
  "hover:bg-transparent hover:text-[var(--header-toolbar-text-action-hover,#9ee8ff)]",
  "focus-visible:bg-transparent focus-visible:text-[var(--header-toolbar-text-action-hover,#9ee8ff)] focus-visible:outline-none focus-visible:ring-0",
  "disabled:cursor-not-allowed disabled:opacity-50"
);
