"use client";

import { CollapsedShiftPreview } from "@/components/dashboard/collapsed-shift-preview";
import { CalendarCornerCheckbox } from "@/components/dashboard/calendar-corner-checkbox";
import {
  DASHBOARD_SHIFT_CARD_BOX_SHADOW,
  type DashboardShiftCard,
} from "@/components/dashboard/dashboard-shift-card-view";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { isPastCalendarDate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import {
  employeeWeekHours,
  formatDayHeader,
  formatPlanningHoursRatio,
  formatTimeRange,
} from "@/lib/planning-utils";
import {
  PLANNING_CALENDAR_GRID_TRANSITION_CLASS,
  PLANNING_CELL_CONTENT_TRANSITION_CLASS,
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_CELL_PADDING_PX,
  PLANNING_COLLAPSED_SHIFT_LEFT_INSET_PX,
  PLANNING_COLLAPSED_SHIFT_WIDTH_DELTA_PX,
  PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX,
  PLANNING_COLUMN_DIVIDER_CLASS,
  PLANNING_EMPLOYEE_ROW_HEIGHT,
  PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS,
  PLANNING_HEADER_ROW_BORDER_CLASS,
  PLANNING_ROW_DIVIDER_CLASS,
  resolvePlanningCellBackground,
} from "@/lib/planning-calendar-layout";
import {
  buildShiftCardTimeGradientCss,
  SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
} from "@/lib/shift-card-time-gradient";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import type { AvailabilityStatus, Profile } from "@schichtwerk/types";
import type { PlanningShift } from "@/lib/planning-shift-card";
import {
  planningCollapsedCellWidthPx,
  planningShiftToDashboardCard,
} from "@/lib/planning-shift-card";

const DAY_HEADER_ROW_HEIGHT = "3.5rem";
const MUTED_DAY_HEADER_CLASS = "bg-calendar-muted-header";
const ACTIVE_DAY_HEADER_CLASS = "bg-calendar-active-header";
const TODAY_DAY_HEADER_BADGE_CLASS =
  "rounded-sm bg-blue-600 px-1.5 py-0.5 text-white shadow-sm";
const HOLIDAY_DAY_HEADER_LABEL_CLASS =
  "w-full shrink-0 px-0.5 text-center text-[0.625rem] font-medium leading-snug text-blue-600";
const EMPLOYEE_COLOR_FALLBACK = "#94a3b8";
const SHIFT_CARD_CLASS =
  "relative flex w-full shrink-0 overflow-hidden rounded text-left text-black";
const SHIFT_CARD_CONTENT_CLASS = "flex min-w-0 flex-1 bg-white px-1.5 py-0.5";

type DayAssignBlockReason = "absent" | "no_availability";

type Props = {
  dates: string[];
  employees: Profile[];
  shifts: PlanningShift[];
  shiftMap: Map<string, PlanningShift>;
  availabilityMap: Map<string, AvailabilityStatus>;
  holidayNames: Record<string, string>;
  dayHasServiceHours: boolean[];
  dayHasOpenArea: boolean[];
  activeDayDates: Set<string>;
  layoutActiveDayDates: Set<string>;
  dashboardShiftsByDate: Map<string, DashboardShiftCard[]>;
  serviceTimelinesByDate: Map<string, ShiftCardServiceTimeline>;
  columnTemplate: string;
  rowTemplate: string;
  minCalendarWidth: number | undefined;
  fillColumnsEqually: boolean;
  narrowDayColumnWidthsPx: number[];
  dayUsesWideColumn: boolean[];
  isCalendarVisible: boolean;
  todayISO: string;
  intlLocale: string;
  locale: string;
  pending: boolean;
  canAssign: boolean;
  picker: { employeeId: string; date: string } | null;
  dailyCounts: {
    date: string;
    total: number;
    byPreset: { preset: { id: string; name: string }; count: number }[];
  }[];
  t: (key: string) => string;
  isDayReadOnly: (date: string) => boolean;
  getDayAssignBlockReason: (
    employeeId: string,
    date: string
  ) => DayAssignBlockReason | null;
  onToggleDayActive: (date: string, active: boolean) => void;
  onOpenPicker: (employeeId: string, date: string) => void;
};

function dayHeaderColumnDivider(dayIndex: number, totalDays: number) {
  return dayIndex < totalDays - 1
    ? PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS
    : undefined;
}

function dayColumnDivider(dayIndex: number, totalDays: number) {
  return dayIndex < totalDays - 1 ? PLANNING_COLUMN_DIVIDER_CLASS : undefined;
}

export function PlanningCalendarGrid({
  dates,
  employees,
  shifts,
  shiftMap,
  availabilityMap,
  holidayNames,
  dayHasServiceHours,
  dayHasOpenArea,
  activeDayDates,
  layoutActiveDayDates,
  dashboardShiftsByDate,
  serviceTimelinesByDate,
  columnTemplate,
  rowTemplate,
  minCalendarWidth,
  fillColumnsEqually,
  narrowDayColumnWidthsPx,
  dayUsesWideColumn,
  isCalendarVisible,
  todayISO,
  intlLocale,
  locale,
  pending,
  canAssign,
  picker,
  dailyCounts,
  t,
  isDayReadOnly,
  getDayAssignBlockReason,
  onToggleDayActive,
  onOpenPicker,
}: Props) {
  const footerGridRow = employees.length + 2;

  return (
    <div
      className={cn(
        fillColumnsEqually ? "overflow-x-hidden" : "overflow-x-auto",
        "rounded-xl border border-slate-400 bg-surface shadow-sm",
        MODAL_SCROLLBAR_CLASS,
        !isCalendarVisible && "invisible"
      )}
    >
      <div
        className={cn("grid text-sm", PLANNING_CALENDAR_GRID_TRANSITION_CLASS)}
        style={{
          gridTemplateColumns: columnTemplate,
          gridTemplateRows: rowTemplate,
          ...(fillColumnsEqually
            ? { width: "100%" }
            : minCalendarWidth !== undefined
              ? { minWidth: minCalendarWidth }
              : undefined),
        }}
      >
        <div
          className={cn(
            "sticky left-0 z-30 flex items-center bg-calendar-active-header px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted",
            PLANNING_HEADER_ROW_BORDER_CLASS,
            PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS
          )}
          style={{ gridColumn: 1, gridRow: 1, height: DAY_HEADER_ROW_HEIGHT }}
        >
          {t("planning.staffColumn")}
        </div>

        {dates.map((date, dayIndex) => {
          const { weekday, label } = formatDayHeader(date, intlLocale);
          const holiday = holidayNames[date];
          const isToday = date === todayISO;
          const mutedHeader = !dayHasServiceHours[dayIndex];

          return (
            <div
              key={`header-${date}`}
              className={cn(
                "relative flex min-h-0 flex-col items-center justify-center gap-0.5 overflow-hidden py-1 text-center",
                PLANNING_HEADER_ROW_BORDER_CLASS,
                mutedHeader ? MUTED_DAY_HEADER_CLASS : ACTIVE_DAY_HEADER_CLASS,
                dayHeaderColumnDivider(dayIndex, dates.length)
              )}
              style={{
                gridColumn: dayIndex + 2,
                gridRow: 1,
                height: DAY_HEADER_ROW_HEIGHT,
              }}
            >
              {dayHasOpenArea[dayIndex] ? (
                <CalendarCornerCheckbox
                  aria-label={`${weekday} ${label}`}
                  checked={activeDayDates.has(date)}
                  onChange={(event) =>
                    onToggleDayActive(date, event.target.checked)
                  }
                />
              ) : null}
              {isToday ? (
                <div
                  className={cn(
                    TODAY_DAY_HEADER_BADGE_CLASS,
                    "flex shrink-0 flex-col items-center gap-px"
                  )}
                >
                  <div className="whitespace-nowrap text-xs font-semibold leading-none">
                    {weekday}
                  </div>
                  <div className="whitespace-nowrap text-sm font-medium leading-none">
                    {label}
                  </div>
                </div>
              ) : (
                <>
                  <div className="shrink-0 whitespace-nowrap text-xs font-semibold leading-none text-muted">
                    {weekday}
                  </div>
                  <div className="shrink-0 whitespace-nowrap text-sm font-medium leading-none">
                    {label}
                  </div>
                </>
              )}
              {holiday ? (
                <div className={HOLIDAY_DAY_HEADER_LABEL_CLASS}>{holiday}</div>
              ) : null}
            </div>
          );
        })}

        {employees.map((emp, rowIndex) => {
          const gridRow = rowIndex + 2;
          const isLastEmployee = rowIndex === employees.length - 1;
          const weekH = employeeWeekHours(emp.id, shifts);
          const targetH = emp.weekly_hours ?? 40;
          const overHours = weekH > targetH;

          return (
            <div key={`staff-${emp.id}`} className="contents">
              <div
                className={cn(
                  "sticky left-0 z-20 flex min-h-0 items-center bg-surface px-0",
                  PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS,
                  !isLastEmployee && PLANNING_ROW_DIVIDER_CLASS
                )}
                style={{ gridColumn: 1, gridRow }}
              >
                <div className="flex min-w-0 items-center gap-2 py-1 pl-3 pr-2">
                  <span
                    className="h-5 w-[7px] shrink-0"
                    style={{
                      backgroundColor:
                        emp.color?.trim() || EMPLOYEE_COLOR_FALLBACK,
                    }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium leading-tight">
                      {emp.full_name}
                    </div>
                    <div
                      className={cn(
                        "truncate text-xs leading-tight",
                        overHours ? "font-medium text-amber-600" : "text-muted"
                      )}
                    >
                      {t("common.basic")}{" "}
                      {formatPlanningHoursRatio(weekH, targetH, locale)}
                    </div>
                  </div>
                </div>
              </div>

              {dates.map((date, dayIndex) => {
                const key = `${emp.id}:${date}`;
                const shift = shiftMap.get(key);
                const avail = availabilityMap.get(key);
                const blockReason = shift
                  ? null
                  : getDayAssignBlockReason(emp.id, date);
                const isSelected =
                  picker?.employeeId === emp.id && picker?.date === date;
                const dayReadOnly = isDayReadOnly(date);
                const isDayExpanded = layoutActiveDayDates.has(date);
                const isPastDay = isPastCalendarDate(date, todayISO);
                const dayReferenceShifts = dashboardShiftsByDate.get(date) ?? [];
                const collapsedCellWidthPx =
                  !fillColumnsEqually && !dayUsesWideColumn[dayIndex]
                    ? planningCollapsedCellWidthPx(
                        narrowDayColumnWidthsPx[dayIndex] ?? 0,
                        PLANNING_CELL_PADDING_PX
                      )
                    : undefined;
                const cellBackground = resolvePlanningCellBackground(
                  date,
                  dayIndex,
                  dayHasServiceHours,
                  Boolean(shift),
                  todayISO
                );

                return (
                  <div
                    key={key}
                    className={cn(
                      "relative flex min-h-0 flex-col overflow-hidden",
                      dayColumnDivider(dayIndex, dates.length),
                      !isLastEmployee && PLANNING_ROW_DIVIDER_CLASS
                    )}
                    style={{
                      gridColumn: dayIndex + 2,
                      gridRow,
                      padding: PLANNING_CELL_PADDING_PX,
                      ...(cellBackground
                        ? { backgroundColor: cellBackground }
                        : undefined),
                    }}
                  >
                    {!isDayExpanded && shift ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onOpenPicker(emp.id, date)}
                        className="flex w-full min-w-0 cursor-pointer items-center border-0 bg-transparent p-0"
                        style={{ height: PLANNING_CELL_HEIGHT_PX }}
                      >
                        <CollapsedShiftPreview
                          shifts={[
                            planningShiftToDashboardCard(shift, emp),
                          ]}
                          serviceTimeline={
                            serviceTimelinesByDate.get(date) ??
                            serviceTimelinesByDate.values().next().value!
                          }
                          isPastDay={isPastDay}
                          pastDayReferenceShifts={
                            isPastDay ? dayReferenceShifts : undefined
                          }
                          cellWidthPxOverride={collapsedCellWidthPx}
                          compactRow
                          fixedMarkerMarginLeftPx={Math.max(
                            0,
                            PLANNING_COLLAPSED_SHIFT_LEFT_INSET_PX -
                              PLANNING_CELL_PADDING_PX
                          )}
                          markerWidthDeltaPx={
                            PLANNING_COLLAPSED_SHIFT_WIDTH_DELTA_PX
                          }
                          markerHeightDeltaPx={
                            PLANNING_COLLAPSED_SHIFT_HEIGHT_DELTA_PX
                          }
                        />
                      </button>
                    ) : null}

                    {isDayExpanded ? (
                      <div
                        className={cn(
                          "flex min-h-0 flex-1 flex-col",
                          PLANNING_CELL_CONTENT_TRANSITION_CLASS,
                          "opacity-100"
                        )}
                      >
                        {shift ? (
                          <button
                            type="button"
                            disabled={pending || (dayReadOnly && !shift)}
                            onClick={() => onOpenPicker(emp.id, date)}
                            className={cn(
                              SHIFT_CARD_CLASS,
                              "transition hover:opacity-90 disabled:opacity-50",
                              isSelected && "ring-2 ring-primary ring-offset-1"
                            )}
                            style={{
                              boxShadow: DASHBOARD_SHIFT_CARD_BOX_SHADOW,
                              minHeight: PLANNING_CELL_HEIGHT_PX,
                              height: PLANNING_CELL_HEIGHT_PX,
                            }}
                          >
                            <div
                              className="shrink-0 self-stretch"
                              style={{
                                width: SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
                                backgroundColor:
                                  emp.color?.trim() || EMPLOYEE_COLOR_FALLBACK,
                              }}
                              aria-hidden
                            />
                            <div
                              className={cn(
                                SHIFT_CARD_CONTENT_CLASS,
                                "relative flex flex-col justify-center"
                              )}
                              style={{
                                minHeight: PLANNING_CELL_HEIGHT_PX,
                                height: PLANNING_CELL_HEIGHT_PX,
                                backgroundImage: buildShiftCardTimeGradientCss(
                                  shift.startTime,
                                  shift.endTime
                                ),
                              }}
                            >
                              <div className="truncate text-xs font-semibold leading-tight">
                                {shift.shiftName ||
                                  formatTimeRange(
                                    shift.startTime,
                                    shift.endTime
                                  )}
                              </div>
                              <div className="mt-0.5 truncate text-[10px] leading-tight">
                                {formatTimeRange(shift.startTime, shift.endTime)}
                              </div>
                            </div>
                          </button>
                        ) : blockReason === "absent" ? (
                          <div
                            className="flex items-center justify-center rounded-lg bg-rose-50 text-xs font-medium text-rose-700"
                            style={{ height: PLANNING_CELL_HEIGHT_PX }}
                          >
                            {t("planning.cellAbsent")}
                          </div>
                        ) : blockReason === "no_availability" ? (
                          <div
                            className="flex items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500"
                            style={{ height: PLANNING_CELL_HEIGHT_PX }}
                          >
                            {t("planning.cellNoAvailability")}
                          </div>
                        ) : avail === "unavailable" ? (
                          <div
                            className="flex items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500"
                            style={{ height: PLANNING_CELL_HEIGHT_PX }}
                          >
                            {t("planning.cellUnavailable")}
                          </div>
                        ) : avail === "preferred" ? (
                          <div
                            className="flex items-center justify-center rounded-lg bg-amber-50 text-xs font-medium text-amber-700"
                            style={{ height: PLANNING_CELL_HEIGHT_PX }}
                          >
                            {t("planning.cellPreferred")}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={pending || !canAssign || dayReadOnly}
                            onClick={() => onOpenPicker(emp.id, date)}
                            className={cn(
                              "flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-border text-muted transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-40",
                              isSelected &&
                                "border-primary bg-primary/5 text-primary"
                            )}
                            style={{ height: PLANNING_CELL_HEIGHT_PX }}
                          >
                            <span className="text-lg leading-none">+</span>
                            <span className="text-[10px]">
                              {t("planning.cellFree")}
                            </span>
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}

        <div
          className={cn(
            "sticky left-0 z-10 border-t-2 border-slate-400 bg-background px-4 py-3 text-xs font-semibold text-muted",
            PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS
          )}
          style={{ gridColumn: 1, gridRow: footerGridRow }}
        >
          Tagesbedarf
        </div>

        {dailyCounts.map(({ date, total, byPreset }, dayIndex) => {
          const staffed = total >= Math.min(employees.length, 3);
          const isDayExpanded = layoutActiveDayDates.has(date);

          return (
            <div
              key={`footer-${date}`}
              className={cn(
                "border-t-2 border-slate-400 px-2 py-2 text-center",
                dayColumnDivider(dayIndex, dates.length)
              )}
              style={{ gridColumn: dayIndex + 2, gridRow: footerGridRow }}
            >
              {isDayExpanded ? (
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      staffed ? "bg-green-500" : "bg-red-500"
                    )}
                  />
                  <span className="text-xs font-medium">{total}</span>
                  {byPreset.slice(0, 2).map(({ preset, count }) => (
                    <span key={preset.id} className="text-[10px] text-muted">
                      {preset.name.slice(0, 4)} {count}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-medium">{total}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PLANNING_EMPLOYEE_ROW_HEIGHT, DAY_HEADER_ROW_HEIGHT };
