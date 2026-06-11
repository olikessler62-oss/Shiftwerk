import { redirect } from "next/navigation";
import {
  startOfWeek,
  toISODate,
  weekDates,
  parseISODate,
} from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { isPastWeek } from "@/lib/planning-readonly";
import {
  resolveSelectedAreaId,
  resolveSelectedLocationId,
} from "@/lib/resolve-dashboard-location";
import { findAreaShiftTemplateByTimes } from "@/lib/dashboard-assignment-presets";
import {
  ShiftPlanner,
  type PlanningShift,
} from "@/components/planning/shift-planner";

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function PlanungPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; location?: string; area?: string }>;
}) {
  const { week, location: locationParam, area: areaParam } = await searchParams;
  const db = await getDatabase();

  const user = await db.authGetUser();
  if (!user) redirect("/login");

  const orgId = await db.getProfileOrganizationId(user.id);
  if (!orgId) redirect("/login");

  const weekStart = week
    ? toISODate(startOfWeek(parseISODate(week)))
    : toISODate(startOfWeek(new Date()));
  const dates = weekDates(weekStart);
  const from = dates[0];
  const to = dates[6];
  const readOnlyWeek = isPastWeek(to);

  const [employees, availability, locations] = await Promise.all([
    db.listActiveEmployees(orgId),
    db.listAvailabilityForWeek(orgId, from, to),
    db.listLocations(orgId),
  ]);

  const selectedLocationId = resolveSelectedLocationId(locations, locationParam);

  const [areas, areaShiftTemplates, serviceHours, shiftRows] = selectedLocationId
    ? await Promise.all([
        db.listLocationAreas(selectedLocationId),
        db
          .listAreaShiftTemplatesWithBreaksForLocation(selectedLocationId)
          .catch(() => []),
        db.listLocationAreaServiceHours(selectedLocationId).catch(() => []),
        db.listDashboardShifts(orgId, from, to, selectedLocationId),
      ])
    : [[], [], [], []];

  const selectedAreaId = resolveSelectedAreaId(areas, areaParam);

  const shifts: PlanningShift[] = [];
  for (const s of shiftRows) {
    if (selectedAreaId && s.location_area_id !== selectedAreaId) continue;

    const template = relation(s.area_shift_templates);
    const startFromTs = s.starts_at
      ? s.starts_at.slice(11, 16)
      : template?.start_time?.slice(0, 5) ?? "00:00";
    const endFromTs = s.ends_at
      ? s.ends_at.slice(11, 16)
      : template?.end_time?.slice(0, 5) ?? "00:00";
    const areaTemplate =
      !template && s.location_area_id
        ? findAreaShiftTemplateByTimes(
            s.location_area_id,
            startFromTs,
            endFromTs,
            areaShiftTemplates
          )
        : null;

    shifts.push({
      id: s.id,
      employee_id: s.employee_id,
      shift_date: s.shift_date,
      shiftName: template?.name ?? areaTemplate?.name ?? "",
      color: template?.color ?? areaTemplate?.color ?? "#64748b",
      startTime: startFromTs,
      endTime: endFromTs,
    });
  }

  return (
    <ShiftPlanner
      weekStart={weekStart}
      dates={dates}
      employees={employees}
      shifts={shifts}
      availability={availability}
      locations={locations}
      selectedLocationId={selectedLocationId}
      areas={areas}
      selectedAreaId={selectedAreaId}
      areaShiftTemplates={areaShiftTemplates}
      serviceHours={serviceHours}
      readOnlyWeek={readOnlyWeek}
    />
  );
}
