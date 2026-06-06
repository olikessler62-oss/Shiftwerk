"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";

export type SortableListItem = { id: string; sort_order: number };

export function sortBySortOrder<T extends SortableListItem>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

export function getSelectedReorderState<T extends SortableListItem>(
  sortedList: T[],
  selectedId: string | null
) {
  const selected = selectedId
    ? sortedList.find((item) => item.id === selectedId)
    : undefined;
  const selectedIndex = selected
    ? sortedList.findIndex((item) => item.id === selected.id)
    : -1;

  return {
    selected,
    selectedIndex,
    canMoveUp: selectedIndex > 0,
    canMoveDown:
      selectedIndex >= 0 && selectedIndex < sortedList.length - 1,
  };
}

export function computeReorderMove<T extends SortableListItem>(
  sortedList: T[],
  selectedIndex: number,
  direction: -1 | 1
): { nextList: T[]; orderedIds: string[] } | null {
  if (selectedIndex < 0) return null;
  const targetIndex = selectedIndex + direction;
  if (targetIndex < 0 || targetIndex >= sortedList.length) return null;

  const next = [...sortedList];
  const [item] = next.splice(selectedIndex, 1);
  next.splice(targetIndex, 0, item);

  return {
    nextList: next.map((entry, index) => ({ ...entry, sort_order: index })),
    orderedIds: next.map((entry) => entry.id),
  };
}

type ReorderActionResult = { ok: true } | { ok: false; error: string };

export function useSettingsListReorder<T extends SortableListItem>({
  list,
  setList,
  selectedId,
  pending,
  startTransition,
  reorder,
  onError,
  onSuccess,
}: {
  list: T[];
  setList: Dispatch<SetStateAction<T[]>>;
  selectedId: string | null;
  pending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  reorder: (orderedIds: string[]) => Promise<ReorderActionResult>;
  onError: (message: string) => void;
  onSuccess?: () => void;
}) {
  const sortedList = useMemo(() => sortBySortOrder(list), [list]);
  const { selectedIndex, canMoveUp, canMoveDown } = getSelectedReorderState(
    sortedList,
    selectedId
  );

  function handleMove(direction: -1 | 1) {
    const move = computeReorderMove(sortedList, selectedIndex, direction);
    if (!move) return;

    const previousList = list;
    setList(move.nextList);

    startTransition(async () => {
      const result = await reorder(move.orderedIds);
      if (!result.ok) {
        setList(previousList);
        onError(result.error);
        return;
      }
      onSuccess?.();
    });
  }

  return {
    sortedList,
    canMoveUp,
    canMoveDown,
    handleMove,
    pending,
  };
}
