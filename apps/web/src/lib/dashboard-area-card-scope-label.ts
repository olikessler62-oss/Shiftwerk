import { parseISODate } from "@/lib/dates";
import { formatDayHeader } from "@/lib/planning-utils";

export function formatDashboardAreaCardDayDate(
  dateISO: string,
  intlLocale: string
): string {
  const { weekday } = formatDayHeader(dateISO, intlLocale, "short");
  const date = parseISODate(dateISO);
  const month = new Intl.DateTimeFormat(intlLocale, { month: "short" })
    .format(date)
    .replace(/\.$/, "")
    .slice(0, 3);
  return `${weekday} ${date.getDate()}. ${month}`;
}

export function formatDashboardAreaCardWeekRange(
  weekStartISO: string,
  intlLocale: string
): string {
  const start = parseISODate(weekStartISO);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatPart = (date: Date, spacedAfterDot: boolean) => {
    const month = new Intl.DateTimeFormat(intlLocale, { month: "short" })
      .format(date)
      .replace(/\.$/, "")
      .slice(0, 3);
    return spacedAfterDot
      ? `${date.getDate()}. ${month}`
      : `${date.getDate()}.${month}`;
  };
  return `${formatPart(start, true)} - ${formatPart(end, false)}`;
}

export type DashboardAreaCardDetailScope = "day" | "week";

export function resolveDashboardAreaCardScopeDateLabel(
  areaScope: DashboardAreaCardDetailScope,
  dayDateISO: string,
  weekStartISO: string,
  intlLocale: string
): string {
  if (areaScope === "day") {
    return formatDashboardAreaCardDayDate(dayDateISO, intlLocale);
  }
  return formatDashboardAreaCardWeekRange(weekStartISO, intlLocale);
}
