"use client";

import { useEffect } from "react";

export function useBodyWaitCursor(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const previousBody = document.body.style.cursor;
    const previousHtml = document.documentElement.style.cursor;
    document.body.style.cursor = "wait";
    document.documentElement.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previousBody;
      document.documentElement.style.cursor = previousHtml;
    };
  }, [active]);
}
