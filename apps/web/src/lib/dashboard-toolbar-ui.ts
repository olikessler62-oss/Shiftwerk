import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";

/** Referenzhöhe: Wochenübersicht-, Bereichs- und Mitarbeiter-Kalender-Buttons. */
export const DASHBOARD_TOOLBAR_BUTTON_HEIGHT_CLASS = "min-h-[2.75rem]";

/** Dashboard-Kopfzeile: Titel + Kalender-Links — 70 % der Toolbar-Höhe. */
export const DASHBOARD_STATUS_BAR_COMPACT_HEIGHT_CLASS =
  "h-[calc(2.75rem*0.7)] min-h-[calc(2.75rem*0.7)]";

export const DASHBOARD_STATUS_BAR_COMPACT_NAV_BUTTON_CLASS = cn(
  DASHBOARD_PANEL_ROUNDED_CLASS,
  DASHBOARD_STATUS_BAR_COMPACT_HEIGHT_CLASS,
  "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap border border-black/20 px-2.5 text-xs font-semibold text-foreground shadow-[0_1px_3px_0_rgba(15,23,42,0.08)] transition-[filter,box-shadow] duration-150 sm:px-3 sm:text-sm",
  "bg-calendar-active-header",
  "hover:brightness-[0.98]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
);

/** Feste Höhe für `<Button>` — überschreibt Standard-Größen im Dashboard-Kontext. */
export const DASHBOARD_UI_BUTTON_CLASS = cn(
  DASHBOARD_TOOLBAR_BUTTON_HEIGHT_CLASS,
  "h-[2.75rem]"
);

export const DASHBOARD_PRIMARY_NAV_BUTTON_CLASS = cn(
  DASHBOARD_PANEL_ROUNDED_CLASS,
  DASHBOARD_TOOLBAR_BUTTON_HEIGHT_CLASS,
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap px-2.5 text-xs font-semibold text-white shadow-[0_1px_3px_0_rgba(15,23,42,0.18)] transition-colors duration-150 sm:px-3 sm:text-sm",
  "border border-[color-mix(in_srgb,var(--brand-neon-cyan)_50%,rgb(10_38_82))]",
  "bg-[color-mix(in_srgb,var(--brand-neon-cyan)_55%,rgb(8_34_72))]",
  "hover:bg-[color-mix(in_srgb,var(--brand-neon-cyan)_62%,rgb(12_42_88))]",
  "hover:text-[var(--header-toolbar-text-action-hover,#9ee8ff)]",
  "focus-visible:outline-none focus-visible:text-[var(--header-toolbar-text-action-hover,#9ee8ff)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--header-toolbar-text-action-hover)_35%,transparent)]"
);

/** Helle Toolbar-Buttons — Wochenübersicht, Kalender-Links, aktiver Heute/Woche-Schalter. */
export const DASHBOARD_LIGHT_NAV_BUTTON_CLASS = cn(
  DASHBOARD_PANEL_ROUNDED_CLASS,
  DASHBOARD_TOOLBAR_BUTTON_HEIGHT_CLASS,
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap border border-black/20 px-2.5 text-xs font-semibold text-foreground shadow-[0_1px_3px_0_rgba(15,23,42,0.08)] transition-[filter,box-shadow] duration-150 sm:px-3 sm:text-sm",
  "bg-calendar-active-header",
  "hover:brightness-[0.98]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
);

export const DASHBOARD_AREA_SCOPE_TOGGLE_SHELL_CLASS = cn(
  "inline-flex max-w-full items-stretch overflow-x-auto rounded-[5px] border border-black/10 bg-white/80 p-0.5",
  DASHBOARD_TOOLBAR_BUTTON_HEIGHT_CLASS,
  "shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]"
);

export const DASHBOARD_AREA_SCOPE_TOGGLE_ACTIVE_CLASS = cn(
  DASHBOARD_LIGHT_NAV_BUTTON_CLASS,
  "rounded-[4px] px-2.5 font-semibold sm:text-sm"
);

export const DASHBOARD_AREA_SCOPE_TOGGLE_INACTIVE_CLASS =
  "flex cursor-pointer items-center rounded-[4px] px-2.5 text-xs font-medium whitespace-nowrap text-muted transition-colors hover:text-foreground";

/** Drilldown Heute/Woche — 60 % der Standard-Toolbar-Höhe (2,75 rem → 1,65 rem). */
export const DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_HEIGHT_CLASS =
  "h-[1.65rem] min-h-[1.65rem]";

export const DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_SHELL_CLASS = cn(
  "inline-flex w-fit shrink-0 items-stretch overflow-hidden rounded-[4px] border border-black/10 bg-white/80 p-px",
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_HEIGHT_CLASS,
  "shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]"
);

export const DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_ACTIVE_CLASS = cn(
  DASHBOARD_PANEL_ROUNDED_CLASS,
  "inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap rounded-[3px] border border-black/20 px-2 text-xs font-semibold text-foreground shadow-[0_1px_2px_0_rgba(15,23,42,0.06)] transition-[filter,box-shadow] duration-150 sm:px-2.5",
  "bg-calendar-active-header",
  "hover:brightness-[0.98]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
);

export const DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_INACTIVE_CLASS = cn(
  "flex h-full shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[3px] px-2 text-xs font-medium text-muted transition-colors hover:text-foreground sm:px-2.5"
);

/** Drilldown — Einsatzübersicht-Button (gleiche Höhe wie Tag/Woche-Schalter). */
export const DASHBOARD_AREA_ASSIGNMENT_OVERVIEW_BUTTON_CLASS = cn(
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_ACTIVE_CLASS,
  "cursor-pointer"
);

export const DASHBOARD_TEXT_LINK_BUTTON_CLASS = cn(
  DASHBOARD_TOOLBAR_BUTTON_HEIGHT_CLASS,
  "inline-flex items-center rounded-md px-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
);
