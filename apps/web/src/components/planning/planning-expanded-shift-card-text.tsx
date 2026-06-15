import type { ReactNode, Ref } from "react";

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

type Props = {
  templateName: string | null;
  timeLabel: string;
  jobsLine: string | null;
  compact: boolean;
};

export function PlanningExpandedShiftCardText({
  templateName,
  timeLabel,
  jobsLine,
  compact,
}: Props) {
  const templateFontPx = compact
    ? PLANNING_SHIFT_CARD_TEMPLATE_FONT_COMPACT_PX
    : PLANNING_SHIFT_CARD_TEMPLATE_FONT_TWO_LINE_PX;
  const timeFontPx = templateName
    ? PLANNING_SHIFT_CARD_TIME_FONT_PX
    : compact
      ? PLANNING_SHIFT_CARD_TIME_FONT_PX
      : PLANNING_SHIFT_CARD_TIME_ONLY_FONT_PX;

  return (
    <div className="flex w-full min-w-0 flex-col items-start justify-center gap-px text-left leading-none">
      {templateName ? (
        <div
          className="w-full min-w-0 truncate font-bold leading-none"
          style={{ fontSize: templateFontPx }}
        >
          {templateName}
        </div>
      ) : null}
      <div
        className="w-full min-w-0 truncate font-normal tabular-nums leading-none"
        style={{ fontSize: timeFontPx }}
      >
        {timeLabel}
      </div>
      {jobsLine ? (
        <div
          className="w-full min-w-0 truncate font-normal leading-none"
          style={{ fontSize: PLANNING_SHIFT_CARD_JOB_FONT_PX }}
        >
          {jobsLine}
        </div>
      ) : null}
    </div>
  );
}

/** Textbereich rechts neben dem Mitarbeiterfarb-Div (Schichtplan). */
export function PlanningShiftCardTextArea({
  children,
  backgroundImage,
  contentRef,
}: {
  children: ReactNode;
  backgroundImage?: string;
  contentRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={contentRef}
      className="relative flex min-w-0 flex-1 flex-col items-start justify-center overflow-hidden bg-white"
      style={{
        paddingLeft: PLANNING_SHIFT_CARD_TEXT_PADDING_LEFT_PX,
        backgroundImage,
      }}
    >
      {children}
    </div>
  );
}
