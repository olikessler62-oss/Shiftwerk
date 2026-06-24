/** Haupt-Sidebar (Navigation + Slot unter der Logo-Zeile). */
export const APP_SHELL_SIDEBAR_CLASS = "app-shell-sidebar";

/** Gemeinsame Desktop-Höhe: Sidebar-Logo-Zeile und Wochen-Toolbar (Trennlinie bündig). */
export const APP_SHELL_TOP_HEADER_ROW_MD_CLASS = "md:min-h-16 md:py-3";

/** Logo-Zeile in der Sidebar — gleiche Höhe wie Wochen-Toolbar (CSS-Variable). */
export const APP_SHELL_BRAND_HEADER_CLASS =
  "h-[var(--app-shell-brand-band-height)] min-h-[var(--app-shell-brand-band-height)] max-h-[var(--app-shell-brand-band-height)]";

/** Glas-Surface auf der gemeinsamen Brand-Backdrop-Schicht. */
export const APP_SHELL_BRAND_SURFACE_CLASS = "app-shell-brand-surface";

/** TESTWEISE: Dark-Mode-Farben nur für Header-Zeilen (siehe globals.css). */
export const APP_HEADER_DARK_PREVIEW_CLASS =
  `${APP_SHELL_BRAND_SURFACE_CLASS} app-header-dark-preview`;

/** Abstand unter der KW-Toolbar bis Kalender-Inhalt (Dashboard; Bereich-Kalender nur Kalender-Spalte). */
export const APP_SHELL_CONTENT_OFFSET_CLASS = "pt-2 md:pt-4";

/**
 * App-Shell Root: Mobile Seiten-Scroll; ab md unverändert (volle Viewport-Höhe, kein Body-Scroll).
 */
export const APP_SHELL_ROOT_CLASS =
  "app-shell-root relative isolate flex min-h-dvh flex-col overflow-y-auto md:h-dvh md:min-h-0 md:overflow-hidden md:flex-row";

/** Hauptinhalt rechts/unten — Desktop weiterhin flex-1 + overflow-hidden. */
export const APP_SHELL_CONTENT_COLUMN_CLASS =
  "app-shell-content-column flex min-w-0 flex-col max-md:flex-none md:min-h-0 md:flex-1";

export const APP_SHELL_MAIN_CLASS =
  "flex flex-col p-4 max-md:overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden md:p-6";

/** Scrollbar-Styling für Sidebar-Nav (siehe globals.css .app-shell-sidebar-scroll). */
export const APP_SHELL_SIDEBAR_SCROLL_CLASS = "app-shell-sidebar-scroll";

/** Dashboard-Sidebar-Slot unter dem Logo — Mobile natürliche Höhe, Desktop flex-fill. */
export const APP_SHELL_SIDEBAR_SLOT_CLASS =
  `${APP_SHELL_SIDEBAR_SCROLL_CLASS} flex w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto px-0 pb-3 pt-0 max-md:shrink-0 max-md:flex-none md:min-h-0 md:flex-1`;

/** Planungsseiten: Kalender-Container — Mobile Mindesthöhe für Innen-Scroll, Desktop flex-fill. */
export const PLANNING_PAGE_CALENDAR_SECTION_CLASS =
  "flex min-h-0 flex-1 flex-col max-md:min-h-[min(70dvh,40rem)] max-md:overflow-visible md:overflow-hidden";

export const PLANNING_PAGE_CALENDAR_MAIN_CLASS =
  "flex min-w-0 flex-1 flex-col max-md:min-h-[min(70dvh,40rem)] max-md:overflow-visible md:min-h-0 md:overflow-hidden";

/** Bereich-Kalender Inhalt (ohne Toolbar-Hintergrund). */
export const AREA_CALENDAR_VIEW_CONTENT_CLASS =
  "relative z-10 flex min-h-0 flex-1 flex-col bg-background pb-[10px]";

/** Dashboard / Mitarbeiter-Kalender Inhalt (ohne Toolbar-Hintergrund). */
export const DASHBOARD_VIEW_CONTENT_CLASS =
  "relative z-10 flex min-h-0 flex-1 flex-col bg-subtle";

/** Planungsseiten-Wrapper: Toolbar + Inhalt, negative Ränder zum Main-Padding. */
export const PLANNING_PAGES_SHELL_CLASS =
  "-m-4 flex min-h-0 flex-1 flex-col md:-m-6";

/** @deprecated Nur noch für Skeleton — Wrapper ohne Toolbar-Hintergrund. */
export const DASHBOARD_VIEW_ROOT_CLASS =
  `${PLANNING_PAGES_SHELL_CLASS} ${DASHBOARD_VIEW_CONTENT_CLASS}`;

/** @deprecated Nur noch für Skeleton — Wrapper ohne Toolbar-Hintergrund. */
export const AREA_CALENDAR_VIEW_ROOT_CLASS =
  `${PLANNING_PAGES_SHELL_CLASS} ${AREA_CALENDAR_VIEW_CONTENT_CLASS}`;

/** Höhen-Pendant für Sidebar-Trennlinie unter dem Logo (Bereich-Kalender). */
export const APP_SHELL_BRAND_HEADER_CONTENT_ALIGN_CLASS = "h-2 md:h-4";

/** Wochen-Toolbar im Hauptbereich (Dashboard / Bereich-Kalender). */
export const APP_PAGE_TOOLBAR_HEADER_CLASS =
  `${APP_HEADER_DARK_PREVIEW_CLASS} app-page-toolbar-header flex shrink-0 flex-row items-center justify-between gap-2 border-b border-border px-4 md:gap-3 md:px-6`;
