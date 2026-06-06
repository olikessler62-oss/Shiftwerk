"use client";

import { useEffect } from "react";

export const SETTINGS_LIST_ITEM_ID_ATTR = "data-settings-list-item-id";

export function settingsListItemAttrs(id: string) {
  return { [SETTINGS_LIST_ITEM_ID_ATTR]: id };
}

export function scrollSettingsListItemIntoView(itemId: string) {
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
      row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  });
}

/** Scrollt zur Zeile, sobald der Eintrag in der Liste vorhanden ist (z. B. nach router.refresh). */
export function useScrollToSettingsListItem(
  items: readonly { id: string }[],
  itemId: string | null,
  onScrolled?: () => void
) {
  useEffect(() => {
    if (!itemId) return;
    if (!items.some((item) => item.id === itemId)) return;
    scrollSettingsListItemIntoView(itemId);
    onScrolled?.();
  }, [items, itemId, onScrolled]);
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
