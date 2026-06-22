import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/server-manager-session";
import { DashboardCalendarProvider } from "@/components/dashboard/dashboard-calendar-context";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { DashboardCalendarLayer } from "@/components/dashboard/dashboard-calendar-layer";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
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

  return (
    <DashboardCalendarProvider>
      <DashboardPageShell params={params} />
      <Suspense fallback={null}>
        <DashboardCalendarLayer params={params} />
      </Suspense>
    </DashboardCalendarProvider>
  );
}
