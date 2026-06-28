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

function resolveBulkShiftScrollContainer(
  container: HTMLElement
): HTMLElement {
  if (container.scrollHeight > container.clientHeight) {
    return container;
  }

  let node: HTMLElement | null = container.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }

  return container;
}

export function scrollBulkShiftRowIntoView(
  container: HTMLElement,
  rowEl: HTMLElement
) {
  const scrollContainer = resolveBulkShiftScrollContainer(container);
  if (scrollContainer === container && container.scrollHeight <= container.clientHeight) {
    rowEl.scrollIntoView({ block: "nearest" });
    return;
  }

  const thead = container.querySelector("thead");
  const headerHeight = thead?.getBoundingClientRect().height ?? 0;
  const containerRect = scrollContainer.getBoundingClientRect();
  const rowRect = rowEl.getBoundingClientRect();
  const padding = 4;
  const minVisibleTop = containerRect.top + headerHeight + padding;
  const maxVisibleBottom = containerRect.bottom - padding;

  if (rowRect.top < minVisibleTop) {
    scrollContainer.scrollTop += rowRect.top - minVisibleTop;
    return;
  }

  if (rowRect.bottom > maxVisibleBottom) {
    scrollContainer.scrollTop += rowRect.bottom - maxVisibleBottom;
  }
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
  rowId: string,
  onComplete?: () => void
) {
  if (!rowId || typeof window === "undefined") {
    onComplete?.();
    return;
  }

  const selector = `[${BULK_SHIFT_ROW_ID_ATTR}="${escapeRowId(rowId)}"]`;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    onComplete?.();
  };

  const tryScroll = () => {
    if (done) return;

    const container = containerRef.current;
    const rowEl = container?.querySelector<HTMLElement>(selector);
    if (!container || !rowEl) return;

    scrollBulkShiftRowIntoView(container, rowEl);
    finish();
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(tryScroll);
  });

  for (const delay of [50, 150, 300, 500]) {
    window.setTimeout(tryScroll, delay);
  }

  window.setTimeout(finish, 550);
}
