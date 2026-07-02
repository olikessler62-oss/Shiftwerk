"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export const TOOLTIP_Z_INDEX = 200;

/** Standard-Verzögerung für Hover-Tooltips (Fokus öffnet weiterhin sofort). */
export const HOVER_TOOLTIP_OPEN_DELAY_MS = 700;

/** Standard: Tooltip schließt beim Verlassen (kein Offenhalten). */
export const HOVER_TOOLTIP_CLOSE_DELAY_MS = 0;

/** Kurze Gnadenfrist beim Wechsel Trigger ↔ Tooltip (nur interactive). */
const INTERACTIVE_TOOLTIP_HOVER_BRIDGE_MS = 100;

/** Verfügbarkeits-Tooltips in Mitarbeiterlisten (Bereich- und Mitarbeiter-Kalender). */
export const EMPLOYEE_AVAILABILITY_TOOLTIP_OPEN_DELAY_MS = 1200;

/** Personal-Combobox in Schicht-Zuweisung (Bulk-Modal): nur bei längerem Hover. */
export const SHIFT_ASSIGN_EMPLOYEE_COMBO_HINT_OPEN_DELAY_MS = 1000;

/** Personalvorschläge-Modal: Daten während Hover-Verzögerung laden. */
export const DASHBOARD_STAFFING_CANDIDATE_TOOLTIP_OPEN_DELAY_MS = 1000;

export type TooltipPlacement = {
  /** Linker Tooltip-Rand liegt auf der horizontalen Mitte des Triggers. */
  anchorLeftToTriggerCenter?: boolean;
  /** Rechter Tooltip-Rand am linken Trigger-Rand. */
  anchorRightToTriggerLeft?: boolean;
  /** Unterer Tooltip-Rand am oberen Trigger-Rand. */
  anchorBottomToTriggerTop?: boolean;
  /** Unterer Tooltip-Rand auf Höhe der vertikalen Trigger-Mitte. */
  anchorBottomToTriggerCenterY?: boolean;
  /** CSS-Selektor für Anker-Element innerhalb des Triggers (z. B. Mitarbeiterkarte). */
  anchorToSelector?: string;
  /** Abstand zwischen Tooltip und Trigger (px). */
  gapPx?: number;
  /** Immer oberhalb — kein automatisches Umschalten nach unten. */
  side?: "above" | "auto";
};

export const EMPLOYEE_AVAILABILITY_TOOLTIP_ANCHOR_SELECTOR =
  "[data-employee-availability-tooltip-anchor]";

/** Verfügbarkeits-Tooltips in Mitarbeiterlisten: links an der Karte andocken. */
export const employeeAvailabilityTooltipPlacement: TooltipPlacement = {
  anchorRightToTriggerLeft: true,
  anchorBottomToTriggerCenterY: true,
  anchorToSelector: EMPLOYEE_AVAILABILITY_TOOLTIP_ANCHOR_SELECTOR,
  gapPx: 3,
  side: "above",
};

/** Einheitliches helles Tooltip — kein natives `title` (Browser-Default ist dunkel). */
export const tooltipContentClassName =
  "w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-snug text-foreground shadow-lg";

/** Schichtkarten: etwas breiter für längere Statuszeilen (z. B. „Bestätigung angefragt“). */
export const shiftCardTooltipContentClassName = cn(
  tooltipContentClassName,
  "max-w-[min(28rem,calc(100vw-1rem))]"
);

/** Mitarbeiter-Verfügbarkeiten: Tabellenlayout mit Überschrift. */
export const employeeAvailabilityTooltipContentClassName = cn(
  tooltipContentClassName,
  "w-max min-w-[11rem] max-w-[min(26rem,calc(100vw-1rem))]"
);

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  /** Tooltip bleibt geschlossen (z. B. solange ein Kontextmenü offen ist). */
  suppressOpen?: boolean;
  placement?: TooltipPlacement;
  /** Verzögerung vor Anzeige bei Hover (Fokus öffnet sofort). */
  openDelayMs?: number;
  /** Verzögerung nach Mausverlassen bis zum Schließen. */
  closeDelayMs?: number;
  /** Maus kann auf den Tooltip wechseln — bleibt offen, solange Trigger oder Tooltip hovered. */
  interactive?: boolean;
};

function hasTooltipContent(content: ReactNode): boolean {
  if (content == null || content === false) return false;
  if (typeof content === "string") return content.trim().length > 0;
  return true;
}

function resolveAnchorElement(
  trigger: HTMLElement,
  placement: TooltipPlacement | undefined
): HTMLElement {
  if (placement?.anchorToSelector) {
    const matched = trigger.querySelector(placement.anchorToSelector);
    if (matched instanceof HTMLElement) return matched;
  }
  if (
    placement?.anchorLeftToTriggerCenter ||
    placement?.anchorRightToTriggerLeft ||
    placement?.anchorBottomToTriggerTop ||
    placement?.anchorBottomToTriggerCenterY
  ) {
    const child = trigger.firstElementChild;
    if (child instanceof HTMLElement) return child;
  }
  return trigger;
}

export function Tooltip({
  content,
  children,
  className,
  contentClassName,
  disabled = false,
  suppressOpen = false,
  placement,
  openDelayMs = HOVER_TOOLTIP_OPEN_DELAY_MS,
  closeDelayMs = HOVER_TOOLTIP_CLOSE_DELAY_MS,
  interactive = false,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const openDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRef = useRef({ trigger: false, tooltip: false });
  const id = useId();
  const show = !disabled && hasTooltipContent(content);
  const allowOpen = show && !suppressOpen;

  const clearOpenDelay = useCallback(() => {
    if (openDelayTimeoutRef.current !== null) {
      clearTimeout(openDelayTimeoutRef.current);
      openDelayTimeoutRef.current = null;
    }
  }, []);

  const clearCloseDelay = useCallback(() => {
    if (closeDelayTimeoutRef.current !== null) {
      clearTimeout(closeDelayTimeoutRef.current);
      closeDelayTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseDelay();
    const attemptClose = () => {
      if (!hoverRef.current.trigger && !hoverRef.current.tooltip) {
        setOpen(false);
      }
    };

    if (interactive) {
      closeDelayTimeoutRef.current = setTimeout(
        attemptClose,
        INTERACTIVE_TOOLTIP_HOVER_BRIDGE_MS
      );
      return;
    }

    if (closeDelayMs <= 0) {
      attemptClose();
      return;
    }

    closeDelayTimeoutRef.current = setTimeout(attemptClose, closeDelayMs);
  }, [clearCloseDelay, closeDelayMs, interactive]);

  const handleTriggerMouseEnter = useCallback(() => {
    if (!allowOpen) return;
    hoverRef.current.trigger = true;
    clearOpenDelay();
    clearCloseDelay();
    if (openDelayMs <= 0) {
      setOpen(true);
      return;
    }
    openDelayTimeoutRef.current = setTimeout(() => setOpen(true), openDelayMs);
  }, [allowOpen, clearCloseDelay, clearOpenDelay, openDelayMs]);

  const handleTriggerMouseLeave = useCallback(() => {
    hoverRef.current.trigger = false;
    clearOpenDelay();
    scheduleClose();
  }, [clearOpenDelay, scheduleClose]);

  const handleTooltipMouseEnter = useCallback(() => {
    if (!interactive || !allowOpen) return;
    hoverRef.current.tooltip = true;
    clearCloseDelay();
  }, [allowOpen, clearCloseDelay, interactive]);

  const handleTooltipMouseLeave = useCallback(() => {
    if (!interactive) return;
    hoverRef.current.tooltip = false;
    scheduleClose();
  }, [interactive, scheduleClose]);

  useEffect(() => {
    if (suppressOpen) {
      clearOpenDelay();
      clearCloseDelay();
      hoverRef.current.trigger = false;
      hoverRef.current.tooltip = false;
      setOpen(false);
    }
  }, [suppressOpen, clearOpenDelay, clearCloseDelay]);

  useEffect(
    () => () => {
      clearOpenDelay();
      clearCloseDelay();
    },
    [clearOpenDelay, clearCloseDelay]
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const anchor = resolveAnchorElement(trigger, placement);
    const triggerRect = anchor.getBoundingClientRect();
    const { width, height } = tooltip.getBoundingClientRect();
    const padding = 8;
    const gap = placement?.gapPx ?? 4;
    const anchorLeftToTriggerCenter = placement?.anchorLeftToTriggerCenter ?? false;
    const anchorRightToTriggerLeft = placement?.anchorRightToTriggerLeft ?? false;
    const anchorBottomToTriggerTop = placement?.anchorBottomToTriggerTop ?? false;
    const anchorBottomToTriggerCenterY =
      placement?.anchorBottomToTriggerCenterY ?? false;
    const fixedAbove = placement?.side === "above";

    let top = anchorBottomToTriggerCenterY
      ? triggerRect.top + triggerRect.height / 2 - height
      : triggerRect.top - height - gap;
    let left = anchorRightToTriggerLeft
      ? triggerRect.left - width - gap
      : anchorLeftToTriggerCenter
        ? triggerRect.left + triggerRect.width / 2
        : triggerRect.left + triggerRect.width / 2 - width / 2;

    if (
      !fixedAbove &&
      !anchorBottomToTriggerTop &&
      !anchorBottomToTriggerCenterY &&
      top < padding
    ) {
      top = triggerRect.bottom + gap;
    }

    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - width - padding)
    );

    top = Math.max(
      padding,
      Math.min(top, window.innerHeight - height - padding)
    );

    setPosition({ top, left });
  }, [
    placement?.anchorBottomToTriggerCenterY,
    placement?.anchorBottomToTriggerTop,
    placement?.anchorLeftToTriggerCenter,
    placement?.anchorRightToTriggerLeft,
    placement?.anchorToSelector,
    placement?.gapPx,
    placement?.side,
  ]);

  useLayoutEffect(() => {
    if (!open || !allowOpen) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, allowOpen, content, updatePosition]);

  return (
    <>
      <span
        ref={triggerRef}
        className={cn("inline-flex max-w-full min-w-0", className)}
        onMouseEnter={handleTriggerMouseEnter}
        onMouseLeave={handleTriggerMouseLeave}
        onFocus={() => {
          if (!allowOpen) return;
          hoverRef.current.trigger = true;
          clearCloseDelay();
          setOpen(true);
        }}
        onBlur={handleTriggerMouseLeave}
        onContextMenu={() => {
          clearCloseDelay();
          setOpen(false);
        }}
        aria-describedby={open && allowOpen ? id : undefined}
      >
        {children}
      </span>
      {open && allowOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              id={id}
              role="tooltip"
              className={cn(
                tooltipContentClassName,
                "fixed",
                interactive ? "pointer-events-auto" : "pointer-events-none",
                contentClassName
              )}
              style={{
                top: position.top,
                left: position.left,
                zIndex: TOOLTIP_Z_INDEX,
              }}
              onMouseEnter={interactive ? handleTooltipMouseEnter : undefined}
              onMouseLeave={interactive ? handleTooltipMouseLeave : undefined}
            >
              {typeof content === "string" && content.includes("\n") ? (
                <span className="block whitespace-pre-line">{content}</span>
              ) : (
                content
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
