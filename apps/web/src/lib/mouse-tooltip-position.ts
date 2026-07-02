export const MOUSE_TOOLTIP_CURSOR_GAP_PX = 3;
export const COMBOBOX_TOOLTIP_ANCHOR_GAP_PX = 2;
export const COMBOBOX_TOOLTIP_CLOSE_DISTANCE_PX = 10;
export const EMPLOYEE_AVAILABILITY_HINT_AUTO_CLOSE_MS = 6000;
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

/** Tooltip: linker Rand am rechten Combobox-Rand, unterer Rand auf Höhe des oberen Combobox-Rands. */
export function resolveNameHoverTooltipPosition(
  comboboxRect: DOMRect | DOMRectReadOnly,
  tooltipWidth: number,
  tooltipHeight: number,
  _options: { offsetY?: number } = {}
): MousePoint {
  const padding = MOUSE_TOOLTIP_VIEWPORT_PADDING_PX;
  const gap = COMBOBOX_TOOLTIP_ANCHOR_GAP_PX;

  let x = comboboxRect.right + gap;
  let y = comboboxRect.top - tooltipHeight;

  if (x + tooltipWidth > window.innerWidth - padding) {
    x = comboboxRect.left - gap - tooltipWidth;
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
