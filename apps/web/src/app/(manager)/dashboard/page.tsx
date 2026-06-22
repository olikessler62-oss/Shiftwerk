import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/server-manager-session";
import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";
import { DashboardLoadingSkeleton } from "@/components/dashboard/dashboard-loading-skeleton";

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
    <Suspense fallback={<DashboardLoadingSkeleton />}>
      <DashboardPageContent params={params} />
    </Suspense>
  );
}
