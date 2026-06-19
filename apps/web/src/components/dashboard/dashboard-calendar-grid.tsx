"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarCornerCheckbox } from "@/components/areacalendar/calendar-corner-checkbox";
import { DashboardCellCollapsedShiftMarkers } from "@/components/dashboard/dashboard-cell-collapsed-shift-markers";
import { DashboardCellShiftRow } from "@/components/dashboard/dashboard-cell-shift-row";
import { DashboardEmployeeRowOvernightOverlay } from "@/components/dashboard/dashboard-employee-row-overnight-overlay";
import { DashboardDayColumnWidthReporter } from "@/components/dashboard/dashboard-day-column-width-reporter";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import { isPastCalendarDate } from "@/lib/dates";
import { isPastShiftDate } from "@/lib/planning-readonly";
import { canOpenShiftCardContextMenu } from "@/lib/shift-card-context-menu-actions";
import { cn } from "@/lib/cn";
import {
  CALENDAR_DAY_HEADER_ACTIVE_CLASS,
  CALENDAR_DAY_HEADER_CELL_CLASS,
  CALENDAR_DAY_HEADER_MUTED_CLASS,
  CALENDAR_DAY_HEADER_ROW_HEIGHT,
  CALENDAR_HOLIDAY_DAY_HEADER_LABEL_CLASS,
  CALENDAR_TODAY_DAY_HEADER_BADGE_CLASS,
} from "@/lib/calendar-day-header-styles";
import { CALENDAR_INTERACTION_SURFACE_CLASS } from "@/lib/calendar-interaction-ui";
import {
  employeeWeekHours,
  formatDayHeader,
  formatPlanningHoursRatio,
} from "@/lib/planning-utils";
import { TagAreaHeaderStaffingOverlay } from "@/components/areacalendar/tag-area-header-staffing-overlay";
import { DashboardWeeklySummaryFooter } from "@/components/dashboard/dashboard-weekly-summary-footer";
import { TagAreaFooterStrip } from "@/components/areacalendar/tag-area-footer-strip";
import {
  PLANNING_CALENDAR_GRID_TRANSITION_CLASS,
  PLANNING_CELL_CONTENT_TRANSITION_CLASS,
  PLANNING_CELL_HEIGHT_PX,
  PLANNING_CELL_PADDING_PX,
  PLANNING_COLUMN_DIVIDER_CLASS,
  PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT,
  PLANNING_DAY_FOOTER_ROW_HEIGHT,
  PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT,
  PLANNING_EMPLOYEE_ROW_HEIGHT,
  PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS,
  PLANNING_HEADER_ROW_BORDER_CLASS,
  PLANNING_ROW_DIVIDER_CLASS,
  PLANNING_STAFF_COLUMN_BOTTOM_EDGE_CLASS,
  resolvePlanningCellBackground,
} from "@/lib/planning-calendar-layout";
import type { TagAreaHeaderStaffingEntry, AreaServiceHourRef } from "@/lib/location-staffing-client";
import type { TagAreaFooterLabels } from "@/lib/tag-area-footer-stats";
import type { PlanningWeeklySummary } from "@/lib/planning-utils";
import type { AreaCalendarAssignmentPreset } from "@/lib/areacalendar-assignment-presets";
import type { ShiftCardServiceTimeline } from "@/lib/shift-card-service-timeline";
import type {
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
  canOpenPlanningOvernightShiftContextMenu,
  cellShowsOnlyOvernightShiftSegments,
  collectPlanningOvernightSpansByEmployee,
  filterPlanningCellSegmentsForRendering,
  planningCellTouchesOvernightSpan,
  resolveOvernightSpanDisplayMode,
  resolvePlanningOvernightShiftContextMenuDate,
} from "@/lib/planning-overnight-shift-display";
import { planningCellDataAttribute } from "@/lib/planning-overnight-span-layout";
import { SHIFT_CARD_TWO_LINE_HEIGHT_PX } from "@/lib/shift-card-row-layout";
import { SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX } from "@/lib/shift-card-time-gradient";

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
  holidayNames: Record<string, string>;
  dayHasServiceHours: boolean[];
  dayHasOpenArea: boolean[];
  activeDayDates: Set<string>;
  layoutActiveDayDates: Set<string>;
  layoutTransitionEnabled?: boolean;
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
  assignmentPresets: readonly AreaCalendarAssignmentPreset[];
  picker: { employeeId: string; date: string; shiftId?: string } | null;
  showStaffingHeaderRow?: boolean;
  dailyStaffingByDate?: Map<string, TagAreaHeaderStaffingEntry[]>;
  dailyFooterLabelsByDate?: Map<string, TagAreaFooterLabels>;
  weeklySummary?: PlanningWeeklySummary;
  t: (key: string, params?: Record<string, string>) => string;
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
  onEmployeeRowContextMenu?: (
    employeeId: string,
    clientX: number,
    clientY: number
  ) => void;
  selectedAreaId: string | null;
  serviceHours: readonly AreaServiceHourRef[];
  staffingRules: readonly LocationAreaStaffing[];
  qualifications: readonly Qualification[];
  profileQualificationIds: Record<string, string[]>;
  highlightedEmployeeId?: string | null;
  onEmployeeHover?: (employeeId: string | null) => void;
  absenceConflictShiftIds?: ReadonlySet<string>;
};

function dayHeaderColumnDivider(dayIndex: number, totalDays: number) {
  return dayIndex < totalDays - 1
    ? PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS
    : undefined;
}

function dayColumnDivider(dayIndex: number, totalDays: number) {
  return dayIndex < totalDays - 1 ? PLANNING_COLUMN_DIVIDER_CLASS : undefined;
}

export function DashboardCalendarGrid({
  dates,
  employees,
  shifts,
  calendarDisplayShifts,
  shiftsByCell,
  shiftsByCellDisplay,
  holidayNames,
  dayHasServiceHours,
  dayHasOpenArea,
  activeDayDates,
  layoutActiveDayDates,
  layoutTransitionEnabled = false,
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
  dailyFooterLabelsByDate,
  weeklySummary,
  t,
  isDayReadOnly,
  getDayAssignBlockReason,
  onToggleDayActive,
  onOpenPicker,
  onCellContextMenu,
  onShiftContextMenu,
  onEmployeeRowContextMenu,
  selectedAreaId,
  serviceHours,
  staffingRules,
  qualifications,
  profileQualificationIds,
  highlightedEmployeeId = null,
  onEmployeeHover,
  absenceConflictShiftIds,
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

  const employeeBodyStartRow = showStaffingHeaderRow ? 3 : 2;
  const staffingHeaderRow = showStaffingHeaderRow ? 2 : null;
  const footerStatsGridRow = employees.length + employeeBodyStartRow;
  const footerGridRow = footerStatsGridRow + 1;

  const fullRowTemplate = useMemo(() => {
    const parts = [
      headerRowTemplate,
      bodyRowTemplate,
      PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT,
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
        CALENDAR_INTERACTION_SURFACE_CLASS,
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
          data-dashboard-calendar-grid
          className={cn(
            "grid min-h-full text-sm",
            layoutTransitionEnabled && PLANNING_CALENDAR_GRID_TRANSITION_CLASS
          )}
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
          style={{ gridColumn: 1, gridRow: 1, height: CALENDAR_DAY_HEADER_ROW_HEIGHT }}
        >
          {t("dashboard.staffColumn")}
        </div>

        {showStaffingHeaderRow ? (
          <div
            className={cn(
              "sticky left-0 z-[45] border-t border-slate-300 bg-calendar-active-header",
              PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS,
              PLANNING_STAFF_COLUMN_BOTTOM_EDGE_CLASS
            )}
            style={{
              gridColumn: 1,
              gridRow: staffingHeaderRow!,
              top: CALENDAR_DAY_HEADER_ROW_HEIGHT,
              height: PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT,
            }}
            aria-hidden
          />
        ) : null}

        {dates.map((date, dayIndex) => {
          const { weekday, label } = formatDayHeader(date, intlLocale);
          const holiday = holidayNames[date];
          const isToday = date === todayISO;
          const isPastDay = isPastCalendarDate(date, todayISO);
          const mutedHeader = !dayHasServiceHours[dayIndex];

          return (
            <div
              key={`header-${date}`}
              className={cn(
                "sticky top-0 z-40",
                CALENDAR_DAY_HEADER_CELL_CLASS,
                !showStaffingHeaderRow && PLANNING_HEADER_ROW_BORDER_CLASS,
                mutedHeader ? CALENDAR_DAY_HEADER_MUTED_CLASS : CALENDAR_DAY_HEADER_ACTIVE_CLASS,
                dayHeaderColumnDivider(dayIndex, dates.length)
              )}
              style={{
                gridColumn: dayIndex + 2,
                gridRow: 1,
                height: CALENDAR_DAY_HEADER_ROW_HEIGHT,
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
                    CALENDAR_TODAY_DAY_HEADER_BADGE_CLASS,
                    "flex shrink-0 flex-col items-center gap-px"
                  )}
                >
                  <div className="whitespace-nowrap text-xs font-semibold leading-[14px]">
                    {weekday}
                  </div>
                  <div className="whitespace-nowrap text-sm font-bold leading-tight -mt-px">
                    {label}
                  </div>
                </div>
              ) : (
                <>
                  <div className="shrink-0 whitespace-nowrap text-xs font-semibold leading-[14px] text-muted">
                    {weekday}
                  </div>
                  <div
                    className={cn(
                      "shrink-0 whitespace-nowrap text-sm font-medium leading-tight -mt-px",
                      isPastDay && "text-muted"
                    )}
                  >
                    {label}
                  </div>
                </>
              )}
              {holiday ? (
                <div className={CALENDAR_HOLIDAY_DAY_HEADER_LABEL_CLASS}>{holiday}</div>
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
                    "sticky z-40 flex min-h-0 items-center justify-center overflow-hidden border-t border-slate-300",
                    PLANNING_HEADER_ROW_BORDER_CLASS,
                    mutedHeader ? CALENDAR_DAY_HEADER_MUTED_CLASS : CALENDAR_DAY_HEADER_ACTIVE_CLASS,
                    dayHeaderColumnDivider(dayIndex, dates.length)
                  )}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: staffingHeaderRow!,
                    top: CALENDAR_DAY_HEADER_ROW_HEIGHT,
                    height: PLANNING_DAY_STAFFING_HEADER_ROW_HEIGHT,
                  }}
                >
                  {!dayHasServiceHours[dayIndex] ? (
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-medium leading-none text-black">
                      {t("areaCalendar.noServiceHours")}
                    </span>
                  ) : staffingEntries.length > 0 ? (
                    <TagAreaHeaderStaffingOverlay
                      entries={staffingEntries}
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
          const isEmployeeHighlighted =
            highlightedEmployeeId !== null && highlightedEmployeeId === emp.id;

          return (
            <div key={`staff-${emp.id}`} className="contents">
              <div
                className={cn(
                  "sticky left-0 z-20 flex min-h-0 cursor-default items-center self-stretch bg-surface px-0 transition-colors",
                  PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS,
                  !isLastEmployee && PLANNING_ROW_DIVIDER_CLASS,
                  isEmployeeHighlighted && "bg-subtle"
                )}
                style={{ gridColumn: 1, gridRow }}
                onMouseEnter={() => onEmployeeHover?.(emp.id)}
                onMouseLeave={() => onEmployeeHover?.(null)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onEmployeeRowContextMenu?.(emp.id, event.clientX, event.clientY);
                }}
              >
                <div className="flex min-w-0 items-center gap-2 py-0 pl-3 pr-2">
                  <span
                    className="shrink-0 rounded-l"
                    style={{
                      width: SHIFT_CARD_EMPLOYEE_STRIP_WIDTH_PX,
                      height: SHIFT_CARD_TWO_LINE_HEIGHT_PX,
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
                const blockReason =
                  cellHasShift
                    ? null
                    : getDayAssignBlockReason(emp.id, date);
                const isPastDay = isPastCalendarDate(date, todayISO);
                const dayReadOnly = isDayReadOnly(date);
                const isDayExpanded = layoutActiveDayDates.has(date);
                const overnightSpanOnCell = employeeOvernightSpans.find(
                  (span) => span.startDate === date || span.endDate === date
                );
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
                const canOpenNewShiftInCell =
                  !pending && canAssign && !dayReadOnly;
                const openNewShiftInCell = () => onOpenPicker(emp.id, date);
                const emptyAreaLabel = t("dashboard.addShiftTitle");
                const collapsedOvernightAnchors = !isDayExpanded
                  ? employeeOvernightSpans.filter(
                      (span) =>
                        span.startDate === date &&
                        resolveOvernightSpanDisplayMode(
                          span,
                          layoutActiveDayDates
                        ) === "collapsed"
                    )
                  : [];
                const collapsedMarkers =
                  cellSegments.length > 0 ? (
                    <DashboardCellCollapsedShiftMarkers
                      segments={cellSegments}
                      dayReferenceShiftTimes={
                        dayReferenceShiftTimesByDate.get(date) ?? []
                      }
                      serviceTimeline={serviceTimeline}
                      employeeColor={employeeColor}
                      isPastDay={isPastDay}
                      cellDate={date}
                      pending={pending}
                      selectedShiftId={selectedShiftId}
                      onShiftClick={onShiftClick}
                      onShiftContextMenu={
                        !isPastDay
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
                      onEmptyAreaClick={openNewShiftInCell}
                      emptyAreaDisabled={!canOpenNewShiftInCell}
                      emptyAreaLabel={emptyAreaLabel}
                    />
                  ) : null;
                const expandedShiftRow =
                  cellSegments.length > 0 ? (
                    <DashboardCellShiftRow
                      segments={cellSegments}
                      employeeName={emp.full_name}
                      employeeColor={employeeColor}
                      assignmentPresets={assignmentPresets}
                      pending={pending}
                      selectedShiftId={selectedShiftId}
                      cellDate={date}
                      onShiftClick={onShiftClick}
                      shiftJobContext={shiftJobContextByDate.get(date)!}
                      onShiftContextMenu={
                        isDayExpanded
                          ? (shiftId, event) => {
                              const segment = cellSegments.find(
                                (entry) => entry.shift.id === shiftId
                              );
                              if (
                                segment &&
                                !canOpenShiftCardContextMenu(
                                  segment.shift.confirmationStatus,
                                  segment.shift.requestedAt,
                                  {
                                    shiftDate: segment.shift.shift_date,
                                    isPastShiftDate,
                                  }
                                )
                              ) {
                                return;
                              }
                              onShiftContextMenu(
                                emp.id,
                                date,
                                shiftId,
                                event.clientX,
                                event.clientY
                              );
                            }
                          : undefined
                      }
                      employeeHighlighted={isEmployeeHighlighted && isDayExpanded}
                      absenceConflictShiftIds={absenceConflictShiftIds}
                    />
                  ) : null;

                return (
                  <div
                    key={key}
                    data-planning-cell={planningCellDataAttribute(emp.id, date)}
                    className={cn(
                      "relative flex min-h-0 flex-col self-stretch overflow-hidden",
                      isEmployeeHighlighted && isDayExpanded && "overflow-visible",
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
                      const pastUnconfirmedMenu = {
                        shiftDate: "",
                        isPastShiftDate,
                      };
                      if (
                        overnightSpanOnCell &&
                        canOpenPlanningOvernightShiftContextMenu(
                          overnightSpanOnCell,
                          {
                            todayISO,
                            isDayReadOnly,
                            pastUnconfirmedMenu: {
                              shiftDate: overnightSpanOnCell.shift.shift_date,
                              isPastShiftDate,
                            },
                          }
                        ) &&
                        (cellSegments.length === 0 ||
                          cellShowsOnlyOvernightShiftSegments(
                            cellSegments,
                            overnightSpanOnCell.shift.id
                          ))
                      ) {
                        onShiftContextMenu(
                          emp.id,
                          resolvePlanningOvernightShiftContextMenuDate(
                            overnightSpanOnCell,
                            date,
                            {
                              todayISO,
                              isDayReadOnly,
                              pastUnconfirmedMenu: {
                                shiftDate: overnightSpanOnCell.shift.shift_date,
                                isPastShiftDate,
                              },
                            }
                          ),
                          overnightSpanOnCell.shift.id,
                          event.clientX,
                          event.clientY
                        );
                        return;
                      }
                      if (isPastDay) return;
                      if (blockReason === "absent") return;
                      onCellContextMenu(
                        emp.id,
                        date,
                        event.clientX,
                        event.clientY
                      );
                    }}
                  >
                    {rowIndex === 0 ? (
                      <DashboardDayColumnWidthReporter
                        date={date}
                        enabled={isDayExpanded}
                        onWidthChange={handleDayColumnWidthChange}
                      />
                    ) : null}
                    {!isDayExpanded &&
                    (cellSegments.length > 0 ||
                      collapsedOvernightAnchors.length > 0) ? (
                      <div
                        className="flex w-full min-w-0 flex-1 items-center"
                        style={{ minHeight: PLANNING_CELL_HEIGHT_PX }}
                      >
                        {cellSegments.length > 0 ? collapsedMarkers : null}
                        {collapsedOvernightAnchors.map((span) => (
                          <div
                            key={`overnight-anchor-${span.shift.id}`}
                            data-planning-overnight-span-anchor={span.shift.id}
                            className="ml-auto shrink-0"
                            style={{ width: 1, height: 1 }}
                            aria-hidden
                          />
                        ))}
                      </div>
                    ) : null}

                    {isDayExpanded ? (
                      <div
                        className={cn(
                          "flex min-h-0 flex-1 flex-col",
                          layoutTransitionEnabled &&
                            PLANNING_CELL_CONTENT_TRANSITION_CLASS,
                          "opacity-100"
                        )}
                      >
                        {cellSegments.length > 0 ? (
                          expandedShiftRow
                        ) : hasOvernightSpanOnCell ? (
                          <div
                            aria-hidden
                            className="min-h-0 flex-1"
                            style={{ minHeight: PLANNING_CELL_HEIGHT_PX }}
                          />
                        ) : blockReason === "absent" ? (
                          <div
                            className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-rose-50 text-xs font-medium text-rose-700"
                            style={{ minHeight: PLANNING_CELL_HEIGHT_PX }}
                          >
                            {t("dashboard.cellAbsent")}
                          </div>
                        ) : blockReason === "no_availability" ? (
                          <div
                            className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500"
                            style={{ minHeight: PLANNING_CELL_HEIGHT_PX }}
                          >
                            {t("dashboard.cellNoAvailability")}
                          </div>
                        ) : isPastDay ? (
                          <div
                            aria-hidden
                            className="min-h-0 flex-1"
                            style={{ minHeight: PLANNING_CELL_HEIGHT_PX }}
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={pending || !canAssign || dayReadOnly}
                            onClick={() => onOpenPicker(emp.id, date)}
                            className={cn(
                              "flex min-h-0 w-full flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border text-muted transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-40",
                              picker?.employeeId === emp.id &&
                                picker?.date === date &&
                                !picker?.shiftId &&
                                "border-primary bg-primary/5 text-primary"
                            )}
                            style={{ minHeight: PLANNING_CELL_HEIGHT_PX }}
                          >
                            <span className="text-lg leading-none">+</span>
                            <span className="text-[10px]">
                              {t("dashboard.cellFree")}
                            </span>
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {employeeOvernightSpans.length > 0 ? (
                <DashboardEmployeeRowOvernightOverlay
                  employeeId={emp.id}
                  employeeName={emp.full_name}
                  spans={employeeOvernightSpans}
                  dayColumnCount={dates.length}
                  gridRow={gridRow}
                  layoutActiveDayDates={layoutActiveDayDates}
                  layoutTransitionEnabled={layoutTransitionEnabled}
                  employeeColor={employeeColor}
                  todayISO={todayISO}
                  assignmentPresets={assignmentPresets}
                  shiftJobContextByDate={shiftJobContextByDate}
                  serviceTimelinesByDate={serviceTimelinesByDate}
                  dayReferenceShiftTimesByDate={dayReferenceShiftTimesByDate}
                  pending={pending}
                  selectedShiftId={rowSelectedShiftId}
                  onShiftClick={(shiftId, startDate) =>
                    onOpenPicker(emp.id, startDate, shiftId)
                  }
                  onShiftContextMenu={(shiftId, startDate, event) => {
                    const span = employeeOvernightSpans.find(
                      (entry) => entry.shift.id === shiftId
                    );
                    if (
                      !span ||
                      !canOpenPlanningOvernightShiftContextMenu(span, {
                        todayISO,
                        isDayReadOnly,
                        pastUnconfirmedMenu: {
                          shiftDate: span.shift.shift_date,
                          isPastShiftDate,
                        },
                      })
                    ) {
                      return;
                    }
                    onShiftContextMenu(
                      emp.id,
                      resolvePlanningOvernightShiftContextMenuDate(span, undefined, {
                        todayISO,
                        isDayReadOnly,
                        pastUnconfirmedMenu: {
                          shiftDate: span.shift.shift_date,
                          isPastShiftDate,
                        },
                      }),
                      shiftId,
                      event.clientX,
                      event.clientY
                    );
                  }}
                  highlightedEmployeeId={highlightedEmployeeId}
                />
              ) : null}
            </div>
          );
        })}

        <div
          className={cn(
            "sticky left-0 z-[41] border-t border-slate-400 bg-calendar-active-header",
            PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS
          )}
          style={{
            gridColumn: 1,
            gridRow: footerStatsGridRow,
            height: PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT,
            bottom: PLANNING_DAY_FOOTER_ROW_HEIGHT,
          }}
          aria-hidden
        />

        {dates.map((date, dayIndex) => {
          const mutedFooter = !dayHasServiceHours[dayIndex];
          const footerLabels = dailyFooterLabelsByDate?.get(date);

          return (
            <div
              key={`footer-stats-${date}`}
              data-planning-day-footer-stats={date}
              className={cn(
                "sticky z-40 flex min-h-0 items-center justify-center overflow-hidden border-t border-slate-400",
                mutedFooter ? CALENDAR_DAY_HEADER_MUTED_CLASS : CALENDAR_DAY_HEADER_ACTIVE_CLASS,
                dayHeaderColumnDivider(dayIndex, dates.length)
              )}
              style={{
                gridColumn: dayIndex + 2,
                gridRow: footerStatsGridRow,
                height: PLANNING_DAY_FOOTER_STATS_ROW_HEIGHT,
                bottom: PLANNING_DAY_FOOTER_ROW_HEIGHT,
              }}
            >
              {footerLabels ? (
                <TagAreaFooterStrip
                  label={footerLabels.line}
                  hoursTooltipLine={footerLabels.hoursLine}
                  costTooltipLine={footerLabels.costLine}
                  dayCollapsed={!layoutActiveDayDates.has(date)}
                />
              ) : null}
            </div>
          );
        })}

        {weeklySummary ? (
          <DashboardWeeklySummaryFooter
            summary={weeklySummary}
            locale={locale}
            gridRow={footerGridRow}
            t={t}
          />
        ) : (
          <>
            <div
              className={cn(
                "sticky left-0 bottom-0 z-40 border-t border-slate-400 bg-calendar-active-header",
                PLANNING_HEADER_AREA_COLUMN_BORDER_CLASS
              )}
              style={{
                gridColumn: 1,
                gridRow: footerGridRow,
                height: PLANNING_DAY_FOOTER_ROW_HEIGHT,
              }}
              aria-hidden
            />

            <div
              className="sticky bottom-0 z-40 border-t border-slate-400 bg-calendar-active-header"
              style={{
                gridColumn: "2 / -1",
                gridRow: footerGridRow,
                height: PLANNING_DAY_FOOTER_ROW_HEIGHT,
              }}
              aria-hidden
            />
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export { PLANNING_EMPLOYEE_ROW_HEIGHT, CALENDAR_DAY_HEADER_ROW_HEIGHT };
