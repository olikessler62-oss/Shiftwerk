import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  weekDates,
  shiftTimeFromTimestamp,
} from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { loadManagerOrganization } from "@/lib/manager";
import { resolveSelectedLocationId } from "@/lib/resolve-areacalendar-location";
import { findAreaShiftTemplateByTimes } from "@/lib/areacalendar-assignment-presets";
import { AreaCalendarView } from "@/components/areacalendar/areacalendar-view";
import type { AreaCalendarShiftCard } from "@/components/areacalendar/areacalendar-calendar";
import { resolveOrganizationTimeZone } from "@schichtwerk/database";
import { mapAreaCalendarShiftRowConfirmationFields } from "@/lib/area-calendar-shift-row-mapper";
import { redirectIfPlanningWeekClamped } from "@/lib/planning-week";
import { getCachedAreaCalendarShifts } from "@/lib/cached-areacalendar-shifts";
import { mapSwapRequestsToCommunicationRows } from "@/lib/communication-hub-data";

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function BereichKalenderPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    qualifikationen?: string;
    standorte?: string;
    profiles?: string;
    rollen?: string;
    location?: string;
    area?: string;
  }>;
}) {
  const {
    week,
    location: locationParam,
    qualifikationen,
    standorte,
    profiles: profilesParam,
    rollen,
    area: areaParam,
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

  const weekStart = redirectIfPlanningWeekClamped("/bereich-kalender", week, {
    week,
    location: locationParam,
    area: areaParam,
    qualifikationen,
    standorte,
    profiles: profilesParam,
    rollen,
  });
  const dates = weekDates(weekStart);
  const from = dates[0];
  const to = dates[6];

  let [
    qualifications,
    compensationSurchargeTypes,
    roles,
    profiles,
    locations,
    profileQualificationIdsMap,
    absences,
    recurringAvailability,
  ] = await Promise.all([
    db.listQualifications(orgId),
    db.listCompensationSurchargeTypes(orgId),
    db.listRoles(orgId),
    db.listOrganizationProfiles(orgId),
    db.listLocationsForAreaCalendar(orgId, from, to),
    db.listProfileQualificationIdsByOrganization(orgId),
    db.listOrganizationAbsences(orgId, { statuses: ["approved"] }),
    db.listOrganizationRecurringAvailability(orgId),
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
        db.listLocationAreasForAreaCalendar(selectedLocationId, from, to),
        db.listLocationAreaStaffing(selectedLocationId),
        db.listLocationAreaServiceHours(selectedLocationId).catch(() => []),
        getCachedAreaCalendarShifts(
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

  const cards: AreaCalendarShiftCard[] = [];
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

    const confirmationFields = mapAreaCalendarShiftRowConfirmationFields(s);

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
      confirmationStatus: confirmationFields.confirmationStatus,
      requestedAt: confirmationFields.requestedAt,
      confirmationStatusUpdatedAt: confirmationFields.confirmationStatusUpdatedAt,
      displayState: confirmationFields.displayState,
    });
  }

  const profileQualificationIds = Object.fromEntries(profileQualificationIdsMap);

  const canceledShiftIds = cards
    .filter((shift) => shift.confirmationStatus === "canceled")
    .filter((shift) => !shift.displayState?.openCancellation?.cancelledBy)
    .map((shift) => shift.id);

  const [swapRequestRows, cancelActorEntries] =
    selectedLocationId && organization.shift_confirmation_enabled
      ? await Promise.all([
          db.listOrganizationSwapRequests(orgId, {
            statuses: ["pending"],
            locationId: selectedLocationId,
            from,
            to,
          }),
          db.listShiftCancelActors(orgId, canceledShiftIds),
        ])
      : [[], new Map<string, "employee" | "manager">()];

  const communicationSwapRequests = mapSwapRequestsToCommunicationRows(
    swapRequestRows,
    timeZone
  );

  return (
    <Suspense fallback={<div className="-m-6 p-6 text-sm text-muted">Laden…</div>}>
      <AreaCalendarView
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
        locations={locations}
        absences={absences}
        recurringAvailability={recurringAvailability}
        communicationSwapRequests={communicationSwapRequests}
        communicationCancelActors={Object.fromEntries(cancelActorEntries)}
        managerNotifications={managerNotifications}
      />
    </Suspense>
  );
}
