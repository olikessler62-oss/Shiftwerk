import { TagAreaHeaderTooltipContent } from "@/components/areacalendar/tag-area-header-strip";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import {
  formatAreaServiceHoursDayTooltipBody,
  isAreaOpenOnDate,
  serviceWeekdayForDate,
  weekdayPluralLabelFromIndex,
  type AreaServiceHourRef,
} from "@/lib/location-staffing-client";
import { formatDayHeader } from "@/lib/planning-utils";
import type { WeekdayLabelLocale } from "@schichtwerk/i18n";
import type { ReactNode } from "react";

type BuildTagAreaServiceHoursHeaderTooltipParams = {
  t: (key: string, params?: Record<string, string>) => string;
  intlLocale: string;
  locale: WeekdayLabelLocale;
  areaId: string;
  areaName: string;
  date: string;
  serviceHours: readonly AreaServiceHourRef[];
  shiftTemplates?: readonly AreaCalendarAssignmentPreset[];
  showNoServiceHoursInHeader: boolean;
};

export function buildTagAreaServiceHoursHeaderTooltip({
  t,
  intlLocale,
  locale,
  areaId,
  areaName,
  date,
  serviceHours,
  shiftTemplates,
  showNoServiceHoursInHeader,
}: BuildTagAreaServiceHoursHeaderTooltipParams): ReactNode | undefined {
  const { weekday, label } = formatDayHeader(date, intlLocale, "long");
  const subtitleLines = [areaName, `${weekday}, ${label}`];

  if (showNoServiceHoursInHeader) {
    return (
      <TagAreaHeaderTooltipContent
        title={t("areaCalendar.serviceHoursHeaderTooltipTitle")}
        subtitleLines={subtitleLines}
        body={t("areaCalendar.noServiceHoursHeaderTooltip", {
          weekday: weekdayPluralLabelFromIndex(serviceWeekdayForDate(date), t),
        })}
      />
    );
  }

  if (!isAreaOpenOnDate(serviceHours, areaId, date)) return undefined;

  const body = formatAreaServiceHoursDayTooltipBody(
    serviceHours,
    areaId,
    date,
    {
      locale,
      shiftTemplates,
    }
  );
  if (!body) return undefined;

  return (
    <TagAreaHeaderTooltipContent
      title={t("areaCalendar.serviceHoursHeaderTooltipTitle")}
      subtitleLines={subtitleLines}
      body={body}
    />
  );
}
