"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CloseIcon, IconButton } from "@/components/ui";
import {
  MODAL_SCROLLBAR_CLASS,
  PLANNING_SIDE_PANEL_SUBTITLE_CLASS,
  SETTINGS_MODAL_HEADER_BG_CLASS,
  SETTINGS_MODAL_TITLE_CLASS,
} from "@/components/settings/settings-list-ui";
import { cn } from "@/lib/cn";

export type PlanningPanelAnchor = "left" | "right";

type PlanningSidePanelProps = {
  anchor?: PlanningPanelAnchor;
  title: string;
  subtitle?: string;
  subtitleNode?: ReactNode;
  titleId: string;
  onClose: () => void;
  closeDisabled?: boolean;
  closeAriaLabel: string;
  /** Klick auf die abgedunkelte Fläche schließt das Panel (Standard: aus — nur X/Schließen). */
  dismissOnBackdrop?: boolean;
  /** Escape schließt das Panel (Standard: aus — nur X/Schließen). */
  dismissOnEscape?: boolean;
  /** Standard: schmales Panel. Wide: breite Tabellen / Schicht-Stati. */
  size?: "default" | "wide";
  headerAside?: ReactNode;
  panelClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Footer-Innenabstand für Planungs-Slide-Ins (Checkbox links, Buttons rechts). */
export const PLANNING_SIDE_PANEL_FOOTER_CLASS =
  "flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5 sm:py-4";

const PANEL_BODY_PADDING_CLASS = "px-3 py-3 sm:px-5 sm:py-4";

const PANEL_MOTION_MS = 280;

const PANEL_CLOSE_OUT_CLASS = {
  left: "planning-side-panel-out-left",
  right: "planning-side-panel-out-right",
} as const;

const PANEL_LAYOUT = {
  left: {
    backdrop: "max-md:left-0 md:left-[var(--app-shell-sidebar-width)]",
    position: "max-md:left-0 md:left-[var(--app-shell-sidebar-width)]",
    border: "border-r",
    offscreenTransform: "-translate-x-full",
    shadow: "shadow-[8px_0_32px_-8px_rgba(15,23,42,0.28)]",
    width: {
      default: "w-full max-w-md",
      wide: "w-full max-w-none md:w-[min(64rem,calc(100vw-var(--app-shell-sidebar-width)))]",
    },
  },
  right: {
    backdrop: "",
    position: "right-0",
    border: "border-l",
    offscreenTransform: "translate-x-full",
    shadow: "shadow-[-8px_0_32px_-8px_rgba(15,23,42,0.28)]",
    width: {
      default: "w-full max-w-md",
      wide: "w-full max-w-[100vw] sm:max-w-6xl",
    },
  },
} as const;

const PANEL_CUSTOM_WIDTH_PATTERN = /(?:^|\s)(!)?(max-w-|w-\[|w-\d)/;

function resolvePanelWidthClass(
  size: "default" | "wide",
  anchor: PlanningPanelAnchor,
  panelClassName?: string
): string {
  if (panelClassName && PANEL_CUSTOM_WIDTH_PATTERN.test(panelClassName)) {
    return "w-full";
  }
  return PANEL_LAYOUT[anchor].width[size];
}

type PanelMotionPhase = "entering" | "open" | "closing";

const PlanningSidePanelCloseContext = createContext<(() => void) | null>(null);

/** Animiertes Schließen — für Footer-Buttons innerhalb von PlanningSidePanel. */
export function usePlanningSidePanelRequestClose(): () => void {
  const requestClose = useContext(PlanningSidePanelCloseContext);
  if (!requestClose) {
    throw new Error(
      "usePlanningSidePanelRequestClose must be used within PlanningSidePanel"
    );
  }
  return requestClose;
}

function prefersReducedPanelMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Planungs-Panel: links (Schicht zuweisen) oder rechts (Schicht-Stati) am Browserrand.
 */
export function PlanningSidePanel({
  anchor = "left",
  title,
  subtitle,
  subtitleNode,
  titleId,
  onClose,
  closeDisabled = false,
  closeAriaLabel,
  dismissOnBackdrop = false,
  dismissOnEscape = false,
  size = "default",
  headerAside,
  panelClassName,
  headerClassName,
  bodyClassName,
  children,
  footer,
}: PlanningSidePanelProps) {
  const layout = PANEL_LAYOUT[anchor];
  const [phase, setPhase] = useState<PanelMotionPhase>("entering");
  const closeRequestedRef = useRef(false);
  const closeFinishedRef = useRef(false);

  useEffect(() => {
    let enterFrame1 = 0;
    let enterFrame2 = 0;
    enterFrame1 = requestAnimationFrame(() => {
      enterFrame2 = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(enterFrame1);
      cancelAnimationFrame(enterFrame2);
    };
  }, []);

  const panelRef = useRef<HTMLElement>(null);

  const finishClose = useCallback(() => {
    if (closeFinishedRef.current) return;
    closeFinishedRef.current = true;
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closeDisabled || closeRequestedRef.current) return;
    closeRequestedRef.current = true;

    if (prefersReducedPanelMotion()) {
      finishClose();
      return;
    }

    setPhase("closing");
  }, [closeDisabled, finishClose]);

  useEffect(() => {
    if (phase !== "closing") return;
    const panel = panelRef.current;
    if (!panel) {
      finishClose();
      return;
    }

    function onAnimationEnd(event: AnimationEvent) {
      if (event.target !== panel) return;
      finishClose();
    }

    panel.addEventListener("animationend", onAnimationEnd);
    const fallback = window.setTimeout(finishClose, PANEL_MOTION_MS + 80);
    return () => {
      panel.removeEventListener("animationend", onAnimationEnd);
      clearTimeout(fallback);
    };
  }, [phase, finishClose]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !closeDisabled && dismissOnEscape) {
        requestClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeDisabled, dismissOnEscape, requestClose]);

  if (typeof document === "undefined") {
    return null;
  }

  const panelTransformClass =
    phase === "open" ? "translate-x-0" : layout.offscreenTransform;

  const backdropVisible = phase === "open";
  const backdropClosing = phase === "closing";

  return createPortal(
    <PlanningSidePanelCloseContext.Provider value={requestClose}>
      <div
        className={cn(
          "fixed inset-0 z-[108] bg-black/25 transition-opacity",
          layout.backdrop,
          backdropClosing ? "duration-200 ease-in" : "duration-300 ease-out",
          backdropVisible ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
        onMouseDown={(event) => {
          if (
            event.target === event.currentTarget &&
            dismissOnBackdrop &&
            !closeDisabled
          ) {
            requestClose();
          }
        }}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed top-0 bottom-0 z-[110] flex min-w-0 flex-col bg-surface",
          layout.position,
          layout.border,
          layout.shadow,
          resolvePanelWidthClass(size, anchor, panelClassName),
          "transform",
          phase === "closing"
            ? PANEL_CLOSE_OUT_CLASS[anchor]
            : cn(
                "transition-transform duration-300 ease-out",
                panelTransformClass
              ),
          phase === "closing" && "pointer-events-none",
          MODAL_SCROLLBAR_CLASS,
          panelClassName
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header
          className={cn(
            "shrink-0 border-b border-border px-3 py-3 sm:px-5 sm:py-4",
            SETTINGS_MODAL_HEADER_BG_CLASS,
            headerClassName
          )}
        >
          <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className={cn(SETTINGS_MODAL_TITLE_CLASS, "break-words")}
              >
                {title}
              </h2>
              {subtitleNode ??
                (subtitle ? (
                  <p className={PLANNING_SIDE_PANEL_SUBTITLE_CLASS}>{subtitle}</p>
                ) : null)}
            </div>
            <IconButton
              size="sm"
              onClick={requestClose}
              disabled={closeDisabled}
              aria-label={closeAriaLabel}
              className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
            >
              <CloseIcon className="h-[18px] w-[18px]" />
            </IconButton>
          </div>
          {headerAside ? (
            <div className="mt-2 min-w-0 w-full overflow-x-auto sm:mt-3">
              {headerAside}
            </div>
          ) : null}
        </header>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto",
            PANEL_BODY_PADDING_CLASS,
            bodyClassName
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border bg-surface">
            {footer}
          </div>
        ) : null}
      </aside>
    </PlanningSidePanelCloseContext.Provider>,
    document.body
  );
}

/** Schicht-Stati und ähnliche rechte Panels am Browserrand. */
export function PlanningRightSidePanel(
  props: Omit<PlanningSidePanelProps, "anchor">
) {
  return <PlanningSidePanel {...props} anchor="right" />;
}

/** Hinweise/Bestätigungen über dem Slide-in — immer auf `body` portieren. */
export function PlanningSidePanelNestedAlertPortal({
  children,
}: {
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
