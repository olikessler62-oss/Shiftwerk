import { redirect } from "next/navigation";
import {
  startOfWeek,
  toISODate,
  weekDates,
  parseISODate,
} from "@/lib/dates";
import { getDatabase } from "@/lib/db";
import {
  ShiftPlanner,
  type ShiftWithType,
} from "@/components/planning/shift-planner";

export default async function PlanungPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const db = await getDatabase();

  const user = await db.authGetUser();
  if (!user) redirect("/login");

  const orgId = await db.getProfileOrganizationId(user.id);
  if (!orgId) redirect("/login");

  let shiftTypes = await db.listShiftTypes(orgId);

  if (!shiftTypes.length) {
    await db.seedDefaultShiftTypes(orgId);
    shiftTypes = await db.listShiftTypes(orgId);
  }

  const weekStart = week
    ? toISODate(startOfWeek(parseISODate(week)))
    : toISODate(startOfWeek(new Date()));
  const dates = weekDates(weekStart);
  const from = dates[0];
  const to = dates[6];

  const [employees, shifts, availability, orgName] = await Promise.all([
    db.listActiveEmployees(orgId),
    db.listShiftsForWeek(orgId, from, to),
    db.listAvailabilityForWeek(orgId, from, to),
    db.getOrganizationName(orgId),
  ]);

  return (
    <ShiftPlanner
      weekStart={weekStart}
      dates={dates}
      employees={employees}
      shiftTypes={shiftTypes}
      shifts={shifts as ShiftWithType[]}
      availability={availability}
      orgName={orgName ?? "Standort"}
    />
  );
}
