"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Options = {
  /** Nur diese IDs sind auswählbar (z. B. löschbare Einträge). */
  selectableIds?: ReadonlySet<string>;
};

export function useSettingsListBulkSelection(
  itemIds: readonly string[],
  options?: Options
) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const selectableIds = options?.selectableIds;

  useEffect(() => {
    const allowed = new Set(itemIds);
    setCheckedIds((current) => {
      const next = new Set(
        [...current].filter((id) => allowed.has(id))
      );
      return next.size === current.size ? current : next;
    });
  }, [itemIds]);

  const selectableItemIds = useMemo(() => {
    if (!selectableIds) return [...itemIds];
    return itemIds.filter((id) => selectableIds.has(id));
  }, [itemIds, selectableIds]);

  const toggle = useCallback(
    (id: string) => {
      if (selectableIds && !selectableIds.has(id)) return;
      setCheckedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [selectableIds]
  );

  const toggleAll = useCallback(() => {
    setCheckedIds((current) => {
      if (selectableItemIds.length === 0) return new Set();
      const allSelected = selectableItemIds.every((id) => current.has(id));
      if (allSelected) return new Set();
      return new Set(selectableItemIds);
    });
  }, [selectableItemIds]);

  const clear = useCallback(() => setCheckedIds(new Set()), []);

  const checkedCount = useMemo(
    () => selectableItemIds.filter((id) => checkedIds.has(id)).length,
    [checkedIds, selectableItemIds]
  );

  const allChecked =
    selectableItemIds.length > 0 && checkedCount === selectableItemIds.length;
  const someChecked = checkedCount > 0 && !allChecked;

  const isChecked = useCallback(
    (id: string) => checkedIds.has(id),
    [checkedIds]
  );

  const canBulkDelete = checkedCount > 0;

  return {
    checkedIds,
    checkedCount,
    allChecked,
    someChecked,
    canBulkDelete,
    toggle,
    toggleAll,
    clear,
    isChecked,
  };
}
