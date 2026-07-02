"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Alert } from "./alert";

/** Über Planungs-Slide-ins (z-110) und verschachtelte Overlays. */
export const EPHEMERAL_FEEDBACK_Z_INDEX_CLASS = "z-[120]";

const DEFAULT_DURATION_MS = 2600;

type Variant = "success" | "error" | "info";

type Props = {
  message: string | null;
  variant?: Variant;
  onDismiss: () => void;
  durationMs?: number;
};

/** Kurzes Feedback über dem UI — ohne Layout der darunterliegenden Controls zu verschieben. */
export function EphemeralFeedbackOverlay({
  message,
  variant = "success",
  onDismiss,
  durationMs = DEFAULT_DURATION_MS,
}: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  if (!message || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed inset-0 flex items-start justify-center px-4 pt-6 sm:pt-10",
        EPHEMERAL_FEEDBACK_Z_INDEX_CLASS,
        "md:left-[var(--app-shell-sidebar-width)]"
      )}
      role="presentation"
      aria-live="polite"
    >
      <Alert
        variant={variant}
        className="pointer-events-auto w-full max-w-md shadow-lg"
      >
        {message}
      </Alert>
    </div>,
    document.body
  );
}
