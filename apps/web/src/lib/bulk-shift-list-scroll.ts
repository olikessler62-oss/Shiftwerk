"use client";

import type { RefObject } from "react";

export const BULK_SHIFT_ROW_ID_ATTR = "data-bulk-row-id";

export function bulkShiftRowAttrs(id: string) {
  return { [BULK_SHIFT_ROW_ID_ATTR]: id };
}

function escapeRowId(rowId: string): string {
  if (typeof CSS !== "undefined" && "escape" in CSS) {
    return CSS.escape(rowId);
  }
  return rowId.replace(/"/g, '\\"');
}

export function computeBulkShiftListScrollTop(input: {
  containerClientHeight: number;
  headerHeight: number;
  rowRelativeTop: number;
  rowHeight: number;
  padding?: number;
}): number | null {
  const padding = input.padding ?? 4;
  const viewportTop = input.headerHeight + padding;
  const viewportBottom = input.containerClientHeight - padding;
  const relativeTop = input.rowRelativeTop;
  const relativeBottom = relativeTop + input.rowHeight;

  if (relativeTop >= viewportTop && relativeBottom <= viewportBottom) {
    return null;
  }

  if (relativeTop < viewportTop) {
    return relativeTop - viewportTop;
  }

  return relativeBottom - viewportBottom;
}

export function scrollBulkShiftRowIntoView(
  container: HTMLElement,
  rowEl: HTMLElement
) {
  const thead = container.querySelector("thead");
  const headerHeight = thead?.getBoundingClientRect().height ?? 0;
  const containerRect = container.getBoundingClientRect();
  const rowRect = rowEl.getBoundingClientRect();
  const relativeTop = rowRect.top - containerRect.top + container.scrollTop;

  const nextScrollTop = computeBulkShiftListScrollTop({
    containerClientHeight: container.clientHeight,
    headerHeight,
    rowRelativeTop: relativeTop,
    rowHeight: rowRect.height,
  });

  if (nextScrollTop === null) return;
  container.scrollTop = nextScrollTop;
}

export function resolveBulkShiftRowIdForShiftFocus(
  rows: readonly { id: string; existingShiftId?: string }[],
  focusShiftId: string | undefined
): string | null {
  if (!focusShiftId) return null;
  return rows.find((row) => row.existingShiftId === focusShiftId)?.id ?? null;
}

export function scheduleScrollBulkShiftRowIntoView(
  containerRef: RefObject<HTMLElement | null>,
  rowId: string
) {
  if (!rowId || typeof window === "undefined") return;

  const selector = `[${BULK_SHIFT_ROW_ID_ATTR}="${escapeRowId(rowId)}"]`;
  let done = false;

  const tryScroll = () => {
    if (done) return;

    const container = containerRef.current;
    const rowEl = container?.querySelector<HTMLElement>(selector);
    if (!container || !rowEl) return;

    scrollBulkShiftRowIntoView(container, rowEl);
    done = true;
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(tryScroll);
  });

  for (const delay of [50, 150, 300]) {
    window.setTimeout(tryScroll, delay);
  }
}
