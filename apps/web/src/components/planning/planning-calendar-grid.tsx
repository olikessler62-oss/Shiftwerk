"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarCornerCheckbox } from "@/components/dashboard/calendar-corner-checkbox";
import { PlanningCellCollapsedShiftMarkers } from "@/components/planning/planning-cell-collapsed-shift-markers";
import { PlanningCellShiftRow } from "@/components/planning/planning-cell-shift-row";
import { PlanningEmployeeRowOvernightOverlay } from "@/components/planning/planning-employee-row-overnight-overlay";
import { PlanningDayColumnWidthReporter } from "@/components/planning/planning-day-column-width-reporter";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { isPastCalendarDate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { computeExpandedDayUniformShiftWidths } from "@/lib/planning-expanded-shift-layout";
import {
  employeeWeekHours,
  formatDayHeader,
  formatPlanningHoursRatio,
} from "@/lib/planning-utils";
import { TagAreaHeaderStaffingOverlay } from "@/components/dashboard/tag-area-header-staffing-overlay";
import {
  PLANNING_CALENDAR_GRID_TRANSITION_CLASS,
  PLANNING_CELL_CONTENT_TRANSITION_CLASS,
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_CELL_PADDING_PX,
  PLANNING_COLUMN_DIVIDER_CLASS,
  PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT,
  PLANNING_DAY_FOOTER_ROW_HEIGHT,
  PLANNING_EMPLOYEE_ROW_HEIGHT,
  PLANNING_EXPANDED_DAY_CELL_LAYOUT_INSET_PX,
  PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS,
  PLANNING_HEADER_ROW_BORDER_CLASS,
  PLANNING_ROW_DIVIDER_CLASS,
  resolvePlanningCellBackground,
} from "@/lib/planning-calendar-layout";
import type { TagAreaHeaderStaffingEntry, AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { DashboardAssignmentPreset } from "@/lib/dashboard-assignment-presets";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import type {
  AvailabilityStatus,
  LocationAreaStaffing,
  Profile,
  Qualification,
} from "@schichtwerk/types";
import {
  createPlanningShiftJobContextMaps,
  type PlanningShiftJobContext,
} from "@/lib/planning-shift-card-display";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type { PlanningShiftDisplaySegment } from "@/lib/planning-overnight-shift-display";
import {
  collectPlanningOvernightSpansByEmployee,
  filterPlanningCellSegmentsForRendering,
  planningCellTouchesOvernightSpan,
} from "@/lib/planning-overnight-shift-display";
import { planningCellDataAttribute } from "@/lib/planning-overnight-span-layout";

const DAY_HEADER_ROW_HEIGHT = "3.5rem";
const MUTED_DAY_HEADER_CLASS = "bg-calendar-muted-header";
const ACTIVE_DAY_HEADER_CLASS = "bg-calendar-active-header";
const TODAY_DAY_HEADER_BADGE_CLASS =
  "rounded-sm bg-blue-600 px-1.5 py-0.5 text-white shadow-sm";
const HOLIDAY_DAY_HEADER_LABEL_CLASS =
  "w-full shrink-0 px-0.5 text-center text-[0.625rem] font-medium leading-snug text-blue-600";
const EMPLOYEE_COLOR_FALLBACK = "#94a3b8";

type DayAssignBlockReason = "absent" | "no_availability";

type Props = {
  dates: string[];
  employees: Profile[];
  shifts: PlanningShift[];
  /** Nur Kalenderdarstellung (Overnight-Spans); Wochenstunden nutzen `shifts`. */
  calendarDisplayShifts?: PlanningShift[];
  shiftsByCell: Map<string, PlanningShift[]>;
  shiftsByCellDisplay: Map<string, PlanningShiftDisplaySegment[]>;
  availabilityMap: Map<string, AvailabilityStatus>;
  holidayNames: Record<string, string>;
  dayHasServiceHours: boolean[];
  dayHasOpenArea: boolean[];
  activeDayDates: Set<string>;
  layoutActiveDayDates: Set<string>;
  dayReferenceShiftTimesByDate: Map<
    string,
    readonly { startTime: string; endTime: string }[]
  >;
  serviceTimelinesByDate: Map<string, ShiftCardServiceTimeline>;
  columnTemplate: string;
  headerRowTemplate: string;
  bodyRowTemplate: string;
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
  assignmentPresets: readonly DashboardAssignmentPreset[];
  picker: { employeeId: string; date: string; shiftId?: string } | null;
  showStaffingHeaderRow?: boolean;
  dailyStaffingByDate?: Map<string, TagAreaHeaderStaffingEntry[]>;
  t: (key: string) => string;
  isDayReadOnly: (date: string) => boolean;
  getDayAssignBlockReason: (
    employeeId: string,
    date: string
  ) => DayAssignBlockReason | null;
  onToggleDayActive: (date: string, active: boolean) => void;
  onOpenPicker: (employeeId: string, date: string, shiftId?: string) => void;
  onCellContextMenu: (
    employeeId: string,
    date: string,
    clientX: number,
    clientY: number
  ) => void;
  onShiftContextMenu: (
    employeeId: string,
    date: string,
    shiftId: string,
    clientX: number,
    clientY: number
  ) => void;
  selectedAreaId: string | null;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  qualifications: readonly Qualification[];
  profileQualificationIds: Record<string, string[]>;
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
  calendarDisplayShifts,
  shiftsByCell,
  shiftsByCellDisplay,
  availabilityMap,
  holidayNames,
  dayHasServiceHours,
  dayHasOpenArea,
  activeDayDates,
  layoutActiveDayDates,
  dayReferenceShiftTimesByDate,
  serviceTimelinesByDate,
  columnTemplate,
  headerRowTemplate,
  bodyRowTemplate,
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
  assignmentPresets,
  picker,
  showStaffingHeaderRow = false,
  dailyStaffingByDate,
  t,
  isDayReadOnly,
  getDayAssignBlockReason,
  onToggleDayActive,
  onOpenPicker,
  onCellContextMenu,
  onShiftContextMenu,
  selectedAreaId,
  serviceHours,
  staffingRules,
  qualifications,
  profileQualificationIds,
}: Props) {
  const [dayColumnInnerWidthPxByDate, setDayColumnInnerWidthPxByDate] =
    useState<Map<string, number>>(() => new Map());

  const handleDayColumnWidthChange = useCallback(
    (date: string, innerWidthPx: number) => {
      setDayColumnInnerWidthPxByDate((previous) => {
        if (previous.get(date) === innerWidthPx) return previous;
        const next = new Map(previous);
        next.set(date, innerWidthPx);
        return next;
      });
    },
    []
  );

  const overnightSpansByEmployee = useMemo(
    () =>
      collectPlanningOvernightSpansByEmployee(
        employees,
        dates,
        calendarDisplayShifts ?? shifts
      ),
    [employees, dates, calendarDisplayShifts, shifts]
  );

  const qualificationMaps = useMemo(
    () => createPlanningShiftJobContextMaps(qualifications),
    [qualifications]
  );

  const shiftJobContextByDate = useMemo(() => {
    const byDate = new Map<string, PlanningShiftJobContext>();
    for (const date of dates) {
      byDate.set(date, {
        dateISO: date,
        defaultAreaId: selectedAreaId,
        serviceHours,
        staffingRules,
        assignmentPresets,
        profileQualificationIds,
        qualificationNameById: qualificationMaps.qualificationNameById,
        qualificationSortOrder: qualificationMaps.qualificationSortOrder,
      });
    }
    return byDate;
  }, [
    dates,
    selectedAreaId,
    serviceHours,
    staffingRules,
    assignmentPresets,
    profileQualificationIds,
    qualificationMaps,
  ]);

  const shiftsByCellForRendering = useMemo(() => {
    const map = new Map<string, PlanningShiftDisplaySegment[]>();
    for (const [key, segments] of shiftsByCellDisplay) {
      map.set(key, filterPlanningCellSegmentsForRendering(segments, dates));
    }
    return map;
  }, [shiftsByCellDisplay, dates]);

  const expandedUniformShiftWidthsByDate = useMemo(() => {
    const byDate = new Map<string, Map<string, number>>();
    for (const date of dates) {
      if (!layoutActiveDayDates.has(date)) continue;
      const innerWidthPx = dayColumnInnerWidthPxByDate.get(date);
      if (innerWidthPx === undefined || innerWidthPx <= 0) continue;
      const layoutWidthPx = Math.max(
        0,
        innerWidthPx - PLANNING_EXPANDED_DAY_CELL_LAYOUT_INSET_PX
      );
      byDate.set(
        date,
        computeExpandedDayUniformShiftWidths(
          layoutWidthPx,
          employees,
          shiftsByCellForRendering,
          date
        )
      );
    }
    return byDate;
  }, [
    dates,
    layoutActiveDayDates,
    dayColumnInnerWidthPxByDate,
    employees,
    shiftsByCellForRendering,
  ]);

  const employeeBodyStartRow = showStaffingHeaderRow ? 3 : 2;
  const staffingHeaderRow = showStaffingHeaderRow ? 2 : null;
  const footerGridRow = employees.length + employeeBodyStartRow;

  const fullRowTemplate = useMemo(() => {
    const parts = [
      headerRowTemplate,
      bodyRowTemplate,
      PLANNING_DAY_FOOTER_ROW_HEIGHT,
    ].filter((part) => part.length > 0);
    return parts.join(" ");
  }, [headerRowTemplate, bodyRowTemplate]);

  const gridWidthStyle =
    fillColumnsEqually
      ? { width: "100%" as const }
      : minCalendarWidth !== undefined
        ? { minWidth: minCalendarWidth }
        : undefined;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-400 bg-surface shadow-sm",
        !isCalendarVisible && "invisible"
      )}
    >
      <div
        className={cn(
          "min-h-0 flex-1",
          fillColumnsEqually ? "overflow-x-hidden" : "overflow-x-auto",
          "overflow-y-auto",
          MODAL_SCROLLBAR_CLASS
        )}
      >
        <div
          className={cn("grid text-sm", PLANNING_CALENDAR_GRID_TRANSITION_CLASS)}
          style={{
            gridTemplateColumns: columnTemplate,
            gridTemplateRows: fullRowTemplate,
            ...gridWidthStyle,
          }}
        >
        <div
          className={cn(
            "sticky left-0 top-0 z-[45] flex items-center bg-calendar-active-header px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted",
            !showStaffingHeaderRow && PLANNING_HEADER_ROW_BORDER_CLASS,
            PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS
          )}
          style={{ gridColumn: 1, gridRow: 1, height: DAY_HEADER_ROW_HEIGHT }}
        >
          {t("planning.staffColumn")}
        </div>

        {showStaffingHeaderRow ? (
          <div
            className={cn(
              "sticky left-0 top-[3.5rem] z-[45] border-t border-slate-300 bg-calendar-active-header",
              PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS
            )}
            style={{
              gridColumn: 1,
              gridRow: staffingHeaderRow!,
              height: PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT,
            }}
            aria-hidden
          />
        ) : null}

        {dates.map((date, dayIndex) => {
          const { weekday, label } = formatDayHeader(date, intlLocale);
          const holiday = holidayNames[date];
          const isToday = date === todayISO;
          const mutedHeader = !dayHasServiceHours[dayIndex];

          return (
            <div
              key={`header-${date}`}
              className={cn(
                "relative sticky top-0 z-40 flex min-h-0 flex-col items-center justify-center gap-0.5 overflow-hidden py-1 text-center",
                !showStaffingHeaderRow && PLANNING_HEADER_ROW_BORDER_CLASS,
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

        {showStaffingHeaderRow
          ? dates.map((date, dayIndex) => {
              const mutedHeader = !dayHasServiceHours[dayIndex];
              const staffingEntries = dailyStaffingByDate?.get(date) ?? [];

              return (
                <div
                  key={`staffing-header-${date}`}
                  className={cn(
                    "sticky top-[3.5rem] z-40 flex min-h-0 items-center justify-center overflow-hidden border-t border-slate-300",
                    PLANNING_HEADER_ROW_BORDER_CLASS,
                    mutedHeader ? MUTED_DAY_HEADER_CLASS : ACTIVE_DAY_HEADER_CLASS,
                    dayHeaderColumnDivider(dayIndex, dates.length)
                  )}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: staffingHeaderRow!,
                    height: PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT,
                  }}
                >
                  {!dayHasServiceHours[dayIndex] ? (
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-medium leading-none text-black">
                      {t("dashboard.noServiceHours")}
                    </span>
                  ) : staffingEntries.length > 0 ? (
                    <TagAreaHeaderStaffingOverlay
                      entries={staffingEntries}
                      dimmed={isPastCalendarDate(date, todayISO)}
                      dayCollapsed={!layoutActiveDayDates.has(date)}
                    />
                  ) : null}
                </div>
              );
            })
          : null}

        {employees.map((emp, rowIndex) => {
          const gridRow = rowIndex + employeeBodyStartRow;
          const isLastEmployee = rowIndex === employees.length - 1;
          const weekH = employeeWeekHours(emp.id, shifts);
          const targetH = emp.weekly_hours ?? 40;
          const overHours = weekH > targetH;
          const employeeOvernightSpans =
            overnightSpansByEmployee.get(emp.id) ?? [];
          const employeeColor =
            emp.color?.trim() || EMPLOYEE_COLOR_FALLBACK;
          const rowSelectedShiftId =
            picker?.employeeId === emp.id ? (picker.shiftId ?? null) : null;

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
                const cellSegments = shiftsByCellForRendering.get(key) ?? [];
                const allCellSegments = shiftsByCellDisplay.get(key) ?? [];
                const hasOvernightSpanOnCell = planningCellTouchesOvernightSpan(
                  emp.id,
                  date,
                  employeeOvernightSpans
                );
                const cellHasShift =
                  allCellSegments.length > 0 || hasOvernightSpanOnCell;
                const avail = availabilityMap.get(key);
                const blockReason =
                  cellHasShift
                    ? null
                    : getDayAssignBlockReason(emp.id, date);
                const isPastDay = isPastCalendarDate(date, todayISO);
                const dayReadOnly = isDayReadOnly(date);
                const isDayExpanded = layoutActiveDayDates.has(date);
                const cellBackground = resolvePlanningCellBackground(
                  date,
                  dayIndex,
                  dayHasServiceHours,
                  cellHasShift,
                  todayISO
                );
                const selectedShiftId = rowSelectedShiftId;
                const serviceTimeline =
                  serviceTimelinesByDate.get(date) ??
                  serviceTimelinesByDate.values().next().value!;
                const onShiftClick = (shiftId: string) =>
                  onOpenPicker(emp.id, date, shiftId);
                const collapsedMarkers =
                  cellSegments.length > 0 ? (
                    <PlanningCellCollapsedShiftMarkers
                      segments={cellSegments}
                      dayReferenceShiftTimes={
                        dayReferenceShiftTimesByDate.get(date) ?? []
                      }
                      serviceTimeline={serviceTimeline}
                      employeeColor={employeeColor}
                      isPastDay={isPastDay}
                      pending={pending}
                      selectedShiftId={selectedShiftId}
                      onShiftClick={onShiftClick}
                    />
                  ) : null;
                const expandedShiftRow =
                  cellSegments.length > 0 ? (
                    <PlanningCellShiftRow
                      segments={cellSegments}
                      employeeName={emp.full_name}
                      employeeColor={employeeColor}
                      assignmentPresets={assignmentPresets}
                      pending={pending}
                      selectedShiftId={selectedShiftId}
                      onShiftClick={onShiftClick}
                      shiftJobContext={shiftJobContextByDate.get(date)!}
                      uniformShiftWidthPxByKey={
                        isDayExpanded
                          ? expandedUniformShiftWidthsByDate.get(date)
                          : undefined
                      }
                      onShiftContextMenu={
                        isDayExpanded && !isPastDay
                          ? (shiftId, event) =>
                              onShiftContextMenu(
                                emp.id,
                                date,
                                shiftId,
                                event.clientX,
                                event.clientY
                              )
                          : undefined
                      }
                    />
                  ) : null;

                return (
                  <div
                    key={key}
                    data-planning-cell={planningCellDataAttribute(emp.id, date)}
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
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onCellContextMenu(
                        emp.id,
                        date,
                        event.clientX,
                        event.clientY
                      );
                    }}
                  >
                    {rowIndex === 0 ? (
                      <PlanningDayColumnWidthReporter
                        date={date}
                        enabled={isDayExpanded}
                        onWidthChange={handleDayColumnWidthChange}
                      />
                    ) : null}
                    {!isDayExpanded && cellSegments.length > 0
                      ? collapsedMarkers
                      : null}

                    {isDayExpanded ? (
                      <div
                        className={cn(
                          "flex min-h-0 flex-1 flex-col",
                          PLANNING_CELL_CONTENT_TRANSITION_CLASS,
                          "opacity-100"
                        )}
                      >
                        {cellSegments.length > 0 ? (
                          expandedShiftRow
                        ) : hasOvernightSpanOnCell ? (
                          <div
                            aria-hidden
                            style={{ height: PLANNING_CELL_HEIGHT_PX }}
                          />
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
                              picker?.employeeId === emp.id &&
                                picker?.date === date &&
                                !picker?.shiftId &&
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

              {employeeOvernightSpans.length > 0 ? (
                <PlanningEmployeeRowOvernightOverlay
                  employeeId={emp.id}
                  employeeName={emp.full_name}
                  spans={employeeOvernightSpans}
                  dayColumnCount={dates.length}
                  gridRow={gridRow}
                  layoutActiveDayDates={layoutActiveDayDates}
                  employeeColor={employeeColor}
                  todayISO={todayISO}
                  assignmentPresets={assignmentPresets}
                  shiftJobContextByDate={shiftJobContextByDate}
                  pending={pending}
                  selectedShiftId={rowSelectedShiftId}
                  onShiftClick={(shiftId, startDate) =>
                    onOpenPicker(emp.id, startDate, shiftId)
                  }
                  onShiftContextMenu={(shiftId, startDate, event) => {
                    if (
                      isPastCalendarDate(startDate, todayISO) ||
                      isDayReadOnly(startDate)
                    ) {
                      return;
                    }
                    onShiftContextMenu(
                      emp.id,
                      startDate,
                      shiftId,
                      event.clientX,
                      event.clientY
                    );
                  }}
                />
              ) : null}
            </div>
          );
        })}

        <div
          className="sticky bottom-0 z-40 border-t border-slate-400 bg-calendar-active-header"
          style={{
            gridColumn: "1 / -1",
            gridRow: footerGridRow,
            height: PLANNING_DAY_FOOTER_ROW_HEIGHT,
          }}
          aria-hidden
        />
        </div>
      </div>
    </div>
  );
}

export { PLANNING_EMPLOYEE_ROW_HEIGHT, DAY_HEADER_ROW_HEIGHT };
