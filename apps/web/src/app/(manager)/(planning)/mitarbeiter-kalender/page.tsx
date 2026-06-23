import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/server-manager-session";
import { EmployeeCalendarPage } from "@/components/dashboard/employee-calendar-page";

export const dynamic = "force-dynamic";

export default async function MitarbeiterKalenderPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    location?: string;
    area?: string;
    standorte?: string;
    profiles?: string;
    rollen?: string;
    qualifikationen?: string;
    sonderzuschlaege?: string;
    abwesenheiten?: string;
    superadmin?: string;
  }>;
}) {
  const session = await getManagerSession();
  if (!session) redirect("/login");

  const params = await searchParams;

  return <EmployeeCalendarPage params={params} />;
}
