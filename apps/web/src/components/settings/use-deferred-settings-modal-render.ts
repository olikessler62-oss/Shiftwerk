"use client";

import { useEffect } from "react";

/**
 * Hält das Modal unsichtbar, bis alle Startdaten geladen sind.
 * Zeigt währenddessen einen Wait-Cursor auf der Seite und erlaubt Escape zum Abbrechen.
 */
export function useDeferredSettingsModalRender(
  loading: boolean,
  onClose: () => void
): boolean {
  useEffect(() => {
    if (!loading) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previous;
    };
  }, [loading]);

  useEffect(() => {
    if (!loading) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loading, onClose]);

  return !loading;
}
