/** Vertikale Metriken für Schichtkarten-Zeilen im Kalender. */
/** Zusätzliche sichtbare Breite/Höhe pro Schichtkarte. */
export const SHIFT_CARD_EXTRA_WIDTH_PX = 1;
export const SHIFT_CARD_EXTRA_HEIGHT_PX = 1;
/** Zwei Textzeilen + vertikales Padding — leicht über Reserve, damit nichts abgeschnitten wird. */
export const SHIFT_CARD_TWO_LINE_HEIGHT_PX = 30 + SHIFT_CARD_EXTRA_HEIGHT_PX;
export const SHIFT_CARD_LIST_GAP_PX = 4;
/** Unteres Padding der Schichtkarten-Liste (pb-1). */
export const SHIFT_CARD_LIST_BOTTOM_PADDING_PX = 4;
export const SHIFT_CARD_ROW_FIT_BUFFER_PX = 4;
/** Schatten der Karten ragt unter die Layout-Box — für Zeilenhöhe und Scroll berücksichtigen. */
export const SHIFT_CARD_SHADOW_OVERFLOW_PX = 6;
export const AREA_ROW_CELL_PADDING_Y_PX = 16;
export const AREA_ROW_HEADER_STRIP_PX = 20;
export const AREA_ROW_FOOTER_STRIP_PX = 18;
export const AREA_ROW_EMPTY_HEIGHT_PX = 50;
/** Harte Untergrenze für jede Bereichszeile (Fenster verkleinern, Platz knapp). */
export const AREA_ROW_MIN_HEIGHT_PX = AREA_ROW_EMPTY_HEIGHT_PX;
/** Größter Bereich muss mindestens so viel höher sein als der zweitgrößte. */
export const DOMINANT_AREA_MIN_LEAD_RATIO = 1.25;
export const CALENDAR_HEADER_HEIGHT_PX = 56;

function clampAreaRowHeightPx(heightPx: number): number {
  return Math.max(AREA_ROW_MIN_HEIGHT_PX, heightPx);
}

export const AREA_ROW_VERTICAL_CHROME_PX =
  AREA_ROW_CELL_PADDING_Y_PX +
  AREA_ROW_HEADER_STRIP_PX +
  AREA_ROW_FOOTER_STRIP_PX;

export function areaRowShiftStackHeightPx(shiftCount: number): number {
  if (shiftCount <= 0) return 0;
  return (
    shiftCount * SHIFT_CARD_TWO_LINE_HEIGHT_PX +
    Math.max(0, shiftCount - 1) * SHIFT_CARD_LIST_GAP_PX +
    SHIFT_CARD_SHADOW_OVERFLOW_PX
  );
}

export function areaRowRequiredHeightPx(maxLaneCount: number): number {
  if (maxLaneCount <= 0) {
    return AREA_ROW_EMPTY_HEIGHT_PX;
  }
  return (
    AREA_ROW_VERTICAL_CHROME_PX +
    areaRowShiftStackHeightPx(maxLaneCount) +
    SHIFT_CARD_ROW_FIT_BUFFER_PX +
    SHIFT_CARD_LIST_BOTTOM_PADDING_PX
  );
}

export function areaRowContentHeightPx(rowHeightPx: number): number {
  return Math.max(
    0,
    rowHeightPx -
      AREA_ROW_VERTICAL_CHROME_PX -
      SHIFT_CARD_ROW_FIT_BUFFER_PX -
      SHIFT_CARD_LIST_BOTTOM_PADDING_PX
  );
}

export function areaRowShiftStackFitsPx(
  laneCount: number,
  availableContentHeightPx: number
): boolean {
  return areaRowShiftStackHeightPx(laneCount) <= availableContentHeightPx;
}

export type AreaRowLayout = {
  /** Zugewiesene Zeilenhöhe in px. */
  heightPx: number;
  /** Höhe für alle Schichten ohne Scrollen. */
  requiredPx: number;
  /** Verfügbare Höhe für die Schichtkarten-Liste (ohne Header/Footer/Padding). */
  contentHeightPx: number;
  /** Zeile darf mit 1fr wachsen, wenn Platz übrig ist. */
  flexGrow: boolean;
};

function buildAreaRowLayout(
  requiredPx: number,
  heightPx: number
): AreaRowLayout {
  return {
    heightPx,
    requiredPx,
    contentHeightPx: areaRowContentHeightPx(heightPx),
    flexGrow: false,
  };
}

function sumHeights(
  areas: readonly { id: string }[],
  heights: ReadonlyMap<string, number>
): number {
  return areas.reduce((sum, area) => sum + (heights.get(area.id) ?? 0), 0);
}

function busiestActiveAreaId(
  activeAreas: readonly { id: string }[],
  maxShiftCountByAreaId: ReadonlyMap<string, number>
): string | null {
  let best: { id: string; count: number } | null = null;
  for (const area of activeAreas) {
    const count = maxShiftCountByAreaId.get(area.id) ?? 0;
    if (!best || count > best.count) {
      best = { id: area.id, count };
    }
  }
  return best?.id ?? null;
}

/** Bereich mit deutlich mehr Schichten — dort scrollt es zuerst. */
export function findDominantAreaId(
  activeAreas: readonly { id: string }[],
  requiredByArea: ReadonlyMap<string, number>
): string | null {
  if (activeAreas.length < 2) return null;

  const ranked = activeAreas
    .map((area) => ({
      id: area.id,
      requiredPx: requiredByArea.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX,
    }))
    .sort((a, b) => b.requiredPx - a.requiredPx);

  const [largest, second] = ranked;
  if (largest.requiredPx < second.requiredPx * DOMINANT_AREA_MIN_LEAD_RATIO) {
    return null;
  }

  return largest.id;
}

function distributeSlackToBusiestAreas(
  heights: Map<string, number>,
  activeAreas: readonly { id: string }[],
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
  slackPx: number
): void {
  if (slackPx <= 0 || activeAreas.length === 0) return;

  const maxCount = Math.max(
    0,
    ...activeAreas.map((area) => maxShiftCountByAreaId.get(area.id) ?? 0)
  );
  if (maxCount <= 0) return;

  const recipients = activeAreas.filter(
    (area) => (maxShiftCountByAreaId.get(area.id) ?? 0) === maxCount
  );
  if (recipients.length === 0) return;

  let distributed = 0;
  recipients.forEach((area, index) => {
    const extra =
      index === recipients.length - 1
        ? slackPx - distributed
        : Math.floor(slackPx / recipients.length);
    heights.set(area.id, (heights.get(area.id) ?? 0) + extra);
    distributed += extra;
  });
}

function normalizeHeightsToTarget(
  areas: readonly { id: string }[],
  activeAreas: readonly { id: string }[],
  heights: Map<string, number>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
  targetHeightPx: number,
  dominantAreaId: string | null
): void {
  const diff = targetHeightPx - sumHeights(areas, heights);
  if (diff === 0) return;

  const preferredId =
    dominantAreaId ??
    busiestActiveAreaId(activeAreas, maxShiftCountByAreaId);
  const fallbackId = activeAreas[0]?.id ?? areas[0]?.id;
  const adjustId = preferredId ?? fallbackId;
  if (!adjustId) return;

  if (diff > 0) {
    heights.set(adjustId, (heights.get(adjustId) ?? 0) + diff);
    return;
  }

  let toRemove = -diff;
  const shrinkOrder = dominantAreaId
    ? [
        dominantAreaId,
        ...activeAreas
          .map((area) => area.id)
          .filter((id) => id !== dominantAreaId)
          .sort((a, b) => (heights.get(b) ?? 0) - (heights.get(a) ?? 0)),
      ]
    : [...activeAreas]
        .sort((a, b) => (heights.get(b.id) ?? 0) - (heights.get(a.id) ?? 0))
        .map((area) => area.id);

  for (const areaId of shrinkOrder) {
    if (toRemove <= 0) break;
    const current = heights.get(areaId) ?? 0;
    const removable = current - AREA_ROW_MIN_HEIGHT_PX;
    if (removable <= 0) continue;
    const remove = Math.min(removable, toRemove);
    heights.set(areaId, current - remove);
    toRemove -= remove;
  }
}

/** Kleine Bereiche zuerst voll auffüllen; dominant scrollt zuletzt. */
function allocateHeightsWithDominantArea(
  areas: readonly { id: string }[],
  activeAreas: readonly { id: string }[],
  requiredByArea: ReadonlyMap<string, number>,
  dominantAreaId: string,
  availableBodyHeightPx: number
): Map<string, number> {
  const assigned = new Map<string, number>();

  for (const area of areas) {
    assigned.set(area.id, AREA_ROW_MIN_HEIGHT_PX);
  }

  let remaining =
    availableBodyHeightPx - AREA_ROW_MIN_HEIGHT_PX * areas.length;
  if (remaining <= 0) {
    return assigned;
  }

  const grantExtra = (areaId: string) => {
    const requiredPx = requiredByArea.get(areaId) ?? AREA_ROW_MIN_HEIGHT_PX;
    const extra = Math.max(0, requiredPx - AREA_ROW_MIN_HEIGHT_PX);
    const grant = Math.min(extra, remaining);
    assigned.set(areaId, AREA_ROW_MIN_HEIGHT_PX + grant);
    remaining -= grant;
  };

  for (const area of areas) {
    if (activeAreas.some((entry) => entry.id === area.id)) continue;
    grantExtra(area.id);
  }

  for (const area of activeAreas) {
    if (area.id === dominantAreaId) continue;
    grantExtra(area.id);
  }

  assigned.set(
    dominantAreaId,
    (assigned.get(dominantAreaId) ?? AREA_ROW_MIN_HEIGHT_PX) + remaining
  );

  return assigned;
}

function allocateHeightsWhenSpaceIsTight(
  areas: readonly { id: string }[],
  activeAreas: readonly { id: string }[],
  requiredByArea: ReadonlyMap<string, number>,
  availableBodyHeightPx: number
): Map<string, number> {
  const assigned = new Map<string, number>();

  for (const area of areas) {
    assigned.set(area.id, AREA_ROW_MIN_HEIGHT_PX);
  }

  let remaining =
    availableBodyHeightPx - AREA_ROW_MIN_HEIGHT_PX * areas.length;
  if (remaining <= 0) {
    return assigned;
  }

  const extraNeedByArea = new Map<string, number>();
  for (const area of areas) {
    const requiredPx = requiredByArea.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX;
    extraNeedByArea.set(
      area.id,
      Math.max(0, requiredPx - AREA_ROW_MIN_HEIGHT_PX)
    );
  }

  for (const area of areas) {
    if (activeAreas.some((entry) => entry.id === area.id)) continue;
    const grant = Math.min(extraNeedByArea.get(area.id) ?? 0, remaining);
    assigned.set(area.id, AREA_ROW_MIN_HEIGHT_PX + grant);
    remaining -= grant;
  }

  const activeByDescendingNeed = [...activeAreas].sort(
    (a, b) =>
      (requiredByArea.get(b.id) ?? 0) - (requiredByArea.get(a.id) ?? 0)
  );

  for (const area of activeByDescendingNeed) {
    const grant = Math.min(extraNeedByArea.get(area.id) ?? 0, remaining);
    assigned.set(area.id, AREA_ROW_MIN_HEIGHT_PX + grant);
    remaining -= grant;
  }

  if (remaining > 0 && activeByDescendingNeed[0]) {
    const busiest = activeByDescendingNeed[0];
    assigned.set(
      busiest.id,
      (assigned.get(busiest.id) ?? AREA_ROW_MIN_HEIGHT_PX) + remaining
    );
  }

  return assigned;
}

/**
 * Füllt immer die volle Kalenderhöhe.
 * Bei dominantem Bereich (≥25 % mehr Schichten): kleinere Bereiche wachsen zuerst,
 * Scrollbars erscheinen zuerst im größten Bereich.
 */
export function computeAreaRowLayouts(
  areas: readonly { id: string }[],
  layoutActiveAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
  availableBodyHeightPx: number
): Map<string, AreaRowLayout> {
  const result = new Map<string, AreaRowLayout>();
  const requiredByArea = new Map<string, number>();
  const activeAreas = areas.filter((area) => layoutActiveAreaIds.has(area.id));

  for (const area of areas) {
    if (!layoutActiveAreaIds.has(area.id)) {
      requiredByArea.set(area.id, AREA_ROW_EMPTY_HEIGHT_PX);
      continue;
    }
    const maxShifts = maxShiftCountByAreaId.get(area.id) ?? 0;
    requiredByArea.set(area.id, areaRowRequiredHeightPx(maxShifts));
  }

  const heights = new Map<string, number>();
  for (const area of areas) {
    heights.set(area.id, requiredByArea.get(area.id) ?? AREA_ROW_EMPTY_HEIGHT_PX);
  }

  if (availableBodyHeightPx <= 0) {
    for (const area of areas) {
      const requiredPx = requiredByArea.get(area.id) ?? AREA_ROW_EMPTY_HEIGHT_PX;
      result.set(area.id, buildAreaRowLayout(requiredPx, requiredPx));
    }
    return result;
  }

  const totalMinimum = sumHeights(areas, heights);
  const dominantAreaId = findDominantAreaId(activeAreas, requiredByArea);

  if (totalMinimum <= availableBodyHeightPx) {
    distributeSlackToBusiestAreas(
      heights,
      activeAreas,
      maxShiftCountByAreaId,
      availableBodyHeightPx - totalMinimum
    );
  } else if (dominantAreaId) {
    const tight = allocateHeightsWithDominantArea(
      areas,
      activeAreas,
      requiredByArea,
      dominantAreaId,
      availableBodyHeightPx
    );
    for (const area of areas) {
      heights.set(area.id, tight.get(area.id) ?? requiredByArea.get(area.id) ?? 0);
    }
  } else {
    const tight = allocateHeightsWhenSpaceIsTight(
      areas,
      activeAreas,
      requiredByArea,
      availableBodyHeightPx
    );
    for (const area of areas) {
      heights.set(area.id, tight.get(area.id) ?? requiredByArea.get(area.id) ?? 0);
    }
  }

  normalizeHeightsToTarget(
    areas,
    activeAreas,
    heights,
    maxShiftCountByAreaId,
    availableBodyHeightPx,
    dominantAreaId
  );

  for (const area of areas) {
    const requiredPx = requiredByArea.get(area.id) ?? AREA_ROW_EMPTY_HEIGHT_PX;
    const heightPx = clampAreaRowHeightPx(
      heights.get(area.id) ?? requiredPx
    );
    result.set(area.id, buildAreaRowLayout(requiredPx, heightPx));
  }

  return result;
}

export function buildAreaRowGridTrack(layout: AreaRowLayout): string {
  const heightPx = clampAreaRowHeightPx(layout.heightPx);
  return `minmax(${AREA_ROW_MIN_HEIGHT_PX}px, ${heightPx}px)`;
}

export function cellShiftListNeedsScroll(
  laneCount: number,
  rowLayout: AreaRowLayout
): boolean {
  if (laneCount === 0) return false;
  return !areaRowShiftStackFitsPx(laneCount, rowLayout.contentHeightPx);
}

/**
 * Scrollbar nur wo sinnvoll: kleine Bereiche scrollen nicht, solange sie ihre
 * volle Soll-Höhe erhalten haben — der dominante Bereich scrollt zuerst.
 */
export function cellShiftListShouldEnableScroll(
  laneCount: number,
  rowLayout: AreaRowLayout,
  options: {
    dominantAreaId?: string | null;
    areaId?: string;
  } = {}
): boolean {
  if (laneCount === 0) return false;

  const { dominantAreaId, areaId } = options;

  if (dominantAreaId && areaId && areaId !== dominantAreaId) {
    if (rowLayout.heightPx >= rowLayout.requiredPx) {
      return false;
    }
  }

  if (dominantAreaId && areaId === dominantAreaId) {
    if (rowLayout.heightPx < rowLayout.requiredPx) {
      return true;
    }
  }

  return cellShiftListNeedsScroll(laneCount, rowLayout);
}

export function totalAssignedRowHeightPx(
  areas: readonly { id: string }[],
  layouts: ReadonlyMap<string, AreaRowLayout>
): number {
  return areas.reduce(
    (sum, area) => sum + (layouts.get(area.id)?.heightPx ?? 0),
    0
  );
}
