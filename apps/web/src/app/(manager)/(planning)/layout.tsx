import { getManagerSession } from "@/lib/server-manager-session";
import { getCachedOrgLocations } from "@/lib/cached-org-data";
import { PlanningPagesShell } from "@/components/planning/planning-pages-shell";

export default async function PlanningPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getManagerSession();
  if (!session) {
    return children;
  }

  const locations = await getCachedOrgLocations(session.organizationId);

  return <PlanningPagesShell locations={locations}>{children}</PlanningPagesShell>;
}
