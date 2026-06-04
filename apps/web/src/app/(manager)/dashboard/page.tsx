import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  startOfWeek,
  toISODate,
  weekDates,
  parseISODate,
} from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import {
  DASHBOARD_AREAS,
  type DashboardShiftCard,
} from "@/components/dashboard/dashboard-calendar";

function areaForEmployee(employeeId: string): (typeof DASHBOARD_AREAS)[number] {
  let hash = 0;
  for (let i = 0; i < employeeId.length; i++) {
    hash = employeeId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DASHBOARD_AREAS[Math.abs(hash) % DASHBOARD_AREAS.length];
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; schichtarten?: string }>;
}) {
  const { week } = await searchParams;
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

  const [shiftRows, orgName, shiftTypes] = await Promise.all([
    db.listDashboardShifts(orgId, from, to),
    db.getOrganizationName(orgId),
    db.loadShiftTypesWithBreaks(orgId),
  ]);

  const cards: DashboardShiftCard[] = [];
  for (const s of shiftRows) {
    const type = relation(s.shift_types);
    if (!type) continue;
    const profile = relation(s.profiles);
    cards.push({
      id: s.id,
      shift_date: s.shift_date,
      area: areaForEmployee(s.employee_id),
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
        orgName={orgName ?? "Standort"}
        shifts={cards}
        shiftTypes={shiftTypes}
      />
    </Suspense>
  );
}
