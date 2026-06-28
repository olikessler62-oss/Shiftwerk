import type { ReactNode, Ref } from "react";
import {
  PLANNING_SHIFT_CARD_JOB_FONT_PX,
  PLANNING_SHIFT_CARD_TEMPLATE_FONT_COMPACT_PX,
  PLANNING_SHIFT_CARD_TEMPLATE_FONT_TWO_LINE_PX,
  PLANNING_SHIFT_CARD_TEXT_PADDING_LEFT_PX,
  PLANNING_SHIFT_CARD_TIME_FONT_PX,
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

const SHIFT_CARD_TRUNCATE_CLASS =
  "min-w-[1ch] max-w-full truncate overflow-hidden text-ellipsis";

type Props = {
  employeeName: string;
  templateName: string | null;
  timeLabel: string;
  jobsLine: string | null;
  compact: boolean;
  inlineStatusLabel?: string;
};

export function DashboardExpandedShiftCardText({
  employeeName,
  templateName,
  timeLabel,
  jobsLine,
  compact,
  inlineStatusLabel,
}: Props) {
  const nameFontPx = compact
    ? PLANNING_SHIFT_CARD_TEMPLATE_FONT_COMPACT_PX
    : PLANNING_SHIFT_CARD_TEMPLATE_FONT_TWO_LINE_PX;
  const secondaryFontPx = PLANNING_SHIFT_CARD_TIME_FONT_PX;
  const hasTemplate = Boolean(templateName?.trim());

  return (
    <div className="relative w-full min-w-0">
      <div className="flex w-full min-w-0 flex-col items-start justify-center gap-px text-left leading-none">
        <div
          className={`w-full font-bold leading-none ${SHIFT_CARD_TRUNCATE_CLASS}`}
          style={{ fontSize: nameFontPx }}
        >
          {employeeName}
        </div>
        <div
          className={`w-full tabular-nums leading-none ${SHIFT_CARD_TRUNCATE_CLASS}`}
          style={{ fontSize: secondaryFontPx }}
        >
          {hasTemplate ? (
            <>
              <span className="font-bold">{templateName}</span>
              <span className="font-normal"> {timeLabel}</span>
            </>
          ) : (
            <span className="font-bold">{timeLabel}</span>
          )}
        </div>
        {jobsLine && !compact ? (
          <div
            className={`w-full font-normal leading-none ${SHIFT_CARD_TRUNCATE_CLASS}`}
            style={{ fontSize: PLANNING_SHIFT_CARD_JOB_FONT_PX }}
          >
            {jobsLine}
          </div>
        ) : null}
        {inlineStatusLabel ? (
          <div
            className={`w-full font-semibold leading-none text-neutral-600 ${SHIFT_CARD_TRUNCATE_CLASS}`}
            style={{ fontSize: PLANNING_SHIFT_CARD_JOB_FONT_PX }}
          >
            {inlineStatusLabel}
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
