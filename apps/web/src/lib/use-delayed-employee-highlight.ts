"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPLOYEE_SHIFT_HIGHLIGHT_HOVER_DELAY_MS } from "@/lib/calendar-interaction-ui";

/** Verzögert Leuchteffekt auf Schichtkarten beim Hover über Mitarbeiterlisten. */
export function useDelayedEmployeeHighlight(
  delayMs: number = EMPLOYEE_SHIFT_HIGHLIGHT_HOVER_DELAY_MS
) {
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(
    null
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingHighlight = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleEmployeeHover = useCallback(
    (employeeId: string | null) => {
      clearPendingHighlight();
      if (employeeId === null) {
        setHighlightedEmployeeId(null);
        return;
      }
      timeoutRef.current = setTimeout(() => {
        setHighlightedEmployeeId(employeeId);
        timeoutRef.current = null;
      }, delayMs);
    },
    [clearPendingHighlight, delayMs]
  );

  useEffect(() => () => clearPendingHighlight(), [clearPendingHighlight]);

  return { highlightedEmployeeId, handleEmployeeHover };
}
