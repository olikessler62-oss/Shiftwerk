"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSuperadminModal } from "@/components/settings/superadmin-modal-context";
import { useAppShellWaitCursorActive } from "@/lib/app-shell-modal-lock";
import type { SettingsModalQueryFlag } from "@/lib/settings-modal-navigation";

export type MainNavPendingTarget =
  | { kind: "page"; pathname: string }
  | { kind: "settings-modal"; flag: SettingsModalQueryFlag }
  | { kind: "superadmin" };

type MainNavPendingContextValue = {
  pendingTarget: MainNavPendingTarget | null;
  beginMainNavPending: (target: MainNavPendingTarget) => void;
  clearMainNavPending: () => void;
};

const MainNavPendingContext = createContext<MainNavPendingContextValue | null>(
  null
);

export function AppShellMainNavPendingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [pendingTarget, setPendingTarget] = useState<MainNavPendingTarget | null>(
    null
  );

  const beginMainNavPending = useCallback((target: MainNavPendingTarget) => {
    setPendingTarget(target);
  }, []);

  const clearMainNavPending = useCallback(() => {
    setPendingTarget(null);
  }, []);

  const value = useMemo(
    () => ({
      pendingTarget,
      beginMainNavPending,
      clearMainNavPending,
    }),
    [pendingTarget, beginMainNavPending, clearMainNavPending]
  );

  return (
    <MainNavPendingContext.Provider value={value}>
      {children}
    </MainNavPendingContext.Provider>
  );
}

export function useBeginMainNavPending(): (target: MainNavPendingTarget) => void {
  const ctx = useContext(MainNavPendingContext);
  return ctx?.beginMainNavPending ?? (() => {});
}

export function useClearMainNavPendingOptional(): () => void {
  return useContext(MainNavPendingContext)?.clearMainNavPending ?? (() => {});
}

export function AppShellMainNavPendingBridge() {
  const ctx = useContext(MainNavPendingContext);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { open: superadminOpen } = useSuperadminModal();

  const pendingTarget = ctx?.pendingTarget ?? null;
  const clearMainNavPending = ctx?.clearMainNavPending;

  useAppShellWaitCursorActive(pendingTarget !== null);

  useEffect(() => {
    if (!pendingTarget || !clearMainNavPending) return;

    if (pendingTarget.kind === "page") {
      if (pathname === pendingTarget.pathname) {
        clearMainNavPending();
      }
      return;
    }

    if (pendingTarget.kind === "superadmin") {
      if (superadminOpen) {
        clearMainNavPending();
      }
      return;
    }

    if (
      pendingTarget.kind === "settings-modal" &&
      searchParams.get(pendingTarget.flag) === "1" &&
      (pathname === "/dashboard" || pathname === "/planer")
    ) {
      const frameId = window.requestAnimationFrame(() => {
        clearMainNavPending();
      });
      return () => window.cancelAnimationFrame(frameId);
    }
  }, [pendingTarget, pathname, searchParams, superadminOpen, clearMainNavPending]);

  useEffect(() => {
    if (!pendingTarget || !clearMainNavPending) return;
    const timeoutId = window.setTimeout(clearMainNavPending, 30_000);
    return () => window.clearTimeout(timeoutId);
  }, [pendingTarget, clearMainNavPending]);

  return null;
}
