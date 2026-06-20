/** Uhrzeit in der Schichtkarte (kompakt und mehrzeilig). */
export const PLANNING_SHIFT_CARD_TIME_FONT_PX = 9;
/** Nur-Uhrzeit ohne Vorlage, nicht kompakt. */
export const PLANNING_SHIFT_CARD_TIME_ONLY_FONT_PX = 10;
/** Schichtvorlage kompakt — größer als die Uhrzeit. */
export const PLANNING_SHIFT_CARD_TEMPLATE_FONT_COMPACT_PX = 11;
/** Schichtvorlage mehrzeilig — leicht reduziert für Job-Zeile. */
export const PLANNING_SHIFT_CARD_TEMPLATE_FONT_TWO_LINE_PX = 11;
export const PLANNING_SHIFT_CARD_JOB_FONT_PX = 9;
/** Abstand Textblock links neben dem Mitarbeiterfarb-Div. */
export const PLANNING_SHIFT_CARD_TEXT_PADDING_LEFT_PX = 3;

const INLINE_STATUS_GAP_PX = 4;
/** Abstand des Status-Texts zum rechten Kartenrand. */
export const DASHBOARD_SHIFT_CARD_INLINE_STATUS_RIGHT_PADDING_PX = 5;

let measureCanvas: CanvasRenderingContext2D | null = null;

function measureCanvasContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCanvas) {
    const canvas = document.createElement("canvas");
    measureCanvas = canvas.getContext("2d");
  }
  return measureCanvas;
}

export function measureDashboardShiftCardLineWidthPx(
  text: string,
  fontSizePx: number,
  fontWeight: "normal" | "bold" = "normal"
): number {
  const context = measureCanvasContext();
  if (context) {
    context.font = `${fontWeight === "bold" ? "700" : "400"} ${fontSizePx}px ui-sans-serif, system-ui, sans-serif`;
    return Math.ceil(context.measureText(text).width);
  }

  const weightFactor = fontWeight === "bold" ? 0.62 : 0.56;
  return Math.ceil(text.length * fontSizePx * weightFactor);
}

export function resolveDashboardShiftCardFirstLineTypography(
  templateName: string | null,
  compact: boolean
): { fontSizePx: number; fontWeight: "normal" | "bold" } {
  if (templateName) {
    return {
      fontSizePx: compact
        ? PLANNING_SHIFT_CARD_TEMPLATE_FONT_COMPACT_PX
        : PLANNING_SHIFT_CARD_TEMPLATE_FONT_TWO_LINE_PX,
      fontWeight: "bold",
    };
  }

  return {
    fontSizePx: compact
      ? PLANNING_SHIFT_CARD_TEMPLATE_FONT_COMPACT_PX
      : PLANNING_SHIFT_CARD_TEMPLATE_FONT_TWO_LINE_PX,
    fontWeight: "bold",
  };
}

export function resolveDashboardShiftCardInlineStatusVisible(options: {
  contentWidthPx: number;
  templateName: string | null;
  timeLabel: string;
  statusLabel: string;
  compact: boolean;
  contentOverflows?: boolean;
}): boolean {
  const {
    contentWidthPx,
    templateName,
    timeLabel,
    statusLabel,
    compact,
    contentOverflows = false,
  } = options;

  if (contentOverflows || contentWidthPx <= 0 || !statusLabel.trim()) {
    return false;
  }

  const firstLineText = templateName ?? timeLabel;
  const { fontSizePx, fontWeight } = resolveDashboardShiftCardFirstLineTypography(
    templateName,
    compact
  );
  const firstLineWidthPx = measureDashboardShiftCardLineWidthPx(
    firstLineText,
    fontSizePx,
    fontWeight
  );
  const statusWidthPx = measureDashboardShiftCardLineWidthPx(
    statusLabel,
    fontSizePx
  );
  const availableWidthPx =
    contentWidthPx -
    PLANNING_SHIFT_CARD_TEXT_PADDING_LEFT_PX -
    DASHBOARD_SHIFT_CARD_INLINE_STATUS_RIGHT_PADDING_PX;

  return (
    firstLineWidthPx + INLINE_STATUS_GAP_PX + statusWidthPx <= availableWidthPx
  );
}
