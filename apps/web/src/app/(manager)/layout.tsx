import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { getDatabase } from "@/lib/db";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = await getDatabase();
  const user = await db.authGetUser();

  if (!user) redirect("/login");

  const profile = await db.getProfileById(user.id);

  if (!profile || profile.role === "employee") redirect("/app-only");

  const orgName = await db.getOrganizationName(profile.organization_id);

  return (
    <AppShell
      orgName={orgName ?? undefined}
      userName={profile.full_name}
      role={profile.role}
    >
      {children}
    </AppShell>
  );
}
