import { useLayoutEffect, useRef, useState } from "react";

export type StaffingTableHeaderLabels = {
  day: string;
  time: string;
  shift: string;
  staffing: string;
  showShiftColumn: boolean;
};

/** Zwei Aktions-Icons nebeneinander (Zuweisen + Offene Punkte). */
export const STAFFING_TABLE_ACTION_COL_PX = 52;
const STAFFING_TABLE_STAFFING_COL_FALLBACK_PX = 76;
const STAFFING_TABLE_STAFFING_COL_PADDING_PX = 12;
const STAFFING_TABLE_MIN_DAY_COL_PX = 34;
const STAFFING_TABLE_MIN_TIME_COL_PX = 68;
const STAFFING_TABLE_MIN_SHIFT_COL_PX = 40;

/** Mindestbreite, unter der Tabellenspalten trotz Ellipsis überlappen würden. */
export function staffingTableOverlapMinWidthPx(
  showShiftColumn: boolean,
  staffingColumnWidthPx = STAFFING_TABLE_STAFFING_COL_FALLBACK_PX
): number {
  const shiftColPx = showShiftColumn ? STAFFING_TABLE_MIN_SHIFT_COL_PX : 0;

  return (
    STAFFING_TABLE_ACTION_COL_PX +
    staffingColumnWidthPx +
    STAFFING_TABLE_MIN_DAY_COL_PX +
    STAFFING_TABLE_MIN_TIME_COL_PX +
    shiftColPx
  );
}

export function resolveStaffingTableStaffingColumnWidthPx(
  labelWidthPx: number
): number {
  return Math.max(
    STAFFING_TABLE_STAFFING_COL_FALLBACK_PX,
    labelWidthPx + STAFFING_TABLE_STAFFING_COL_PADDING_PX
  );
}

/**
 * Tabellen-Layout: Überschriften abschneiden, wenn nötig.
 * Listen-Layout nur, wenn Überlappung droht.
 */
export function useStaffingTableLayout(headerLabels: StaffingTableHeaderLabels) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const staffingLabelMeasureRef = useRef<HTMLSpanElement>(null);
  const [layout, setLayout] = useState({
    showTableLayout: true,
    headersTruncate: false,
    staffingColumnWidthPx: STAFFING_TABLE_STAFFING_COL_FALLBACK_PX,
  });

  const labelKey = [
    headerLabels.day,
    headerLabels.time,
    headerLabels.shift,
    headerLabels.staffing,
    headerLabels.showShiftColumn,
  ].join("\0");

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    function update() {
      const containerNode = containerRef.current;
      const measureNode = measureRef.current;
      if (!containerNode || !measureNode) return;

      const width = containerNode.clientWidth;
      const fullHeaderWidth = measureNode.scrollWidth;
      const staffingColumnWidthPx = resolveStaffingTableStaffingColumnWidthPx(
        staffingLabelMeasureRef.current?.scrollWidth ?? 0
      );
      const overlapMinWidth = staffingTableOverlapMinWidthPx(
        headerLabels.showShiftColumn,
        staffingColumnWidthPx
      );

      setLayout({
        showTableLayout: width >= overlapMinWidth,
        headersTruncate: width < fullHeaderWidth,
        staffingColumnWidthPx,
      });
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [labelKey, headerLabels.showShiftColumn]);

  return { containerRef, measureRef, staffingLabelMeasureRef, ...layout };
}

/** @deprecated Alias — bitte useStaffingTableLayout verwenden. */
export const useStaffingTableHeadersFit = useStaffingTableLayout;
