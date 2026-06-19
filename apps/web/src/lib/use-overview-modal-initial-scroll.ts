"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { scrollSettingsListItemIntoView } from "@/lib/settings-list-scroll";

type Options = {
  initialEmployeeId?: string | null;
  loading: boolean;
  rows: readonly { id: string }[];
  resolveFirstRowId: (employeeId: string) => string | null;
  onEmployeePosition?: (employeeId: string, firstRowId: string | null) => void;
};

export function useOverviewModalListScroll({
  initialEmployeeId,
  loading,
  rows,
  resolveFirstRowId,
  onEmployeePosition,
}: Options) {
  const [contentReady, setContentReady] = useState(() => !initialEmployeeId);
  const [scrollRequestVersion, setScrollRequestVersion] = useState(0);
  const pendingScrollRowIdRef = useRef<string | null>(null);
  const initialJumpDoneRef = useRef(false);

  const jumpToEmployee = useCallback(
    (employeeId: string, firstRowId: string | null) => {
      onEmployeePosition?.(employeeId, firstRowId);
      if (!firstRowId) {
        pendingScrollRowIdRef.current = null;
        setContentReady(true);
        return;
      }
      pendingScrollRowIdRef.current = firstRowId;
      setContentReady(false);
      setScrollRequestVersion((version) => version + 1);
    },
    [onEmployeePosition]
  );

  useLayoutEffect(() => {
    if (loading) return;

    if (initialEmployeeId && !initialJumpDoneRef.current) {
      initialJumpDoneRef.current = true;
      const firstRowId = resolveFirstRowId(initialEmployeeId);
      onEmployeePosition?.(initialEmployeeId, firstRowId);
      if (!firstRowId) {
        pendingScrollRowIdRef.current = null;
        setContentReady(true);
        return;
      }
      pendingScrollRowIdRef.current = firstRowId;
    }

    const pendingRowId = pendingScrollRowIdRef.current;
    if (!pendingRowId) return;
    if (contentReady) return;
    if (!rows.some((row) => row.id === pendingRowId)) return;

    scrollSettingsListItemIntoView(pendingRowId, "top", "instant");
    pendingScrollRowIdRef.current = null;
    setContentReady(true);
  }, [
    contentReady,
    initialEmployeeId,
    loading,
    onEmployeePosition,
    resolveFirstRowId,
    rows,
    scrollRequestVersion,
  ]);

  return {
    contentReady,
    waitingForContent: loading || !contentReady,
    jumpToEmployee,
  };
}

/** @deprecated Use useOverviewModalListScroll */
export const useOverviewModalInitialScroll = useOverviewModalListScroll;
