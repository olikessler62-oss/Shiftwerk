/** Haupt-Sidebar (Navigation + Slot unter der Logo-Zeile). */
export const APP_SHELL_SIDEBAR_CLASS = "app-shell-sidebar";

/** Gemeinsame Desktop-Höhe: Sidebar-Logo-Zeile und Wochen-Toolbar (Trennlinie bündig). */
export const APP_SHELL_TOP_HEADER_ROW_MD_CLASS = "md:min-h-16 md:py-3";

/** Logo-Zeile in der Sidebar — Mobile fest, Desktop gleiche Höhe wie Wochen-Toolbar. */
export const APP_SHELL_BRAND_HEADER_CLASS = `h-[5.5rem] md:h-auto ${APP_SHELL_TOP_HEADER_ROW_MD_CLASS}`;

/** TESTWEISE: Dark-Mode-Farben nur für Header-Zeilen (siehe globals.css). */
export const APP_HEADER_DARK_PREVIEW_CLASS = "app-header-dark-preview";

/** Abstand unter der KW-Toolbar bis Kalender-Inhalt (Dashboard; Bereich-Kalender nur Kalender-Spalte). */
export const APP_SHELL_CONTENT_OFFSET_CLASS = "pt-2 md:pt-4";

/**
 * App-Shell Root: Mobile Seiten-Scroll; ab md unverändert (volle Viewport-Höhe, kein Body-Scroll).
 */
export const APP_SHELL_ROOT_CLASS =
  "flex min-h-dvh flex-col overflow-y-auto md:h-dvh md:min-h-0 md:overflow-hidden md:flex-row";

/** Hauptinhalt rechts/unten — Desktop weiterhin flex-1 + overflow-hidden. */
export const APP_SHELL_CONTENT_COLUMN_CLASS =
  "flex min-w-0 flex-col max-md:flex-none md:min-h-0 md:flex-1";

export const APP_SHELL_MAIN_CLASS =
  "flex flex-col p-4 max-md:overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden md:p-6";

/** Dashboard-Sidebar-Slot unter dem Logo — Mobile natürliche Höhe, Desktop flex-fill. */
export const APP_SHELL_SIDEBAR_SLOT_CLASS =
  "flex flex-col overflow-y-auto px-3 pb-3 max-md:shrink-0 max-md:flex-none md:min-h-0 md:flex-1";

/** Planungsseiten: Kalender-Container — Mobile Mindesthöhe für Innen-Scroll, Desktop flex-fill. */
export const PLANNING_PAGE_CALENDAR_SECTION_CLASS =
  "flex min-h-0 flex-1 flex-col max-md:min-h-[min(70dvh,40rem)] max-md:overflow-visible md:overflow-hidden";

export const PLANNING_PAGE_CALENDAR_MAIN_CLASS =
  "flex min-w-0 flex-1 flex-col max-md:min-h-[min(70dvh,40rem)] max-md:overflow-visible md:min-h-0 md:overflow-hidden";

/** Bereich-Kalender Root — Mobile keine fixe Shell-Höhe. */
export const AREA_CALENDAR_VIEW_ROOT_CLASS =
  "-mx-4 -mt-4 -mb-4 flex min-h-0 flex-col bg-background pb-[10px] max-md:h-auto md:-mx-6 md:-mt-6 md:-mb-6 md:h-[calc(100%+48px)]";

/** Dashboard Root — Mobile wächst mit Inhalt. */
export const DASHBOARD_VIEW_ROOT_CLASS =
  "-m-4 flex min-h-0 flex-col bg-subtle md:-m-6 md:min-h-[calc(100vh-4.5rem)]";

/** Höhen-Pendant für Sidebar-Trennlinie unter dem Logo (Bereich-Kalender). */
export const APP_SHELL_BRAND_HEADER_CONTENT_ALIGN_CLASS = "h-2 md:h-4";

/** Wochen-Toolbar im Hauptbereich (Dashboard / Bereich-Kalender). */
export const APP_PAGE_TOOLBAR_HEADER_CLASS =
  `${APP_HEADER_DARK_PREVIEW_CLASS} app-page-toolbar-header flex shrink-0 flex-col gap-2.5 border-b border-border px-4 py-2.5 md:flex-row md:items-center md:justify-between md:gap-3 md:px-6 ${APP_SHELL_TOP_HEADER_ROW_MD_CLASS}`;
