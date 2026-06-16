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
import { cn } from "@/lib/cn";

type AppShellModalLockContextValue = {
  isLocked: boolean;
  isWaitCursor: boolean;
};

const AppShellModalLockContext = createContext<AppShellModalLockContextValue>({
  isLocked: false,
  isWaitCursor: false,
});

const AppShellModalLockAdjustContext = createContext<
  ((delta: number) => void) | null
>(null);

const AppShellWaitCursorAdjustContext = createContext<
  ((delta: number) => void) | null
>(null);

export function AppShellModalLockProvider({ children }: { children: ReactNode }) {
  const [lockCount, setLockCount] = useState(0);
  const [waitCursorCount, setWaitCursorCount] = useState(0);

  const adjustLock = useCallback((delta: number) => {
    setLockCount((count) => Math.max(0, count + delta));
  }, []);

  const adjustWaitCursor = useCallback((delta: number) => {
    setWaitCursorCount((count) => Math.max(0, count + delta));
  }, []);

  const value = useMemo(
    () => ({
      isLocked: lockCount > 0,
      isWaitCursor: waitCursorCount > 0,
    }),
    [lockCount, waitCursorCount]
  );

  return (
    <AppShellModalLockAdjustContext.Provider value={adjustLock}>
      <AppShellWaitCursorAdjustContext.Provider value={adjustWaitCursor}>
        <AppShellModalLockContext.Provider value={value}>
          {children}
        </AppShellModalLockContext.Provider>
      </AppShellWaitCursorAdjustContext.Provider>
    </AppShellModalLockAdjustContext.Provider>
  );
}

export function useIsAppShellWaitCursor(): boolean {
  return useContext(AppShellModalLockContext).isWaitCursor;
}

export function useIsAppShellLocked(): boolean {
  return useContext(AppShellModalLockContext).isLocked;
}

export function useAppShellControlsDisabledClass(): string {
  return useIsAppShellLocked() ? "pointer-events-none opacity-50" : "";
}

export function useAppShellModalLockActive(active: boolean): void {
  const adjustLock = useContext(AppShellModalLockAdjustContext);

  useEffect(() => {
    if (!adjustLock || !active) return;
    adjustLock(1);
    return () => adjustLock(-1);
  }, [active, adjustLock]);
}

export function useAppShellWaitCursorActive(active: boolean): void {
  const adjustWaitCursor = useContext(AppShellWaitCursorAdjustContext);

  useEffect(() => {
    if (!adjustWaitCursor || !active) return;
    adjustWaitCursor(1);
    return () => adjustWaitCursor(-1);
  }, [active, adjustWaitCursor]);
}

type AppShellControlsGuardProps = {
  children: ReactNode;
  className?: string;
};

export function AppShellControlsGuard({
  children,
  className,
}: AppShellControlsGuardProps) {
  const isLocked = useIsAppShellLocked();

  return (
    <div
      className={cn(className, isLocked && "pointer-events-none opacity-50")}
      aria-hidden={isLocked || undefined}
      {...(isLocked ? { inert: true } : {})}
    >
      {children}
    </div>
  );
}
