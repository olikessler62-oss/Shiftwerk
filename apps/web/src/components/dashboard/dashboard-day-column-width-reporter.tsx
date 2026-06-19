"use client";

import { useLayoutEffect, useRef } from "react";

type Props = {
  date: string;
  enabled: boolean;
  onWidthChange: (date: string, innerWidthPx: number) => void;
};

/** Misst die Inhaltbreite der ersten Zelle einer Tag-Spalte (ResizeObserver). */
export function DashboardDayColumnWidthReporter({
  date,
  enabled,
  onWidthChange,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    function report() {
      if (!element) return;
      onWidthChange(date, element.clientWidth);
    }

    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [date, enabled, onWidthChange]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    />
  );
}
