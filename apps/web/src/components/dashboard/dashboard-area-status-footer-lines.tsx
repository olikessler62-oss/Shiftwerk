"use client";

import { Fragment } from "react";
import { cn } from "@/lib/cn";
import type { useTranslations } from "@/i18n/locale-provider";
import {
  dashboardAreaStatusFooterNumberClass,
  groupDashboardAreaStatusFooterLinesForTwoColumnRows,
  type DashboardAreaStatusFooterLine,
  type DashboardAreaStatusFooterLineId,
} from "@/lib/dashboard-area-status-footer-lines";

const STATUS_FOOTER_COUNT_BASE_CLASS =
  "font-mono text-sm font-bold tabular-nums leading-none";
const STATUS_FOOTER_LABEL_CLASS =
  "text-xs font-medium leading-none text-foreground/70";
const STATUS_FOOTER_ROW_BASE_CLASS = "flex items-baseline gap-1";

function statusFooterRowClass(
  layout: "stack" | "two-column",
  clickable: boolean
): string {
  return cn(
    STATUS_FOOTER_ROW_BASE_CLASS,
    layout === "two-column" && "justify-end text-right",
    clickable &&
      "cursor-pointer rounded-sm hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
    clickable && layout === "stack" && "text-left"
  );
}

type Props = {
  lines: readonly DashboardAreaStatusFooterLine[];
  t: ReturnType<typeof useTranslations>;
  onLineClick?: (id: DashboardAreaStatusFooterLineId) => void;
  className?: string;
  /** Bereichskarten-Header: zwei Stati pro Zeile (max. 4 Zeilen). */
  layout?: "stack" | "two-column";
};

function StatusFooterLineItem({
  id,
  count,
  t,
  onLineClick,
  layout,
}: {
  id: DashboardAreaStatusFooterLineId;
  count: number;
  t: ReturnType<typeof useTranslations>;
  onLineClick?: (id: DashboardAreaStatusFooterLineId) => void;
  layout: "stack" | "two-column";
}) {
  const content = (
    <>
      <span
        className={cn(
          STATUS_FOOTER_COUNT_BASE_CLASS,
          dashboardAreaStatusFooterNumberClass(id)
        )}
      >
        {count}
      </span>
      <span className={STATUS_FOOTER_LABEL_CLASS}>
        {t(`dashboard.dayCardFooterLine.${id}`)}
      </span>
    </>
  );

  if (onLineClick) {
    return (
      <button
        type="button"
        className={statusFooterRowClass(layout, true)}
        onClick={() => onLineClick(id)}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={statusFooterRowClass(layout, false)}>{content}</div>
  );
}

const STATUS_FOOTER_TWO_COLUMN_ROW_CLASS =
  "flex min-w-0 items-baseline justify-end gap-1.5 sm:gap-2";
const STATUS_FOOTER_TWO_COLUMN_PIPE_CLASS =
  "shrink-0 font-normal text-muted/60";

export function DashboardAreaStatusFooterLines({
  lines,
  t,
  onLineClick,
  className,
  layout = "stack",
}: Props) {
  if (lines.length === 0) return null;

  if (layout === "two-column") {
    const rows = groupDashboardAreaStatusFooterLinesForTwoColumnRows(lines);

    return (
      <div
        className={cn(
          "ml-auto flex min-w-0 max-w-full flex-col items-end gap-y-1",
          className
        )}
      >
        {rows.map((rowLines, rowIndex) => (
          <div key={rowIndex} className={STATUS_FOOTER_TWO_COLUMN_ROW_CLASS}>
            {rowLines.map((line, lineIndex) => (
              <Fragment key={line.id}>
                {lineIndex > 0 ? (
                  <span className={STATUS_FOOTER_TWO_COLUMN_PIPE_CLASS} aria-hidden>
                    |
                  </span>
                ) : null}
                <StatusFooterLineItem
                  id={line.id}
                  count={line.count}
                  t={t}
                  onLineClick={onLineClick}
                  layout={layout}
                />
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      {lines.map(({ id, count }) => (
        <StatusFooterLineItem
          key={id}
          id={id}
          count={count}
          t={t}
          onLineClick={onLineClick}
          layout={layout}
        />
      ))}
    </div>
  );
}

export const DASHBOARD_AREA_STATUS_FOOTER_COLUMN_CLASS =
  "flex w-full min-h-0 max-h-full shrink-0 flex-col items-stretch justify-start gap-0 self-stretch overflow-y-auto py-0.5 md:w-max";

export const DASHBOARD_AREA_STATUS_FOOTER_TWO_COLUMN_CLASS =
  "flex w-full min-h-0 max-h-full shrink-0 flex-col items-end self-stretch overflow-y-auto py-0.5 md:w-max";

/** Mindesthöhe für bis zu 8 Stati in 4 Zweispalten-Zeilen. */
export const DASHBOARD_AREA_CARD_HEADER_STATUS_TWO_COLUMN_MIN_HEIGHT_CLASS =
  "md:min-h-[4.5rem]";
