import { useEffect, type MutableRefObject, type RefObject } from "react";

const CONTEXT_MENU_CLOSE_DISTANCE_PX = 20;

function distanceFromPointToMenu(
  clientX: number,
  clientY: number,
  menu: HTMLElement
): number {
  const rect = menu.getBoundingClientRect();
  const dx =
    clientX < rect.left
      ? rect.left - clientX
      : clientX > rect.right
        ? clientX - rect.right
        : 0;
  const dy =
    clientY < rect.top
      ? rect.top - clientY
      : clientY > rect.bottom
        ? clientY - rect.bottom
        : 0;
  return Math.hypot(dx, dy);
}

export type PlanningContextMenuDismissRefs = {
  menuRef: RefObject<HTMLElement | null>;
  skipCloseRef: MutableRefObject<boolean>;
  openedAtRef: MutableRefObject<number>;
};

export function usePlanningContextMenuDismiss(
  open: boolean,
  onClose: () => void,
  refs: PlanningContextMenuDismissRefs
): void {
  const { menuRef, skipCloseRef, openedAtRef } = refs;

  useEffect(() => {
    if (!open) return;

    function closeMenu() {
      onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    function onMouseMove(event: MouseEvent) {
      if (performance.now() - openedAtRef.current < 200) return;
      const menu = menuRef.current;
      if (!menu) return;
      if (
        distanceFromPointToMenu(event.clientX, event.clientY, menu) >
        CONTEXT_MENU_CLOSE_DISTANCE_PX
      ) {
        closeMenu();
      }
    }

    function onDocumentContextMenu() {
      if (skipCloseRef.current) {
        skipCloseRef.current = false;
        return;
      }
      closeMenu();
    }

    function onDocumentClick() {
      if (skipCloseRef.current) {
        skipCloseRef.current = false;
        return;
      }
      closeMenu();
    }

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("contextmenu", onDocumentContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("contextmenu", onDocumentContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("scroll", closeMenu, true);
    };
  }, [menuRef, onClose, open, openedAtRef, skipCloseRef]);
}
