import { cn } from "@/lib/cn";

/** Einheitlicher Radius für Modals und Dashboard-Flächen (5px). */
export const MODAL_ROUNDED_CLASS = "rounded-[5px]";

/** Dashboard-Flächen — max. 5px Radius, nur angedeutet. */
export const DASHBOARD_PANEL_ROUNDED_CLASS = MODAL_ROUNDED_CLASS;

/** Modal-Dialoge im Dashboard auf schmalen Viewports ohne Radius. */
export const DASHBOARD_MODAL_ROUNDED_CLASS = cn(
  MODAL_ROUNDED_CLASS,
  "max-sm:rounded-none"
);

/** Drilldown-Bereichskarten + Wochenübersicht-Tagkarten — einheitlicher Kopf. */
export const DASHBOARD_AREA_CARD_HEADER_SURFACE_CLASS = "bg-[#c7d4e5]";
export const DASHBOARD_AREA_CARD_HEADER_BORDER_CLASS = "border-b border-[#5c6678]";
/** Typo auf Drilldown-Kopfzeilen — Modal-Slot-Titel. */
export const DASHBOARD_AREA_CARD_HEADER_FOREGROUND = "#273b55";
export const DASHBOARD_AREA_CARD_HEADER_FOREGROUND_CLASS = "text-[#273b55]";
/** Silhouette-Plus-Icon in Bereichskarten-Zeilen. */
export const DASHBOARD_STAFFING_VACANCY_SILHOUETTE_COLOR = "#237dbf";
export const DASHBOARD_STAFFING_VACANCY_SILHOUETTE_CLASS = "text-[#237dbf]";
export const DASHBOARD_AREA_CARD_HEADER_FRAME_CLASS = cn(
  DASHBOARD_AREA_CARD_HEADER_BORDER_CLASS,
  DASHBOARD_AREA_CARD_HEADER_SURFACE_CLASS
);

export const DASHBOARD_CELL_BLOCKED_INFO_PANEL_CLASS =
  "flex min-h-0 flex-1 items-center justify-center rounded-[5px] bg-slate-100 text-xs text-slate-500";

/** Übersicht-Slide-in: 35rem + 30 % ≈ 45,5rem. */
export const DASHBOARD_ASSIGNMENT_OVERVIEW_PANEL_CLASS = "max-w-[45.5rem]";
