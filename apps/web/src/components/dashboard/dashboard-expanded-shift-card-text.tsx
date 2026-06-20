import type { ReactNode, Ref } from "react";
import {
  PLANNING_SHIFT_CARD_JOB_FONT_PX,
  PLANNING_SHIFT_CARD_TEMPLATE_FONT_COMPACT_PX,
  PLANNING_SHIFT_CARD_TEMPLATE_FONT_TWO_LINE_PX,
  PLANNING_SHIFT_CARD_TEXT_PADDING_LEFT_PX,
  PLANNING_SHIFT_CARD_TIME_FONT_PX,
  PLANNING_SHIFT_CARD_TIME_ONLY_FONT_PX,
} from "@/lib/dashboard-shift-card-inline-status";

/** Uhrzeit in der Schichtkarte (kompakt und mehrzeilig). */
export {
  PLANNING_SHIFT_CARD_JOB_FONT_PX,
  PLANNING_SHIFT_CARD_TEMPLATE_FONT_COMPACT_PX,
  PLANNING_SHIFT_CARD_TEMPLATE_FONT_TWO_LINE_PX,
  PLANNING_SHIFT_CARD_TEXT_PADDING_LEFT_PX,
  PLANNING_SHIFT_CARD_TIME_FONT_PX,
  PLANNING_SHIFT_CARD_TIME_ONLY_FONT_PX,
} from "@/lib/dashboard-shift-card-inline-status";

type Props = {
  templateName: string | null;
  timeLabel: string;
  jobsLine: string | null;
  compact: boolean;
};

export function DashboardExpandedShiftCardText({
  templateName,
  timeLabel,
  jobsLine,
  compact,
}: Props) {
  const templateFontPx = compact
    ? PLANNING_SHIFT_CARD_TEMPLATE_FONT_COMPACT_PX
    : PLANNING_SHIFT_CARD_TEMPLATE_FONT_TWO_LINE_PX;
  const timeIsPrimary = !templateName;
  const timeFontPx = timeIsPrimary
    ? templateFontPx
    : PLANNING_SHIFT_CARD_TIME_FONT_PX;

  return (
    <div className="relative w-full min-w-0">
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
          className={`w-full min-w-0 truncate tabular-nums leading-none ${
            timeIsPrimary ? "font-bold" : "font-normal"
          }`}
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
    </div>
  );
}

/** Textbereich rechts neben dem Mitarbeiterfarb-Div (Schichtplan). */
export function DashboardShiftCardTextArea({
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
