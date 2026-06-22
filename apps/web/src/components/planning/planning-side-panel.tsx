"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, IconButton } from "@/components/ui";
import {
  MODAL_SCROLLBAR_CLASS,
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
  /** Klick auf die abgedunkelte Fläche schließt das Panel. */
  dismissOnBackdrop?: boolean;
  /** Standard: schmales Panel. Wide: breite Tabellen / Schicht-Stati. */
  size?: "default" | "wide";
  headerAside?: ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
};

const PANEL_LAYOUT = {
  left: {
    backdrop: "md:left-56",
    position: "left-0 md:left-56",
    border: "border-r",
    hiddenTransform: "-translate-x-full",
    shadow: "shadow-[8px_0_32px_-8px_rgba(15,23,42,0.28)]",
    width: {
      default: "w-full max-w-md",
      wide: "w-full max-w-none md:w-[min(64rem,calc(100vw-14rem))]",
    },
  },
  right: {
    backdrop: "",
    position: "right-0",
    border: "border-l",
    hiddenTransform: "translate-x-full",
    shadow: "shadow-[-8px_0_32px_-8px_rgba(15,23,42,0.28)]",
    width: {
      default: "w-full max-w-md",
      wide: "w-full max-w-6xl",
    },
  },
} as const;

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
  dismissOnBackdrop = true,
  size = "default",
  headerAside,
  panelClassName,
  bodyClassName,
  children,
  footer,
}: PlanningSidePanelProps) {
  const layout = PANEL_LAYOUT[anchor];
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !closeDisabled) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeDisabled, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-[108] bg-black/25 transition-opacity duration-200",
          layout.backdrop,
          entered ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
        onMouseDown={(event) => {
          if (
            event.target === event.currentTarget &&
            dismissOnBackdrop &&
            !closeDisabled
          ) {
            onClose();
          }
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed top-0 bottom-0 z-[110] flex flex-col bg-surface",
          layout.position,
          layout.border,
          layout.shadow,
          layout.width[size],
          "transform transition-transform duration-300 ease-out",
          entered ? "translate-x-0" : layout.hiddenTransform,
          MODAL_SCROLLBAR_CLASS,
          panelClassName
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className={SETTINGS_MODAL_TITLE_CLASS}>
              {title}
            </h2>
            {subtitleNode ??
              (subtitle ? (
                <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
              ) : null)}
          </div>
          {headerAside ? (
            <div className="shrink-0">{headerAside}</div>
          ) : null}
          <IconButton
            size="sm"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={closeAriaLabel}
            className="shrink-0 border-transparent bg-transparent hover:bg-subtle"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-5 py-4",
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-border">{footer}</div>
        ) : null}
      </aside>
    </>,
    document.body
  );
}

/** Schicht-Stati und ähnliche rechte Panels am Browserrand. */
export function PlanningRightSidePanel(
  props: Omit<PlanningSidePanelProps, "anchor">
) {
  return <PlanningSidePanel {...props} anchor="right" />;
}
