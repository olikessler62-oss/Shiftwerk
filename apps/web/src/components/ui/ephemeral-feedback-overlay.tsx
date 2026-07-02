"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePlanningSidePanelOverlayHost } from "@/components/planning/planning-side-panel";
import { MODAL_ROUNDED_CLASS } from "@/lib/dashboard-panel-styles";
import { cn } from "@/lib/cn";

/** Über verschachtelte Modals (z. B. Personalengpass z-125). */
export const EPHEMERAL_FEEDBACK_Z_INDEX_CLASS = "z-[130]";

const DEFAULT_DURATION_MS = 2600;

type Variant = "success" | "error" | "info";

type Props = {
  message: string | null;
  variant?: Variant;
  onDismiss: () => void;
  durationMs?: number;
};

const VARIANT_TEXT_CLASS: Record<Variant, string> = {
  success: "text-foreground",
  error: "text-destructive",
  info: "text-foreground",
};

function ephemeralFeedbackDialogClass(variant: Variant, className?: string) {
  return cn(
    "pointer-events-auto w-full max-w-md border border-border bg-surface px-4 py-4 text-sm shadow-2xl sm:px-5",
    MODAL_ROUNDED_CLASS,
    VARIANT_TEXT_CLASS[variant],
    className
  );
}

/** Kurzes Feedback als weißes Modal — zentriert im Slide-in oder im Viewport. */
export function EphemeralFeedbackOverlay({
  message,
  variant = "success",
  onDismiss,
  durationMs = DEFAULT_DURATION_MS,
}: Props) {
  const panelOverlayHost = usePlanningSidePanelOverlayHost();

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  if (!message || typeof document === "undefined") {
    return null;
  }

  const portalTarget = panelOverlayHost ?? document.body;
  const scopedToPanel = panelOverlayHost != null;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none flex items-center justify-center bg-black/25 p-4 sm:p-6",
        scopedToPanel
          ? "absolute inset-0"
          : cn(
              "fixed inset-0",
              EPHEMERAL_FEEDBACK_Z_INDEX_CLASS,
              "md:left-[var(--app-shell-sidebar-width)]"
            )
      )}
      role="presentation"
      aria-live="polite"
    >
      <div role="status" className={ephemeralFeedbackDialogClass(variant)}>
        {message}
      </div>
    </div>,
    portalTarget
  );
}
