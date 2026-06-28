import { cn } from "@/lib/cn";

/** Dashboard-Flächen — max. 5px Radius, nur angedeutet. */
export const DASHBOARD_PANEL_ROUNDED_CLASS = "rounded-[5px]";

/** Modal-Dialoge im Dashboard (überschreibt Shell-`rounded-2xl`). */
export const DASHBOARD_MODAL_ROUNDED_CLASS =
  "rounded-[5px] max-sm:rounded-none";

/** Drilldown-Bereichskarten + Wochenübersicht-Tagkarten — einheitlicher Kopf. */
export const DASHBOARD_AREA_CARD_HEADER_SURFACE_CLASS = "bg-[#c7d4e5]";
export const DASHBOARD_AREA_CARD_HEADER_BORDER_CLASS = "border-b border-[#5c6678]";
export const DASHBOARD_AREA_CARD_HEADER_FRAME_CLASS = cn(
  DASHBOARD_AREA_CARD_HEADER_BORDER_CLASS,
  DASHBOARD_AREA_CARD_HEADER_SURFACE_CLASS
);

export const DASHBOARD_CELL_BLOCKED_INFO_PANEL_CLASS =
  "flex min-h-0 flex-1 items-center justify-center rounded-[5px] bg-slate-100 text-xs text-slate-500";
