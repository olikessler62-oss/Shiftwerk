"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildOverviewAvailabilitiesModalUrl } from "@/lib/overview-modal-navigation";
import { usePlanningContextMenuDismiss } from "@/lib/planning-context-menu-dismiss";

export type PlanningEmployeeListContextMenuState = {
  employeeId: string;
  x: number;
  y: number;
};

export function usePlanningEmployeeListContextMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menu, setMenu] = useState<PlanningEmployeeListContextMenuState | null>(
    null
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const skipCloseRef = useRef(false);
  const openedAtRef = useRef(0);

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const openMenu = useCallback(
    (employeeId: string, clientX: number, clientY: number) => {
      skipCloseRef.current = true;
      openedAtRef.current = performance.now();
      setMenu({ employeeId, x: clientX, y: clientY });
    },
    []
  );

  const openAvailabilities = useCallback(
    (employeeId: string) => {
      skipCloseRef.current = true;
      router.push(
        buildOverviewAvailabilitiesModalUrl(pathname, searchParams, employeeId)
      );
      closeMenu();
    },
    [closeMenu, pathname, router, searchParams]
  );

  usePlanningContextMenuDismiss(!!menu, closeMenu, {
    menuRef,
    skipCloseRef,
    openedAtRef,
  });

  return {
    menu,
    menuRef,
    openMenu,
    closeMenu,
    openAvailabilities,
  };
}
