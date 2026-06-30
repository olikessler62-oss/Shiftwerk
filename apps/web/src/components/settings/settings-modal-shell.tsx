import { cn } from "@/lib/cn";

/** Einheitlicher Modal-/Slide-in-Kopf (Bereichskarten, Übersicht, Einstellungen). */
export const SETTINGS_MODAL_HEADER_BG_CLASS = "bg-[#c7d4e5]";
export const MODAL_SCROLLBAR_CLASS = "modal-scrollbar";

/** Max. Breite für Master-Detail-Modals (Standorte, Profile). */
export const SETTINGS_MODAL_MAX_WIDTH = "calc(54rem + 120px)";

/** Backdrop für Haupt-Modals (z. B. Standorte). */
export function settingsModalBackdropClass(className?: string) {
  return cn(
    "absolute inset-0 z-50 flex items-center justify-center bg-black/25 p-2 sm:p-4",
    "max-sm:items-stretch max-sm:justify-stretch max-sm:p-0",
    className
  );
}

/** Dialog-Container für Haupt-Modals. */
export function settingsModalDialogClass(className?: string) {
  return cn(
    "flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl",
    MODAL_SCROLLBAR_CLASS,
    "max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]",
    "max-sm:max-h-dvh max-sm:rounded-none max-sm:border-x-0",
    className
  );
}

/** Backdrop für Panel-Sub-Modals (Servicezeiten, Personalbedarf, …). */
export function settingsSubModalOverlayClass(className?: string) {
  return cn(
    "absolute inset-0 z-[60] flex items-center justify-center rounded-2xl bg-black/30 p-2 sm:p-4",
    "max-sm:items-stretch max-sm:justify-stretch max-sm:rounded-none max-sm:p-0",
    className
  );
}

type SubModalSize = "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

const SUB_MODAL_MAX_WIDTH: Record<SubModalSize, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

/** Dialog für Panel-Sub-Modals. */
export function settingsSubModalDialogClass(
  size: SubModalSize = "2xl",
  className?: string
) {
  return cn(
    "relative z-[61] flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
    MODAL_SCROLLBAR_CLASS,
    SUB_MODAL_MAX_WIDTH[size],
    "max-h-[min(90dvh,720px)]",
    "max-sm:h-full max-sm:max-h-none max-sm:rounded-none max-sm:border-0",
    className
  );
}

/** Backdrop für Form-Sub-Modals (Anlegen/Bearbeiten, Löschen). */
export function settingsNestedModalOverlayClass(className?: string) {
  return cn(
    "absolute inset-0 z-[70] flex items-center justify-center rounded-2xl bg-black/30 p-2 sm:p-4",
    "max-sm:items-stretch max-sm:justify-stretch max-sm:rounded-none max-sm:p-0",
    className
  );
}

/** z-index for portaled combobox/listbox panels above nested modals (110–113). */
export const MODAL_DROPDOWN_Z_INDEX = 120;

/** Fixed modals in the app shell — above header toolbars (see MODAL_DROPDOWN_Z_INDEX). */
export const APP_SHELL_FIXED_MODAL_Z_INDEX = 125;

/** Nested Overlay in eingebetteten Slide-in-Detail-Panels (fixed über Shell). */
export function settingsFixedNestedOverlayClass(className?: string) {
  return cn(
    "fixed inset-0 z-[125] flex items-center justify-center bg-black/30 p-2 sm:p-4 md:left-[var(--app-shell-sidebar-width)]",
    "max-sm:items-stretch max-sm:justify-stretch max-sm:p-0",
    className
  );
}

/** Dialog für Form-Sub-Modals. */
export function settingsNestedModalDialogClass(
  size: SubModalSize = "lg",
  className?: string
) {
  return cn(
    "relative z-[71] flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
    MODAL_SCROLLBAR_CLASS,
    SUB_MODAL_MAX_WIDTH[size],
    "max-h-[min(90dvh,720px)]",
    "max-sm:h-full max-sm:max-h-none max-sm:rounded-none max-sm:border-0",
    className
  );
}

/** Alertdialog (Löschen bestätigen). */
export function settingsConfirmDialogClass(className?: string) {
  return cn(
    "relative z-[71] w-full min-w-0 max-w-md rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:p-5",
    MODAL_SCROLLBAR_CLASS,
    "max-sm:h-auto max-sm:max-h-none max-sm:rounded-none max-sm:border-0",
    className
  );
}

export function settingsModalHeaderPaddingClass() {
  return cn("px-4 py-3 sm:px-6 sm:py-4", SETTINGS_MODAL_HEADER_BG_CLASS);
}

/** Modal-/Slide-in-Kopf inkl. Unterrand und Hintergrund. */
export function settingsModalHeaderClass(className?: string) {
  return cn("shrink-0 border-b border-border", settingsModalHeaderPaddingClass(), className);
}

export function settingsModalBodyPaddingClass() {
  return "px-4 py-3 sm:px-5";
}

/** Footer mit gestapelten Buttons auf schmalen Viewports. */
export function settingsModalFooterClass(className?: string) {
  return cn(
    "flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5",
    className
  );
}

/** Master-Detail: Listen links, Detail rechts — stapelt unter lg. */
export function settingsMasterDetailLayoutClass(className?: string) {
  return cn(
    "flex shrink-0 flex-col gap-4 bg-background px-3 py-3 sm:px-4",
    "lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-stretch",
    className
  );
}

/** Zwei Listen nebeneinander — stapelt unter md. */
export function settingsMasterDetailListsClass(className?: string) {
  return cn(
    "flex min-h-0 min-w-0 flex-col gap-4 md:grid md:grid-cols-2 md:items-stretch",
    "[&>*]:flex [&>*]:h-full [&>*]:min-h-0 [&>*]:flex-col",
    className
  );
}

/** Wochentag / Vorlage / Von / Bis — stapelt auf Mobile. */
export function settingsResponsiveWindowFieldsClass(className?: string) {
  return cn(
    "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[max-content_8.5rem_9.5rem_minmax(9.5rem,auto)] lg:items-end lg:gap-x-2 lg:gap-y-3",
    className
  );
}

/** Tabellen mit horizontalem Scroll als Fallback. */
export function settingsResponsiveTableWrapClass(className?: string) {
  return cn("-mx-1 min-w-0 overflow-x-auto px-1 sm:mx-0 sm:px-0", className);
}

/** Backdrop für Bereich-Kalender-Modals (fixed, nicht verschachtelt). */
export function areaCalendarModalBackdropClass(className?: string) {
  return cn(
    "fixed inset-0 z-[110] flex items-center justify-center bg-black/30 p-2 sm:p-4",
    "max-sm:items-stretch max-sm:justify-stretch max-sm:p-0",
    className
  );
}

/** Dialog für Bereich-Kalender-Modals. */
export function areaCalendarModalDialogClass(
  size: SubModalSize = "2xl",
  className?: string
) {
  return cn(
    "relative z-[111] flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
    MODAL_SCROLLBAR_CLASS,
    SUB_MODAL_MAX_WIDTH[size],
    "max-h-[90dvh]",
    "max-sm:h-full max-sm:max-h-none max-sm:rounded-none max-sm:border-0",
    className
  );
}

/**
 * Alertdialog-Overlay über PlanningSidePanel (Backdrop 108, Panel 110) und
 * Bereich-Kalender-Modals — per Portal auf `body` rendern.
 */
export function areaCalendarNestedModalOverlayClass(className?: string) {
  return cn(
    "fixed inset-0 z-[115] flex items-center justify-center bg-black/30 p-2 sm:p-4",
    "max-sm:items-stretch max-sm:justify-stretch max-sm:p-0",
    className
  );
}

export function areaCalendarAlertDialogClass(className?: string) {
  return cn(
    settingsConfirmDialogClass(),
    "z-[116] flex max-h-[min(85dvh,36rem)] w-full flex-col",
    className
  );
}

/** Wrapper mit max. Breite für Einstellungs-Hauptmodals. */
export function settingsModalRootClass(size: SubModalSize = "4xl") {
  return cn("relative flex w-full min-w-0 flex-col", SUB_MODAL_MAX_WIDTH[size]);
}
