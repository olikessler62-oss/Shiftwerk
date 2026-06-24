/** Vertikale Metriken für Schichtkarten-Zeilen im Kalender. */

/** Zusätzliche sichtbare Breite/Höhe pro Schichtkarte. */
export const SHIFT_CARD_EXTRA_WIDTH_PX = 1;
export const SHIFT_CARD_EXTRA_HEIGHT_PX = 1;
/** Zwei Textzeilen + vertikales Padding — leicht über Reserve, damit nichts abgeschnitten wird. */
export const SHIFT_CARD_TWO_LINE_HEIGHT_PX = 30 + SHIFT_CARD_EXTRA_HEIGHT_PX;
/** Zusätzliche Höhe für Schichtkarten im Bereich-Kalender (Breite unverändert). */
export const AREA_CALENDAR_SHIFT_CARD_EXTRA_HEIGHT_PX = 5;
export const AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX =
  SHIFT_CARD_TWO_LINE_HEIGHT_PX + AREA_CALENDAR_SHIFT_CARD_EXTRA_HEIGHT_PX;
export const SHIFT_CARD_LIST_GAP_PX = 4;
/** Unteres Padding der Schichtkarten-Liste (pb-1). */
export const SHIFT_CARD_LIST_BOTTOM_PADDING_PX = 4;
/** Reserve unter der Liste (Schatten der letzten Karte, Subpixel). */
export const SHIFT_CARD_ROW_FIT_BUFFER_PX = 12;
/**
 * Zusätzliche Listenhöhe in der Zeile — wird nur zu required addiert, nicht von
 * contentHeightPx abgezogen (im Gegensatz zu FIT_BUFFER / VISIBLE_SPACE).
 * Schatten-Bleed ist bereits im Stack; Rest für Subpixel/Transition.
 */
export const AREA_ROW_LIST_FIT_SLACK_PX = 12;
/** Max. sichtbarer Abstand unter der letzten Schichtkarte in ausgeklappten Zellen. */
export const AREA_ROW_VISIBLE_SPACE_BELOW_LAST_SHIFT_PX = 20;
/** Externer Schatten unter jeder Karte — Wrapper-Höhe = Karte + dieser Wert. */
export const SHIFT_CARD_SHADOW_BLEED_PX = 3;
/** @deprecated Einzel-Reserve am Stack-Ende — ersetzt durch {@link SHIFT_CARD_SHADOW_BLEED_PX} pro Karte. */
export const SHIFT_CARD_SHADOW_OVERFLOW_PX = SHIFT_CARD_SHADOW_BLEED_PX;
export const AREA_ROW_CELL_PADDING_Y_PX = 16;
/**
 * Bereich-Kalender Bedarf-Strip — Wert wie `TAG_AREA_HEADER_STRIP_HEIGHT_PX`
 * in planning-calendar-layout.ts (kein Import wegen Zirkelabhängigkeit).
 */
export const AREA_ROW_HEADER_STRIP_PX = 44;
/**
 * Tag-Footer-Stats — Wert wie `PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT_PX`
 * in planning-calendar-layout.ts.
 */
export const AREA_ROW_FOOTER_STRIP_PX = 22;
export const AREA_ROW_EMPTY_HEIGHT_PX = 68;
/** Harte Untergrenze für jede Bereichszeile (Fenster verkleinern, Platz knapp). */
export const AREA_ROW_MIN_HEIGHT_PX = AREA_ROW_EMPTY_HEIGHT_PX;
/** Größter Bereich muss mindestens so viel höher sein als der zweitgrößte. */
export const DOMINANT_AREA_MIN_LEAD_RATIO = 1.25;

export const CALENDAR_HEADER_HEIGHT_PX = 60;
/** Wie PLANNING_CALENDAR_FOOTER_CHROME_HEIGHT_PX (22 + 36) in planning-calendar-layout.ts. */
export const CALENDAR_FOOTER_HEIGHT_PX = 58;

export function calendarAvailableBodyHeightPx(
  scrollClientHeightPx: number,
  headerHeightPx: number = CALENDAR_HEADER_HEIGHT_PX
): number {
  return Math.max(
    0,
    scrollClientHeightPx -
      headerHeightPx -
      CALENDAR_FOOTER_HEIGHT_PX
  );
}

function clampAreaRowHeightPx(heightPx: number): number {
  return Math.max(AREA_ROW_MIN_HEIGHT_PX, heightPx);
}

export const AREA_ROW_VERTICAL_CHROME_PX =
  AREA_ROW_CELL_PADDING_Y_PX +
  AREA_ROW_HEADER_STRIP_PX +
  AREA_ROW_FOOTER_STRIP_PX;

export function shiftCardListItemHeightPx(
  cardHeightPx: number = SHIFT_CARD_TWO_LINE_HEIGHT_PX,
): number {
  return cardHeightPx + SHIFT_CARD_SHADOW_BLEED_PX;
}

export function areaCalendarShiftCardListItemHeightPx(
  cardHeightPx: number = AREA_CALENDAR_SHIFT_CARD_TWO_LINE_HEIGHT_PX,
): number {
  return shiftCardListItemHeightPx(cardHeightPx);
}

export function areaRowShiftStackHeightPx(shiftCount: number): number {
  if (shiftCount <= 0) return 0;
  return (
    shiftCount * areaCalendarShiftCardListItemHeightPx() +
    Math.max(0, shiftCount - 1) * SHIFT_CARD_LIST_GAP_PX
  );
}

export function areaRowRequiredHeightPx(maxLaneCount: number): number {
  if (maxLaneCount <= 0) {
    return AREA_ROW_EMPTY_HEIGHT_PX;
  }
  return (
    AREA_ROW_VERTICAL_CHROME_PX +
    areaRowShiftStackHeightPx(maxLaneCount) +
    SHIFT_CARD_LIST_BOTTOM_PADDING_PX +
    AREA_ROW_VISIBLE_SPACE_BELOW_LAST_SHIFT_PX +
    SHIFT_CARD_ROW_FIT_BUFFER_PX +
    AREA_ROW_LIST_FIT_SLACK_PX
  );
}

/** Mindesthöhe für Schicht-Bereiche bei knappem Viewport — eine Karte + Scroll. */
export function areaRowMinVisibleShiftHeightPx(): number {
  return areaRowRequiredHeightPx(1);
}

export function areaRowContentHeightPx(rowHeightPx: number): number {
  return Math.max(
    0,
    rowHeightPx -
      AREA_ROW_VERTICAL_CHROME_PX -
      AREA_ROW_VISIBLE_SPACE_BELOW_LAST_SHIFT_PX -
      SHIFT_CARD_ROW_FIT_BUFFER_PX,
  );
}

export function areaRowShiftStackFitsPx(
  laneCount: number,
  availableContentHeightPx: number,
): boolean {
  if (laneCount <= 0) return true;
  return (
    areaRowShiftStackHeightPx(laneCount) + SHIFT_CARD_LIST_BOTTOM_PADDING_PX <=
    availableContentHeightPx
  );
}

export type AreaRowLayout = {
  /** Zugewiesene Zeilenhöhe in px. */
  heightPx: number;
  /** Höhe für alle Schichten ohne Scrollen. */
  requiredPx: number;
  /** Verfügbare Höhe für die Schichtkarten-Liste (ohne Header/Footer/Padding). */
  contentHeightPx: number;
  /** @deprecated Immer false — Zeilenhöhen sind feste px-Werte. */
  flexGrow: boolean;
};

function buildAreaRowLayout(
  requiredPx: number,
  heightPx: number,
): AreaRowLayout {
  return {
    heightPx,
    requiredPx,
    contentHeightPx: areaRowContentHeightPx(heightPx),
    flexGrow: false,
  };
}

function isCollapsedAreaRow(
  areaId: string,
  layoutActiveAreaIds: ReadonlySet<string>,
): boolean {
  return !layoutActiveAreaIds.has(areaId);
}

/** Checkbox eingeklappt oder service-dormant (keine Servicezeit/Schichten ab heute, keine Schichten in Vergangenheit der Woche) — Zeile fix 68 px. */
function isAreaRowFixedAtMinHeight(
  areaId: string,
  layoutActiveAreaIds: ReadonlySet<string>,
  layoutMinHeightAreaIds: ReadonlySet<string>,
): boolean {
  return (
    isCollapsedAreaRow(areaId, layoutActiveAreaIds) ||
    layoutMinHeightAreaIds.has(areaId)
  );
}

function isShiftAreaRow(
  areaId: string,
  layoutActiveAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
): boolean {
  return (
    layoutActiveAreaIds.has(areaId) &&
    (maxShiftCountByAreaId.get(areaId) ?? 0) > 0
  );
}

function isEmptyExpandedAreaRow(
  areaId: string,
  layoutActiveAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
  layoutMinHeightAreaIds: ReadonlySet<string>,
): boolean {
  return (
    layoutActiveAreaIds.has(areaId) &&
    !layoutMinHeightAreaIds.has(areaId) &&
    (maxShiftCountByAreaId.get(areaId) ?? 0) === 0
  );
}

function listShiftAreaRows(
  areas: readonly { id: string }[],
  layoutActiveAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
): readonly { id: string }[] {
  return areas.filter((area) =>
    isShiftAreaRow(area.id, layoutActiveAreaIds, maxShiftCountByAreaId),
  );
}

function listEmptyExpandedAreaRows(
  areas: readonly { id: string }[],
  layoutActiveAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
  layoutMinHeightAreaIds: ReadonlySet<string>,
): readonly { id: string }[] {
  return areas.filter((area) =>
    isEmptyExpandedAreaRow(
      area.id,
      layoutActiveAreaIds,
      maxShiftCountByAreaId,
      layoutMinHeightAreaIds,
    ),
  );
}

function sumHeights(
  areas: readonly { id: string }[],
  heights: ReadonlyMap<string, number>,
): number {
  return areas.reduce((sum, area) => sum + (heights.get(area.id) ?? 0), 0);
}

function distributeTotalPxEvenlyAmongAreas(
  heights: Map<string, number>,
  recipients: readonly { id: string }[],
  totalPx: number,
): void {
  if (recipients.length === 0 || totalPx <= 0) return;

  let distributed = 0;
  recipients.forEach((area, index) => {
    const heightPx =
      index === recipients.length - 1
        ? totalPx - distributed
        : Math.floor(totalPx / recipients.length);
    heights.set(area.id, clampAreaRowHeightPx(heightPx));
    distributed += heightPx;
  });
}

function applyRemainderToLastArea(
  areas: readonly { id: string }[],
  heights: Map<string, number>,
  targetTotalPx: number,
  layoutActiveAreaIds: ReadonlySet<string>,
  layoutMinHeightAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId?: ReadonlyMap<string, number>,
  requiredByArea?: ReadonlyMap<string, number>,
): void {
  const currentTotalPx = sumHeights(areas, heights);
  const remainderPx = targetTotalPx - currentTotalPx;
  if (remainderPx === 0) return;

  const growableAreas = areas.filter((area) => {
    if (
      isAreaRowFixedAtMinHeight(
        area.id,
        layoutActiveAreaIds,
        layoutMinHeightAreaIds,
      )
    ) {
      return false;
    }
    if (
      maxShiftCountByAreaId &&
      isEmptyExpandedAreaRow(
        area.id,
        layoutActiveAreaIds,
        maxShiftCountByAreaId,
        layoutMinHeightAreaIds,
      )
    ) {
      return false;
    }
    return heights.has(area.id);
  });

  if (growableAreas.length === 0) return;

  const rankedGrowableAreas =
    requiredByArea && remainderPx > 0
      ? [...growableAreas].sort(
          (a, b) =>
            (requiredByArea.get(b.id) ?? AREA_ROW_MIN_HEIGHT_PX) -
            (requiredByArea.get(a.id) ?? AREA_ROW_MIN_HEIGHT_PX),
        )
      : [...growableAreas].reverse();

  for (const area of rankedGrowableAreas) {
    const current = heights.get(area.id);
    if (current === undefined) continue;
    heights.set(area.id, clampAreaRowHeightPx(current + remainderPx));
    return;
  }
}

function equalizeShiftAreasTowardTarget(
  heights: Map<string, number>,
  shiftAreas: readonly { id: string }[],
  targetHeightPx: number,
  slackPx: number,
): number {
  let remainingSlackPx = slackPx;

  while (remainingSlackPx > 0) {
    const undersized = shiftAreas.filter(
      (area) => (heights.get(area.id) ?? 0) < targetHeightPx,
    );
    if (undersized.length === 0) break;

    const totalRoomPx = undersized.reduce(
      (sum, area) =>
        sum + (targetHeightPx - (heights.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX)),
      0,
    );
    if (totalRoomPx <= 0) break;

    const grantPx = Math.min(remainingSlackPx, totalRoomPx);
    let distributedPx = 0;

    undersized.forEach((area, index) => {
      const currentPx = heights.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX;
      const roomPx = targetHeightPx - currentPx;
      const extraPx =
        index === undersized.length - 1
          ? grantPx - distributedPx
          : Math.floor((grantPx * roomPx) / totalRoomPx);
      const appliedPx = Math.min(extraPx, roomPx);
      heights.set(area.id, currentPx + appliedPx);
      distributedPx += appliedPx;
    });

    if (distributedPx <= 0) break;
    remainingSlackPx -= distributedPx;
  }

  return remainingSlackPx;
}

function computePhase1MinTotalPx(
  areas: readonly { id: string }[],
  layoutActiveAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
  requiredByArea: ReadonlyMap<string, number>,
  layoutMinHeightAreaIds: ReadonlySet<string>,
): number {
  return areas.reduce((sum, area) => {
    if (
      isAreaRowFixedAtMinHeight(
        area.id,
        layoutActiveAreaIds,
        layoutMinHeightAreaIds,
      )
    ) {
      return sum + AREA_ROW_MIN_HEIGHT_PX;
    }
    if (isShiftAreaRow(area.id, layoutActiveAreaIds, maxShiftCountByAreaId)) {
      return sum + (requiredByArea.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX);
    }
    return sum + AREA_ROW_MIN_HEIGHT_PX;
  }, 0);
}

function stealPxFromEmptyExpandedAreas(
  heights: Map<string, number>,
  emptyExpandedAreas: readonly { id: string }[],
  amountPx: number,
): number {
  if (amountPx <= 0 || emptyExpandedAreas.length === 0) return 0;

  let remainingPx = amountPx;
  let stolenPx = 0;

  while (remainingPx > 0) {
    const donors = emptyExpandedAreas.filter(
      (area) =>
        (heights.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX) > AREA_ROW_MIN_HEIGHT_PX,
    );
    if (donors.length === 0) break;

    let removedThisRoundPx = 0;
    for (const area of donors) {
      if (remainingPx <= 0) break;
      const currentPx = heights.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX;
      const removePx = Math.min(currentPx - AREA_ROW_MIN_HEIGHT_PX, remainingPx);
      if (removePx <= 0) continue;
      heights.set(area.id, currentPx - removePx);
      remainingPx -= removePx;
      removedThisRoundPx += removePx;
      stolenPx += removePx;
    }

    if (removedThisRoundPx <= 0) break;
  }

  return stolenPx;
}

function rebalanceEmptyExpandedAreas(
  areas: readonly { id: string }[],
  heights: Map<string, number>,
  emptyExpandedAreas: readonly { id: string }[],
  availableBodyHeightPx: number,
): void {
  if (emptyExpandedAreas.length <= 1) return;

  const nonEmptyTotalPx = areas
    .filter(
      (area) => !emptyExpandedAreas.some((emptyArea) => emptyArea.id === area.id)
    )
    .reduce((sum, area) => sum + (heights.get(area.id) ?? 0), 0);

  const emptyBudgetPx = availableBodyHeightPx - nonEmptyTotalPx;
  if (emptyBudgetPx <= emptyExpandedAreas.length * AREA_ROW_MIN_HEIGHT_PX) {
    return;
  }

  distributeTotalPxEvenlyAmongAreas(
    heights,
    emptyExpandedAreas,
    emptyBudgetPx,
  );
}

function ensureShiftAreasAtLeastAsTallAsEmptyExpanded(
  heights: Map<string, number>,
  shiftAreas: readonly { id: string }[],
  emptyExpandedAreas: readonly { id: string }[],
  requiredByArea: ReadonlyMap<string, number>,
): void {
  if (shiftAreas.length === 0 || emptyExpandedAreas.length === 0) return;

  let guard = 0;
  while (guard < shiftAreas.length * emptyExpandedAreas.length + 4) {
    guard += 1;

    const maxEmptyPx = Math.max(
      AREA_ROW_MIN_HEIGHT_PX,
      ...emptyExpandedAreas.map(
        (area) => heights.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX,
      ),
    );

    let adjusted = false;
    for (const area of shiftAreas) {
      const currentPx = heights.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX;
      const requiredPx = requiredByArea.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX;
      const targetPx =
        maxEmptyPx > AREA_ROW_MIN_HEIGHT_PX
          ? Math.max(requiredPx, maxEmptyPx + 1)
          : Math.max(requiredPx, maxEmptyPx);
      if (currentPx >= targetPx) continue;

      const deficitPx = targetPx - currentPx;
      const stolenPx = stealPxFromEmptyExpandedAreas(
        heights,
        emptyExpandedAreas,
        deficitPx,
      );
      if (stolenPx <= 0) return;

      heights.set(area.id, currentPx + stolenPx);
      adjusted = true;
      break;
    }

    if (!adjusted) return;
  }
}

function boostShiftAreasFromEmptySlack(
  areas: readonly { id: string }[],
  heights: Map<string, number>,
  layoutActiveAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
  requiredByArea: ReadonlyMap<string, number>,
  layoutMinHeightAreaIds: ReadonlySet<string>,
): void {
  const shiftAreas = listShiftAreaRows(
    areas,
    layoutActiveAreaIds,
    maxShiftCountByAreaId,
  );
  const emptyExpandedAreas = listEmptyExpandedAreaRows(
    areas,
    layoutActiveAreaIds,
    maxShiftCountByAreaId,
    layoutMinHeightAreaIds,
  );
  if (shiftAreas.length === 0 || emptyExpandedAreas.length === 0) return;

  const rankedShiftAreas = [...shiftAreas].sort(
    (a, b) =>
      (maxShiftCountByAreaId.get(b.id) ?? 0) -
      (maxShiftCountByAreaId.get(a.id) ?? 0),
  );

  for (const area of rankedShiftAreas) {
    const maxLaneCount = maxShiftCountByAreaId.get(area.id) ?? 0;
    if (maxLaneCount <= 0) continue;

    const requiredPx = requiredByArea.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX;
    let heightPx = heights.get(area.id) ?? requiredPx;

    while (
      !areaRowShiftStackFitsPx(
        maxLaneCount,
        areaRowContentHeightPx(heightPx),
      )
    ) {
      const targetPx = Math.max(requiredPx, heightPx + 1);
      const deficitPx = targetPx - heightPx;
      const stolenPx = stealPxFromEmptyExpandedAreas(
        heights,
        emptyExpandedAreas,
        deficitPx,
      );
      if (stolenPx <= 0) break;
      heightPx += stolenPx;
      heights.set(area.id, heightPx);
    }
  }
}

function applyPhase1Layout(
  areas: readonly { id: string }[],
  layoutActiveAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
  requiredByArea: ReadonlyMap<string, number>,
  availableBodyHeightPx: number,
  heights: Map<string, number>,
  layoutMinHeightAreaIds: ReadonlySet<string>,
): void {
  const shiftAreas = listShiftAreaRows(
    areas,
    layoutActiveAreaIds,
    maxShiftCountByAreaId,
  );
  const emptyExpandedAreas = listEmptyExpandedAreaRows(
    areas,
    layoutActiveAreaIds,
    maxShiftCountByAreaId,
    layoutMinHeightAreaIds,
  );
  const expandedAreas = areas.filter(
    (area) =>
      !isAreaRowFixedAtMinHeight(
        area.id,
        layoutActiveAreaIds,
        layoutMinHeightAreaIds,
      ),
  );

  for (const area of areas) {
    if (
      isAreaRowFixedAtMinHeight(
        area.id,
        layoutActiveAreaIds,
        layoutMinHeightAreaIds,
      )
    ) {
      heights.set(area.id, AREA_ROW_MIN_HEIGHT_PX);
      continue;
    }

    if (isShiftAreaRow(area.id, layoutActiveAreaIds, maxShiftCountByAreaId)) {
      heights.set(
        area.id,
        requiredByArea.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX,
      );
      continue;
    }

    heights.set(area.id, AREA_ROW_MIN_HEIGHT_PX);
  }

  if (shiftAreas.length === 0 && expandedAreas.length > 0) {
    const fixedMinTotalPx = areas.reduce(
      (sum, area) =>
        isAreaRowFixedAtMinHeight(
          area.id,
          layoutActiveAreaIds,
          layoutMinHeightAreaIds,
        )
          ? sum + AREA_ROW_MIN_HEIGHT_PX
          : sum,
      0,
    );
    distributeTotalPxEvenlyAmongAreas(
      heights,
      expandedAreas,
      availableBodyHeightPx - fixedMinTotalPx,
    );
    return;
  }

  const fixedMinTotalPx = areas.reduce(
    (sum, area) =>
      isAreaRowFixedAtMinHeight(
        area.id,
        layoutActiveAreaIds,
        layoutMinHeightAreaIds,
      )
        ? sum + AREA_ROW_MIN_HEIGHT_PX
        : sum,
    0,
  );
  const shiftTotalPx = shiftAreas.reduce(
    (sum, area) => sum + (heights.get(area.id) ?? 0),
    0,
  );

  if (emptyExpandedAreas.length > 0) {
    distributeTotalPxEvenlyAmongAreas(
      heights,
      emptyExpandedAreas,
      availableBodyHeightPx - fixedMinTotalPx - shiftTotalPx,
    );
  }

  ensureShiftAreasAtLeastAsTallAsEmptyExpanded(
    heights,
    shiftAreas,
    emptyExpandedAreas,
    requiredByArea,
  );
  rebalanceEmptyExpandedAreas(
    areas,
    heights,
    emptyExpandedAreas,
    availableBodyHeightPx,
  );
  ensureShiftAreasAtLeastAsTallAsEmptyExpanded(
    heights,
    shiftAreas,
    emptyExpandedAreas,
    requiredByArea,
  );

  let slackPx = availableBodyHeightPx - sumHeights(areas, heights);

  if (shiftAreas.length > 0 && slackPx > 0) {
    const maxShiftRequiredPx = Math.max(
      ...shiftAreas.map(
        (area) => requiredByArea.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX,
      ),
    );
    slackPx = equalizeShiftAreasTowardTarget(
      heights,
      shiftAreas,
      maxShiftRequiredPx,
      slackPx,
    );
    if (slackPx > 0) {
      const leaderArea = shiftAreas.reduce((best, area) => {
        const requiredPx = requiredByArea.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX;
        const bestRequiredPx =
          requiredByArea.get(best.id) ?? AREA_ROW_MIN_HEIGHT_PX;
        return requiredPx > bestRequiredPx ? area : best;
      });
      heights.set(
        leaderArea.id,
        (heights.get(leaderArea.id) ?? AREA_ROW_MIN_HEIGHT_PX) + slackPx,
      );
      slackPx = 0;
    }
  }

  if (slackPx !== 0) {
    applyRemainderToLastArea(
      areas,
      heights,
      availableBodyHeightPx,
      layoutActiveAreaIds,
      layoutMinHeightAreaIds,
      maxShiftCountByAreaId,
      requiredByArea,
    );
  }

  boostShiftAreasFromEmptySlack(
    areas,
    heights,
    layoutActiveAreaIds,
    maxShiftCountByAreaId,
    requiredByArea,
    layoutMinHeightAreaIds,
  );

  const finalSlackPx = availableBodyHeightPx - sumHeights(areas, heights);
  if (finalSlackPx !== 0) {
    applyRemainderToLastArea(
      areas,
      heights,
      availableBodyHeightPx,
      layoutActiveAreaIds,
      layoutMinHeightAreaIds,
      maxShiftCountByAreaId,
      requiredByArea,
    );
  }

  rebalanceEmptyExpandedAreas(
    areas,
    heights,
    emptyExpandedAreas,
    availableBodyHeightPx,
  );
  ensureShiftAreasAtLeastAsTallAsEmptyExpanded(
    heights,
    shiftAreas,
    emptyExpandedAreas,
    requiredByArea,
  );
}

function distributePhase2ShiftAreaHeights(
  heights: Map<string, number>,
  shiftAreas: readonly { id: string }[],
  requiredByArea: ReadonlyMap<string, number>,
  shiftBudgetPx: number,
): void {
  if (shiftAreas.length === 0 || shiftBudgetPx <= 0) return;

  const weights = shiftAreas.map((area) => ({
    id: area.id,
    weight: requiredByArea.get(area.id) ?? AREA_ROW_MIN_HEIGHT_PX,
  }));
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    distributeTotalPxEvenlyAmongAreas(heights, shiftAreas, shiftBudgetPx);
    return;
  }

  const provisionalPx = weights.map((entry) =>
    Math.floor((shiftBudgetPx * entry.weight) / totalWeight),
  );
  let assignedPx = provisionalPx.reduce((sum, heightPx) => sum + heightPx, 0);
  const remainderPx = shiftBudgetPx - assignedPx;
  if (remainderPx > 0) {
    const maxWeightIndex = weights.reduce(
      (bestIndex, entry, index) =>
        entry.weight > weights[bestIndex].weight ? index : bestIndex,
      0,
    );
    provisionalPx[maxWeightIndex] += remainderPx;
    assignedPx += remainderPx;
  }

  for (let index = 0; index < shiftAreas.length; index += 1) {
    if (provisionalPx[index] < AREA_ROW_MIN_HEIGHT_PX) {
      const deficitPx = AREA_ROW_MIN_HEIGHT_PX - provisionalPx[index];
      provisionalPx[index] = AREA_ROW_MIN_HEIGHT_PX;
      let remainingDeficitPx = deficitPx;
      const donorIndices = weights
        .map((entry, donorIndex) => ({ donorIndex, weight: entry.weight }))
        .filter(({ donorIndex }) => donorIndex !== index)
        .sort((a, b) => b.weight - a.weight);

      for (const { donorIndex } of donorIndices) {
        if (remainingDeficitPx <= 0) break;
        const donorHeightPx = provisionalPx[donorIndex];
        const removablePx = donorHeightPx - AREA_ROW_MIN_HEIGHT_PX;
        if (removablePx <= 0) continue;
        const stealPx = Math.min(removablePx, remainingDeficitPx);
        provisionalPx[donorIndex] -= stealPx;
        remainingDeficitPx -= stealPx;
      }
    }
  }

  shiftAreas.forEach((area, index) => {
    heights.set(area.id, provisionalPx[index]);
  });
}

function applyPhase2Layout(
  areas: readonly { id: string }[],
  layoutActiveAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
  requiredByArea: ReadonlyMap<string, number>,
  availableBodyHeightPx: number,
  heights: Map<string, number>,
  layoutMinHeightAreaIds: ReadonlySet<string>,
): void {
  const shiftAreas = listShiftAreaRows(
    areas,
    layoutActiveAreaIds,
    maxShiftCountByAreaId,
  );
  const emptyExpandedAreas = listEmptyExpandedAreaRows(
    areas,
    layoutActiveAreaIds,
    maxShiftCountByAreaId,
    layoutMinHeightAreaIds,
  );
  const expandedAreas = areas.filter(
    (area) =>
      !isAreaRowFixedAtMinHeight(
        area.id,
        layoutActiveAreaIds,
        layoutMinHeightAreaIds,
      ),
  );

  if (shiftAreas.length === 0 && expandedAreas.length > 0) {
    const fixedMinTotalPx = areas.reduce(
      (sum, area) =>
        isAreaRowFixedAtMinHeight(
          area.id,
          layoutActiveAreaIds,
          layoutMinHeightAreaIds,
        )
          ? sum + AREA_ROW_MIN_HEIGHT_PX
          : sum,
      0,
    );
    distributeTotalPxEvenlyAmongAreas(
      heights,
      expandedAreas,
      Math.max(
        expandedAreas.length * AREA_ROW_MIN_HEIGHT_PX,
        availableBodyHeightPx - fixedMinTotalPx,
      ),
    );
    applyRemainderToLastArea(
      areas,
      heights,
      availableBodyHeightPx,
      layoutActiveAreaIds,
      layoutMinHeightAreaIds,
      maxShiftCountByAreaId,
      requiredByArea,
    );
    return;
  }

  for (const area of areas) {
    if (
      isAreaRowFixedAtMinHeight(
        area.id,
        layoutActiveAreaIds,
        layoutMinHeightAreaIds,
      )
    ) {
      heights.set(area.id, AREA_ROW_MIN_HEIGHT_PX);
      continue;
    }

    if (
      isEmptyExpandedAreaRow(
        area.id,
        layoutActiveAreaIds,
        maxShiftCountByAreaId,
        layoutMinHeightAreaIds,
      )
    ) {
      heights.set(area.id, AREA_ROW_MIN_HEIGHT_PX);
      continue;
    }
  }

  const fixedTotalPx = sumHeights(areas, heights);
  const shiftBudgetPx = availableBodyHeightPx - fixedTotalPx;

  if (shiftAreas.length > 0) {
    distributePhase2ShiftAreaHeights(
      heights,
      shiftAreas,
      requiredByArea,
      shiftBudgetPx,
    );
  } else if (emptyExpandedAreas.length > 0) {
    distributeTotalPxEvenlyAmongAreas(
      heights,
      emptyExpandedAreas,
      Math.max(
        emptyExpandedAreas.length * AREA_ROW_MIN_HEIGHT_PX,
        shiftBudgetPx,
      ),
    );
  }

  applyRemainderToLastArea(
    areas,
    heights,
    availableBodyHeightPx,
    layoutActiveAreaIds,
    layoutMinHeightAreaIds,
    maxShiftCountByAreaId,
    requiredByArea,
  );
}

/** Bereich mit deutlich mehr Schichten — für Legacy-Hilfsfunktionen. */
export function findDominantAreaId(
  activeAreas: readonly { id: string }[],
  requiredByArea: ReadonlyMap<string, number>,
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

/**
 * Verteilt Bereichszeilen gemäß specs/007-area-row-heights-specification.md.
 */
export function computeAreaRowLayouts(
  areas: readonly { id: string }[],
  layoutActiveAreaIds: ReadonlySet<string>,
  maxShiftCountByAreaId: ReadonlyMap<string, number>,
  availableBodyHeightPx: number,
  layoutMinHeightAreaIds: ReadonlySet<string> = new Set(),
): Map<string, AreaRowLayout> {
  const result = new Map<string, AreaRowLayout>();
  const requiredByArea = new Map<string, number>();

  for (const area of areas) {
    if (!layoutActiveAreaIds.has(area.id)) {
      requiredByArea.set(area.id, AREA_ROW_EMPTY_HEIGHT_PX);
      continue;
    }
    const maxShifts = maxShiftCountByAreaId.get(area.id) ?? 0;
    requiredByArea.set(area.id, areaRowRequiredHeightPx(maxShifts));
  }

  const heights = new Map<string, number>();

  if (availableBodyHeightPx <= 0) {
    for (const area of areas) {
      const requiredPx = requiredByArea.get(area.id) ?? AREA_ROW_EMPTY_HEIGHT_PX;
      if (
        isAreaRowFixedAtMinHeight(
          area.id,
          layoutActiveAreaIds,
          layoutMinHeightAreaIds,
        )
      ) {
        heights.set(area.id, AREA_ROW_MIN_HEIGHT_PX);
      } else if (
        isShiftAreaRow(area.id, layoutActiveAreaIds, maxShiftCountByAreaId)
      ) {
        heights.set(area.id, requiredPx);
      } else {
        heights.set(area.id, AREA_ROW_MIN_HEIGHT_PX);
      }
    }
  } else {
    const phase1MinTotalPx = computePhase1MinTotalPx(
      areas,
      layoutActiveAreaIds,
      maxShiftCountByAreaId,
      requiredByArea,
      layoutMinHeightAreaIds,
    );

    if (phase1MinTotalPx > availableBodyHeightPx) {
      applyPhase2Layout(
        areas,
        layoutActiveAreaIds,
        maxShiftCountByAreaId,
        requiredByArea,
        availableBodyHeightPx,
        heights,
        layoutMinHeightAreaIds,
      );
    } else {
      applyPhase1Layout(
        areas,
        layoutActiveAreaIds,
        maxShiftCountByAreaId,
        requiredByArea,
        availableBodyHeightPx,
        heights,
        layoutMinHeightAreaIds,
      );
    }
  }

  for (const area of areas) {
    const requiredPx = requiredByArea.get(area.id) ?? AREA_ROW_EMPTY_HEIGHT_PX;
    const heightPx = clampAreaRowHeightPx(
      heights.get(area.id) ?? requiredPx,
    );
    result.set(area.id, buildAreaRowLayout(requiredPx, heightPx));
  }

  return result;
}

export function buildAreaRowGridTrack(layout: AreaRowLayout): string {
  return `${clampAreaRowHeightPx(layout.heightPx)}px`;
}

export function cellShiftListNeedsScroll(
  laneCount: number,
  rowLayout: AreaRowLayout,
): boolean {
  if (laneCount === 0) return false;
  return !areaRowShiftStackFitsPx(laneCount, rowLayout.contentHeightPx);
}

export function cellShiftListShouldEnableScroll(
  laneCount: number,
  rowLayout: AreaRowLayout,
): boolean {
  return cellShiftListNeedsScroll(laneCount, rowLayout);
}

export function totalAssignedRowHeightPx(
  areas: readonly { id: string }[],
  layouts: ReadonlyMap<string, AreaRowLayout>,
): number {
  return areas.reduce(
    (sum, area) => sum + (layouts.get(area.id)?.heightPx ?? 0),
    0,
  );
}
