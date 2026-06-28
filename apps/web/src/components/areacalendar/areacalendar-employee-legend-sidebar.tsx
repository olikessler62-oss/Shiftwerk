"use client";

import { useMemo } from "react";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-shift-card-view";
import { AreaCalendarEmployeeLegendCard } from "@/components/areacalendar/areacalendar-employee-legend-card";
import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-modal-shell";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  collectWeekLegendEmployeesFromAreaCalendarShifts,
  AREA_CALENDAR_EMPLOYEE_LIST_WIDTH_PX,
  AREA_CALENDAR_EMPLOYEE_LIST_TOP_OFFSET_PX,
} from "@/lib/areacalendar-week-employee-legend";
import { PlanningEmployeeAvailabilityTooltipContent } from "@/components/planning/planning-employee-availability-tooltip-content";
import {
  groupRecurringAvailabilityByProfileId,
  resolvePlanningEmployeeJobsTooltipLabel,
} from "@/lib/planning-employee-availability-tooltip";
import { createPlanningShiftJobContextMaps } from "@/lib/planning-shift-card-display";
import { SHIFT_CARD_LIST_GAP_PX } from "@/lib/shift-card-row-layout";
import {
  buildAreaIdToLocationIdMap,
  buildEmployeeWeeklyHoursDisplay,
  buildEmployeeWeeklyHoursCardLabelsByEmployeeId,
  buildEmployeeWeeklyHoursDisplayByEmployeeId,
  buildLocationNameByIdMap,
} from "@/lib/employee-weekly-hours-display";
import type { PlanningShift } from "@/lib/planning-shift-card";
import type {
  AbsenceRequest,
  Location,
  LocationArea,
  Profile,
  ProfileRecurringAvailability,
  Qualification,
} from "@schichtwerk/types";

type Props = {
  shifts: readonly AreaCalendarShiftCard[];
  profiles: readonly Profile[];
  absences?: readonly AbsenceRequest[];
  recurringAvailability?: readonly ProfileRecurringAvailability[];
  qualifications?: readonly Qualification[];
  profileQualificationIds?: Record<string, string[]>;
  locale: string;
  employeeHoursLabel: string;
  weekDates: readonly string[];
  selectedLocationId: string | null;
  areas: readonly LocationArea[];
  locations: readonly Location[];
  organizationWeekShifts?: readonly PlanningShift[];
  onEmployeeHover?: (employeeId: string | null) => void;
  onEmployeeContextMenu?: (
    employeeId: string,
    clientX: number,
    clientY: number
  ) => void;
  className?: string;
};

export function AreaCalendarEmployeeLegendSidebar({
  shifts,
  profiles,
  absences = [],
  recurringAvailability = [],
  qualifications = [],
  profileQualificationIds = {},
  locale,
  employeeHoursLabel,
  weekDates,
  selectedLocationId,
  areas,
  locations,
  organizationWeekShifts = [],
  onEmployeeHover,
  onEmployeeContextMenu,
  className,
}: Props) {
  const t = useTranslations();
  const employees = useMemo(
    () =>
      collectWeekLegendEmployeesFromAreaCalendarShifts(
        shifts,
        profiles,
        absences
      ),
    [shifts, profiles, absences]
  );
  const availabilityByProfileId = useMemo(
    () => groupRecurringAvailabilityByProfileId(recurringAvailability),
    [recurringAvailability]
  );
  const qualificationMaps = useMemo(
    () => createPlanningShiftJobContextMaps(qualifications),
    [qualifications]
  );
  const locationNameById = useMemo(
    () => buildLocationNameByIdMap(locations),
    [locations]
  );
  const areaIdToLocationId = useMemo(
    () => buildAreaIdToLocationIdMap(areas),
    [areas]
  );
  const weeklyHoursShifts = useMemo(
    () =>
      organizationWeekShifts.length > 0 ? organizationWeekShifts : shifts.map(
          (shift) => ({
            employee_id: shift.employeeId,
            shift_date: shift.shift_date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            location_id: selectedLocationId,
            location_area_id: shift.locationAreaId,
          })
        ),
    [organizationWeekShifts, shifts, selectedLocationId]
  );
  const weeklyHoursTooltipDisplayByEmployeeId = useMemo(
    () =>
      buildEmployeeWeeklyHoursDisplayByEmployeeId({
        employees,
        shifts: weeklyHoursShifts,
        weekDates,
        locationNameById,
        areaIdToLocationId,
        fallbackLocationId: selectedLocationId,
      }),
    [
      employees,
      weeklyHoursShifts,
      weekDates,
      locationNameById,
      areaIdToLocationId,
      selectedLocationId,
    ]
  );
  const weeklyHoursCardLabelsByEmployeeId = useMemo(
    () =>
      buildEmployeeWeeklyHoursCardLabelsByEmployeeId({
        employees,
        shifts: weeklyHoursShifts,
        weekDates,
        locale,
        locationNameById,
        areaIdToLocationId,
        fallbackLocationId: selectedLocationId,
      }),
    [
      employees,
      weeklyHoursShifts,
      weekDates,
      locale,
      locationNameById,
      areaIdToLocationId,
      selectedLocationId,
    ]
  );
  const weeklyHoursOverLimitByEmployeeId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const employee of employees) {
      const display = buildEmployeeWeeklyHoursDisplay({
        employeeId: employee.id,
        shifts: weeklyHoursShifts,
        weekDates,
        targetHours: employee.weekly_hours ?? 40,
        locationNameById,
        areaIdToLocationId,
        fallbackLocationId: selectedLocationId,
      });
      map.set(employee.id, display.totalHours > display.targetHours);
    }
    return map;
  }, [
    employees,
    weeklyHoursShifts,
    weekDates,
    locationNameById,
    areaIdToLocationId,
    selectedLocationId,
  ]);
  const availabilityTooltipLocale = locale === "en" ? "en" : "de";
  const emptyAvailabilityTooltipLabel = t("profiles.emptyAvailability");
  const showEmployeeJobs = qualifications.length > 0;

  if (employees.length === 0) {
    return null;
  }

  return (
    <aside
      className={cn(
        "relative z-10 box-border flex h-full min-h-0 shrink-0 flex-col overflow-visible",
        className
      )}
      style={{
        width: AREA_CALENDAR_EMPLOYEE_LIST_WIDTH_PX,
        marginTop: AREA_CALENDAR_EMPLOYEE_LIST_TOP_OFFSET_PX,
      }}
    >
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto pb-1",
          MODAL_SCROLLBAR_CLASS
        )}
      >
        <div
          className="flex flex-col"
          style={{ gap: SHIFT_CARD_LIST_GAP_PX }}
        >
          {employees.map((employee) => {
            const weeklyHoursCardLabel =
              weeklyHoursCardLabelsByEmployeeId.get(employee.id) ?? "—";
            const weeklyHoursTooltipDisplay =
              weeklyHoursTooltipDisplayByEmployeeId.get(employee.id) ?? null;
            const displayCardLabel = `${employeeHoursLabel} ${weeklyHoursCardLabel}`;
            const overHours =
              weeklyHoursOverLimitByEmployeeId.get(employee.id) ?? false;

            return (
              <AreaCalendarEmployeeLegendCard
                key={employee.id}
                employee={employee}
                weeklyHoursCardLabel={displayCardLabel}
                overHours={overHours}
                availabilityTooltip={
                  <PlanningEmployeeAvailabilityTooltipContent
                    slots={availabilityByProfileId.get(employee.id) ?? []}
                    employeeName={employee.full_name}
                    locale={availabilityTooltipLocale}
                    emptyLabel={emptyAvailabilityTooltipLabel}
                    jobsLabel={
                      showEmployeeJobs
                        ? resolvePlanningEmployeeJobsTooltipLabel(
                            employee.id,
                            profileQualificationIds,
                            qualificationMaps.qualificationNameById,
                            qualificationMaps.qualificationSortOrder
                          )
                        : undefined
                    }
                    weeklyHoursDisplay={weeklyHoursTooltipDisplay}
                    weeklyHoursTotalLabel={t("dashboard.weeklyHoursTotalLabel")}
                  />
                }
                onMouseEnter={() => onEmployeeHover?.(employee.id)}
                onMouseLeave={() => onEmployeeHover?.(null)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onEmployeeContextMenu?.(employee.id, event.clientX, event.clientY);
                }}
              />
            );
          })}
        </div>
      </div>
    </aside>
  );
}
