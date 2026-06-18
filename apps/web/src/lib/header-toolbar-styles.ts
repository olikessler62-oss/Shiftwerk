import { cn } from "@/lib/cn";

export const HEADER_TOOLBAR_CONTROL_H = "h-8 min-h-8";

const headerToolbarControlRadius = "rounded-[var(--radius-control)]";

const headerToolbarControlSurface = cn(
  headerToolbarControlRadius,
  "border shadow-none transition",
  "border-[var(--header-toolbar-combobox-border,#e2e8f0)] bg-foreground/[0.07]",
  "hover:bg-foreground/[0.11]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-toolbar-combobox-ring,rgb(92_122_158/0.35))]"
);

/** Selects (Standort, Bereich, Sprache). */
export const headerToolbarSelectClass = cn(
  HEADER_TOOLBAR_CONTROL_H,
  headerToolbarControlSurface,
  "header-toolbar-combobox-trigger w-full appearance-none truncate py-0 pl-3 pr-8 text-sm font-medium leading-8 text-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
  "!border-[var(--header-toolbar-combobox-border,#e2e8f0)] !bg-foreground/[0.07]",
  "hover:!bg-foreground/[0.11]",
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

/** Hervorgehobene Toolbar-Aktion (z. B. Kommunikation mit offenen Items). */
export const headerToolbarPillPrimaryClass = cn(
  HEADER_TOOLBAR_CONTROL_H,
  headerToolbarControlRadius,
  "header-toolbar-accent-button inline-flex items-center justify-center border-0 px-3.5 text-sm font-medium shadow-none",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-toolbar-combobox-ring,rgb(92_122_158/0.35))] disabled:cursor-not-allowed disabled:opacity-50"
);

/** Badge für Zähler (Glocke, Kommunikation). */
export const headerToolbarCountBadgeClass =
  "header-toolbar-count-badge rounded-full px-1.5 text-[11px] font-bold tabular-nums";

/** Wochennavigation: drei getrennte Buttons (zurück · heute · vor). */
export const headerToolbarWeekNavGroupClass =
  "flex shrink-0 items-center gap-1.5 sm:gap-2";
