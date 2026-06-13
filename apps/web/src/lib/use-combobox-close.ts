"use client";

import { useEffect, useRef, type RefObject } from "react";
import { distanceFromPointToRect } from "@/lib/mouse-tooltip-position";

export const COMBOBOX_CLOSE_DISTANCE_PX = 25;

/** Schließt eine geöffnete Combobox bei Klick außerhalb oder wenn der Cursor >25px entfernt ist. */
export function useComboboxCloseOnPointerDistance(
  open: boolean,
  onClose: () => void,
  refs: RefObject<HTMLElement | null>[],
  distancePx: number = COMBOBOX_CLOSE_DISTANCE_PX
) {
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const isInside = (target: Node) =>
      refsRef.current.some((ref) => ref.current?.contains(target));

    const isNearOpenSurface = (clientX: number, clientY: number) =>
      refsRef.current.some((ref) => {
        const node = ref.current;
        if (!node) return false;
        return (
          distanceFromPointToRect(
            clientX,
            clientY,
            node.getBoundingClientRect()
          ) <= distancePx
        );
      });

    const handlePointerDown = (event: MouseEvent) => {
      if (!isInside(event.target as Node)) {
        onCloseRef.current();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isNearOpenSurface(event.clientX, event.clientY)) {
        onCloseRef.current();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, [open, distancePx]);
}
