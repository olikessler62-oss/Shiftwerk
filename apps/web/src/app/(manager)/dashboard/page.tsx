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
    schichtarten?: string;
    qualifikationen?: string;
    standorte?: string;
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

  const [shiftTypes, qualifications, locations] = await Promise.all([
    db.loadShiftTypesWithBreaks(orgId),
    db.listQualifications(orgId),
    db.listLocationsForDashboard(orgId, from, to),
  ]);

  const selectedLocationId = resolveSelectedLocationId(locations, locationParam);
  const selectedLocation =
    locations.find((l) => l.id === selectedLocationId) ?? null;

  const [areas, staffingRules, shiftRows] = selectedLocationId
    ? await Promise.all([
        db.listLocationAreasForDashboard(selectedLocationId, from, to),
        db.listLocationAreaStaffing(selectedLocationId),
        db.listDashboardShifts(orgId, from, to, selectedLocationId),
      ])
    : [[], [], []];

  const cards: DashboardShiftCard[] = [];
  for (const s of shiftRows) {
    const type = relation(s.shift_types);
    if (!type) continue;
    const profile = relation(s.profiles);
    cards.push({
      id: s.id,
      shift_date: s.shift_date,
      locationAreaId: s.location_area_id,
      shiftName: type.name,
      color: type.color,
      startTime: type.start_time,
      endTime: type.end_time,
      employeeName: profile?.full_name ?? "Unbekannt",
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
        shifts={cards}
        shiftTypes={shiftTypes}
        qualifications={qualifications}
        locations={locations}
      />
    </Suspense>
  );
}
