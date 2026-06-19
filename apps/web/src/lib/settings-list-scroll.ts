"use client";

import { useEffect } from "react";

export const SETTINGS_LIST_ITEM_ID_ATTR = "data-settings-list-item-id";

export type SettingsListScrollMode = "nearest" | "top";

export function settingsListItemAttrs(id: string) {
  return { [SETTINGS_LIST_ITEM_ID_ATTR]: id };
}

function findOverflowScrollParent(element: Element): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function scrollSettingsListRowToTop(row: Element) {
  const scrollContainer = findOverflowScrollParent(row);
  if (!scrollContainer) {
    row.scrollIntoView({ block: "start", behavior: "smooth" });
    return;
  }

  const thead = scrollContainer.querySelector("thead");
  const headerHeight = thead?.getBoundingClientRect().height ?? 0;
  const containerRect = scrollContainer.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const delta = rowRect.top - containerRect.top - headerHeight;

  scrollContainer.scrollTo({
    top: scrollContainer.scrollTop + delta,
    behavior: "smooth",
  });
}

export function scrollSettingsListItemIntoView(
  itemId: string,
  mode: SettingsListScrollMode = "nearest"
) {
  if (!itemId || typeof document === "undefined") return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const escaped =
        typeof CSS !== "undefined" && "escape" in CSS
          ? CSS.escape(itemId)
          : itemId.replace(/"/g, '\\"');
      const row = document.querySelector(
        `[${SETTINGS_LIST_ITEM_ID_ATTR}="${escaped}"]`
      );
      if (!row) return;
      if (mode === "top") {
        scrollSettingsListRowToTop(row);
        return;
      }
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  });
}

/** Scrollt zur Zeile, sobald der Eintrag in der Liste vorhanden ist (z. B. nach router.refresh). */
export function useScrollToSettingsListItem(
  items: readonly { id: string }[],
  itemId: string | null,
  onScrolled?: () => void,
  mode: SettingsListScrollMode = "nearest"
) {
  useEffect(() => {
    if (!itemId) return;
    if (!items.some((item) => item.id === itemId)) return;
    scrollSettingsListItemIntoView(itemId, mode);
    onScrolled?.();
  }, [items, itemId, mode, onScrolled]);
}

export function applyCreatedListSelection(
  createdId: string | undefined,
  setSelectedId: (id: string) => void,
  setScrollToItemId: (id: string | null) => void
) {
  if (!createdId) return;
  setSelectedId(createdId);
  setScrollToItemId(createdId);
}
