"use client";

import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { MODAL_DROPDOWN_Z_INDEX } from "@/components/settings/settings-modal-shell";

const HEADER_TOOLBAR_DROPDOWN_GAP_PX = 6;

type Options = {
  align?: "start" | "end";
  width?: number;
  resolveWidth?: (anchorRect: DOMRect) => number;
};

/** Fixed position for header-toolbar dropdowns — escapes overflow clipping on the scroll row. */
export function useHeaderToolbarDropdownPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  options: Options = {},
  deps: ReadonlyArray<unknown> = []
): CSSProperties | null {
  const { align = "start", width, resolveWidth } = options;
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle((current) => (current === null ? current : null));
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const panelWidth = width ?? resolveWidth?.(rect) ?? rect.width;

      const nextStyle: CSSProperties = {
        position: "fixed",
        top: rect.bottom + HEADER_TOOLBAR_DROPDOWN_GAP_PX,
        left: align === "end" ? rect.right - panelWidth : rect.left,
        width: panelWidth,
        minWidth: align === "start" ? rect.width : undefined,
        zIndex: MODAL_DROPDOWN_Z_INDEX,
      };

      setStyle((current) => {
        if (
          current &&
          current.top === nextStyle.top &&
          current.left === nextStyle.left &&
          current.width === nextStyle.width &&
          current.minWidth === nextStyle.minWidth
        ) {
          return current;
        }
        return nextStyle;
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef, align, width, resolveWidth, ...deps]);

  return style;
}
