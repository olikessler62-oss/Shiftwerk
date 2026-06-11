import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  startOfWeek,
  toISODate,
  weekDates,
  parseISODate,
} from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { resolveSelectedLocationId } from "@/lib/resolve-dashboard-location";
import { findAreaShiftTemplateByTimes } from "@/lib/dashboard-assignment-presets";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-calendar";

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    qualifikationen?: string;
    standorte?: string;
    profiles?: string;
    rollen?: string;
    location?: string;
  }>;
}) {
  const { week, location: locationParam } = await searchParams;
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

  let [qualifications, compensationSurchargeTypes, roles, profiles, locations] =
    await Promise.all([
      db.listQualifications(orgId),
      db.listCompensationSurchargeTypes(orgId),
      db.listRoles(orgId),
      db.listOrganizationProfiles(orgId),
      db.listLocationsForDashboard(orgId, from, to),
    ]);

  if (!roles.length) {
    await db.seedDefaultRoles(orgId);
    roles = await db.listRoles(orgId);
  }

  const selectedLocationId = resolveSelectedLocationId(locations, locationParam);
  const selectedLocation =
    locations.find((l) => l.id === selectedLocationId) ?? null;

  const [areas, staffingRules, serviceHours, shiftRows, areaShiftTemplates] =
    selectedLocationId
    ? await Promise.all([
        db.listLocationAreasForDashboard(selectedLocationId, from, to),
        db.listLocationAreaStaffing(selectedLocationId),
        db.listLocationAreaServiceHours(selectedLocationId).catch(() => []),
        db.listDashboardShifts(orgId, from, to, selectedLocationId),
        db.listAreaShiftTemplatesWithBreaksForLocation(selectedLocationId).catch(
          () => []
        ),
      ])
    : [[], [], [], [], []];

  const cards: DashboardShiftCard[] = [];
  for (const s of shiftRows) {
    const template = relation(s.area_shift_templates);
    const profile = relation(s.profiles);
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

    cards.push({
      id: s.id,
      shift_date: s.shift_date,
      locationAreaId: s.location_area_id,
      areaShiftTemplateId: s.area_shift_template_id,
      employeeId: s.employee_id,
      shiftName: template?.name ?? areaTemplate?.name ?? "",
      color: template?.color ?? areaTemplate?.color ?? profile?.color ?? "#64748b",
      startTime: startFromTs,
      endTime: endFromTs,
      employeeName: profile?.full_name ?? "Unbekannt",
      employeeColor: profile?.color ?? null,
    });
  }

  return (
    <Suspense fallback={<div className="-m-6 p-6 text-sm text-muted">Laden…</div>}>
      <DashboardView
        weekStart={weekStart}
        dates={dates}
        selectedLocationId={selectedLocationId}
        selectedLocation={selectedLocation}
        areas={areas}
        staffingRules={staffingRules}
        fullStaffingRules={staffingRules}
        serviceHours={serviceHours}
        shifts={cards}
        areaShiftTemplates={areaShiftTemplates}
        qualifications={qualifications}
        compensationSurchargeTypes={compensationSurchargeTypes}
        roles={roles}
        profiles={profiles}
        locations={locations}
      />
    </Suspense>
  );
}
