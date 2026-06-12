export const MOUSE_TOOLTIP_CURSOR_GAP_PX = 3;
export const COMBOBOX_TOOLTIP_ANCHOR_GAP_PX = 2;
export const COMBOBOX_TOOLTIP_CLOSE_DISTANCE_PX = 10;
export const MOUSE_TOOLTIP_VIEWPORT_PADDING_PX = 8;

export type MousePoint = {
  x: number;
  y: number;
};

export function distanceFromPointToRect(
  clientX: number,
  clientY: number,
  rect: DOMRect | DOMRectReadOnly
): number {
  const closestX = Math.max(rect.left, Math.min(clientX, rect.right));
  const closestY = Math.max(rect.top, Math.min(clientY, rect.bottom));
  return Math.hypot(clientX - closestX, clientY - closestY);
}

/** Vertikal am Namen, horizontal: linker Tooltip-Rand am rechten Combobox-Rand. */
export function resolveNameHoverTooltipPosition(
  nameRect: DOMRect | DOMRectReadOnly,
  comboboxRect: DOMRect | DOMRectReadOnly,
  tooltipWidth: number,
  tooltipHeight: number,
  options: { offsetX?: number; offsetY?: number } = {}
): MousePoint {
  const padding = MOUSE_TOOLTIP_VIEWPORT_PADDING_PX;
  const gap = COMBOBOX_TOOLTIP_ANCHOR_GAP_PX;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;

  let x = comboboxRect.right + offsetX;
  let y = nameRect.top - gap - tooltipHeight + offsetY;

  if (y < padding) {
    y = nameRect.bottom + gap;
  }

  if (x + tooltipWidth > window.innerWidth - padding) {
    x = window.innerWidth - tooltipWidth - padding;
  }

  y = Math.max(
    padding,
    Math.min(y, window.innerHeight - tooltipHeight - padding)
  );

  return { x, y };
}

/** Links von der Combobox, vertikal zentriert; rechter Tooltip-Rand 2px links vom Combobox-Rand. */
export function resolveComboboxAnchorTooltipPosition(
  anchorRect: DOMRect | DOMRectReadOnly,
  tooltipWidth: number,
  tooltipHeight: number
): MousePoint {
  const padding = MOUSE_TOOLTIP_VIEWPORT_PADDING_PX;
  const gap = COMBOBOX_TOOLTIP_ANCHOR_GAP_PX;

  let x = anchorRect.left - gap - tooltipWidth;
  let y = anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2;

  if (x < padding) {
    x = anchorRect.right + gap;
  }

  x = Math.max(
    padding,
    Math.min(x, window.innerWidth - tooltipWidth - padding)
  );
  y = Math.max(
    padding,
    Math.min(y, window.innerHeight - tooltipHeight - padding)
  );

  return { x, y };
}

/** Links vom Zeiger, vertikal zentriert; rechter Tooltip-Rand 3px links vom Cursor. */
export function resolveMouseTooltipPosition(
  clientX: number,
  clientY: number,
  tooltipWidth: number,
  tooltipHeight: number
): MousePoint {
  const padding = MOUSE_TOOLTIP_VIEWPORT_PADDING_PX;
  const gap = MOUSE_TOOLTIP_CURSOR_GAP_PX;

  let x = clientX - gap - tooltipWidth;
  let y = clientY - tooltipHeight / 2;

  if (x < padding) {
    x = clientX + gap;
  }

  x = Math.max(
    padding,
    Math.min(x, window.innerWidth - tooltipWidth - padding)
  );
  y = Math.max(
    padding,
    Math.min(y, window.innerHeight - tooltipHeight - padding)
  );

  return { x, y };
}
