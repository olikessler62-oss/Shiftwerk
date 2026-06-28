"use client";

import type { EmployeeWeeklyHoursDisplay } from "@/lib/employee-weekly-hours-display";
import {
  formatPlanningHoursRatio,
  planningHoursUnitLabel,
} from "@/lib/planning-utils";
import { cn } from "@/lib/cn";

type LinesProps = {
  lines: readonly string[];
  className?: string;
  lineClassName?: string | ((line: string, index: number) => string);
  display?: never;
  locale?: never;
  totalLabel?: never;
  sumRowClassName?: never;
};

type TableProps = {
  display: EmployeeWeeklyHoursDisplay;
  locale: string;
  totalLabel: string;
  className?: string;
  sumRowClassName?: string;
  lines?: never;
  lineClassName?: never;
};

type Props = LinesProps | TableProps;

function formatHoursAmount(hours: number, locale: string): string {
  const tooltipLocale = locale.startsWith("de") ? "de" : "en";
  return `${hours} ${planningHoursUnitLabel(tooltipLocale)}`;
}

export function EmployeeWeeklyHoursTable({
  display,
  locale,
  totalLabel,
  className,
  sumRowClassName,
}: TableProps) {
  if (display.lines.length === 0) return null;

  const tooltipLocale = locale.startsWith("de") ? "de" : "en";

  return (
    <table className={cn("w-full border-collapse", className)}>
      <tbody>
        {display.lines.map((line) => (
          <tr key={line.locationId}>
            <td className="min-w-0 pr-4 text-left align-top">{line.locationName}</td>
            <td className="whitespace-nowrap text-right align-top tabular-nums">
              {formatHoursAmount(line.assignedHours, tooltipLocale)}
            </td>
          </tr>
        ))}
        {display.showTotalLine ? (
          <tr>
            <td
              className={cn(
                "pt-1 pr-4 text-left align-top font-semibold",
                sumRowClassName
              )}
            >
              {totalLabel}
            </td>
            <td
              className={cn(
                "pt-1 whitespace-nowrap text-right align-top font-semibold tabular-nums",
                sumRowClassName
              )}
            >
              {formatPlanningHoursRatio(
                display.totalHours,
                display.targetHours,
                tooltipLocale
              )}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export function EmployeeWeeklyHoursLines(props: Props) {
  if ("display" in props && props.display) {
    return <EmployeeWeeklyHoursTable {...props} />;
  }

  const { lines, className, lineClassName } = props;
  if (lines.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {lines.map((line, index) => (
        <span
          key={`${line}:${index}`}
          className={cn(
            "tabular-nums leading-tight",
            typeof lineClassName === "function"
              ? lineClassName(line, index)
              : lineClassName
          )}
        >
          {line}
        </span>
      ))}
    </div>
  );
}
