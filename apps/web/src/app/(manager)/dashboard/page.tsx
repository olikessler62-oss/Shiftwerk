import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  toISODate,
  weekDates,
  shiftTimeFromTimestamp,
} from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { loadManagerOrganization } from "@/lib/manager";
import { resolveSelectedLocationId } from "@/lib/resolve-dashboard-location";
import { findAreaShiftTemplateByTimes } from "@/lib/dashboard-assignment-presets";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { DashboardShiftCard } from "@/components/dashboard/dashboard-calendar";
import { resolveOrganizationTimeZone } from "@schichtwerk/database";
import { redirectIfPlanningWeekClamped } from "@/lib/planning-week";
import { getCachedDashboardShifts } from "@/lib/cached-dashboard-shifts";
import { loadDashboardShiftCompensation } from "@/lib/load-dashboard-shift-compensation";

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
  const {
    week,
    location: locationParam,
    qualifikationen,
    standorte,
    profiles: profilesParam,
    rollen,
  } = await searchParams;
  const db = await getDatabase();
  const user = await db.authGetUser();
  if (!user) redirect("/login");

  const orgId = await db.getProfileOrganizationId(user.id);
  if (!orgId) redirect("/login");

  const orgName = await db.getOrganizationName(orgId);
  const organization = await loadManagerOrganization(orgId, orgName);
  const managerNotifications = organization.shift_confirmation_enabled
    ? await db.listManagerNotificationsForRecipient(user.id, { limit: 50 })
    : [];
  const timeZone = resolveOrganizationTimeZone(organization);

  const weekStart = redirectIfPlanningWeekClamped("/dashboard", week, {
    week,
    location: locationParam,
    qualifikationen,
    standorte,
    profiles: profilesParam,
    rollen,
  });
  const dates = weekDates(weekStart);
  const from = dates[0];
  const to = dates[6];

  let [qualifications, compensationSurchargeTypes, roles, profiles, locations, profileQualificationIdsMap] =
    await Promise.all([
      db.listQualifications(orgId),
      db.listCompensationSurchargeTypes(orgId),
      db.listRoles(orgId),
      db.listOrganizationProfiles(orgId),
      db.listLocationsForDashboard(orgId, from, to),
      db.listProfileQualificationIdsByOrganization(orgId),
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
        getCachedDashboardShifts(
          orgId,
          selectedLocationId,
          weekStart,
          from,
          to
        ),
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
      ? shiftTimeFromTimestamp(s.starts_at, timeZone)
      : template?.start_time?.slice(0, 5) ?? "00:00";
    const endFromTs = s.ends_at
      ? shiftTimeFromTimestamp(s.ends_at, timeZone)
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
      confirmationStatus: s.confirmation_status,
    });
  }

  const profileQualificationIds = Object.fromEntries(profileQualificationIdsMap);

  const shiftCompensation =
    cards.length > 0
      ? await loadDashboardShiftCompensation(db, orgId, cards)
      : {};

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
        profileQualificationIds={profileQualificationIds}
        shiftCompensation={shiftCompensation}
        locations={locations}
        managerNotifications={managerNotifications}
      />
    </Suspense>
  );
}
