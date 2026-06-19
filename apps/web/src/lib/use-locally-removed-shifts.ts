"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

const removedShiftIdsByScope = new Map<string, ReadonlySet<string>>();

function readRemovedShiftIds(scopeKey: string): ReadonlySet<string> {
  return removedShiftIdsByScope.get(scopeKey) ?? new Set<string>();
}

function writeRemovedShiftIds(
  scopeKey: string,
  ids: ReadonlySet<string>
): ReadonlySet<string> {
  if (ids.size === 0) {
    removedShiftIdsByScope.delete(scopeKey);
  } else {
    removedShiftIdsByScope.set(scopeKey, ids);
  }
  return ids;
}

export function useLocallyRemovedShifts(scopeKey: string) {
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(() =>
    readRemovedShiftIds(scopeKey)
  );

  useEffect(() => {
    setRemovedIds(readRemovedShiftIds(scopeKey));
  }, [scopeKey]);

  const markRemoved = useCallback(
    (shiftIds: readonly string[]) => {
      if (!shiftIds.length) return;
      flushSync(() => {
        setRemovedIds((prev) => {
          const next = new Set(prev);
          for (const id of shiftIds) next.add(id);
          return writeRemovedShiftIds(scopeKey, next);
        });
      });
    },
    [scopeKey]
  );

  const unmarkRemoved = useCallback(
    (shiftIds: readonly string[]) => {
      if (!shiftIds.length) return;
      setRemovedIds((prev) => {
        const next = new Set(prev);
        for (const id of shiftIds) next.delete(id);
        return writeRemovedShiftIds(scopeKey, next);
      });
    },
    [scopeKey]
  );

  const filterRemoved = useCallback(
    <T extends { id: string }>(items: readonly T[]): T[] => {
      if (removedIds.size === 0) return items as T[];
      return items.filter((item) => !removedIds.has(item.id));
    },
    [removedIds]
  );

  return { removedIds, markRemoved, unmarkRemoved, filterRemoved };
}
