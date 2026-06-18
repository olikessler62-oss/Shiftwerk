/** Haupt-Sidebar (Navigation + Slot unter der Logo-Zeile). */
export const APP_SHELL_SIDEBAR_CLASS = "app-shell-sidebar";

/** Logo-Zeile in der Sidebar (eigenständige Höhe, unabhängig von der Wochen-Toolbar). */
export const APP_SHELL_BRAND_HEADER_CLASS = "h-[5.5rem] md:h-32";

/** TESTWEISE: Dark-Mode-Farben nur für Header-Zeilen (siehe globals.css). */
export const APP_HEADER_DARK_PREVIEW_CLASS = "app-header-dark-preview";

/** Abstand unter der gemeinsamen Trennlinie bis Sidebar-Inhalt bzw. Kalender. */
export const APP_SHELL_CONTENT_OFFSET_CLASS = "pt-2 md:pt-4";

/** Wochen-Toolbar im Hauptbereich (Planer / Dashboard). */
export const APP_PAGE_TOOLBAR_HEADER_CLASS =
  `${APP_HEADER_DARK_PREVIEW_CLASS} app-page-toolbar-header flex shrink-0 flex-col gap-2.5 border-b border-border px-4 py-2.5 md:min-h-16 md:flex-row md:items-center md:justify-between md:gap-3 md:px-6 md:py-3`;
