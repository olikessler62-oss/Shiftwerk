import { cn } from "@/lib/cn";
import { DASHBOARD_PANEL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";

/** Referenzhöhe: Wochenübersicht-, Bereichs- und Mitarbeiter-Kalender-Buttons. */
export const DASHBOARD_TOOLBAR_BUTTON_HEIGHT_CLASS = "min-h-[2.75rem]";

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

export const DASHBOARD_AREA_SCOPE_TOGGLE_SHELL_CLASS = cn(
  "inline-flex items-stretch rounded-[5px] border border-black/10 bg-white/80 p-0.5",
  DASHBOARD_TOOLBAR_BUTTON_HEIGHT_CLASS,
  "shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]"
);

export const DASHBOARD_AREA_SCOPE_TOGGLE_ACTIVE_CLASS = cn(
  "flex cursor-pointer items-center rounded-[4px] px-2.5 text-xs font-semibold whitespace-nowrap transition-colors duration-150 sm:text-sm",
  "border border-[color-mix(in_srgb,var(--brand-neon-cyan)_50%,rgb(10_38_82))]",
  "bg-[color-mix(in_srgb,var(--brand-neon-cyan)_55%,rgb(8_34_72))]",
  "text-white shadow-[0_1px_2px_0_rgba(15,23,42,0.12)]"
);

export const DASHBOARD_AREA_SCOPE_TOGGLE_INACTIVE_CLASS =
  "flex cursor-pointer items-center rounded-[4px] px-2.5 text-xs font-medium whitespace-nowrap text-muted transition-colors hover:text-foreground";

export const DASHBOARD_TEXT_LINK_BUTTON_CLASS = cn(
  DASHBOARD_TOOLBAR_BUTTON_HEIGHT_CLASS,
  "inline-flex items-center rounded-md px-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
);
