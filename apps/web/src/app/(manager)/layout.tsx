import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { LocaleProvider } from "@/i18n/locale-provider";
import { getServerLocale } from "@/i18n/server";
import { getDatabase } from "@/lib/db";
import { OrgFeaturesProvider } from "@/lib/org-features-provider";
import { loadManagerOrganization } from "@/lib/manager";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = await getDatabase();
  const user = await db.authGetUser();

  if (!user) redirect("/login");

  const profile = await db.getProfileById(user.id);

  if (!profile || profile.role === "basic") redirect("/app-only");

  const orgName = await db.getOrganizationName(profile.organization_id);
  const organization = await loadManagerOrganization(
    profile.organization_id,
    orgName
  );
  const locale = await getServerLocale();

  return (
    <LocaleProvider initialLocale={locale}>
      <OrgFeaturesProvider organization={organization}>
        <AppShell
          orgName={organization.name || orgName || undefined}
          userName={profile.full_name}
          role={profile.role}
        >
          {children}
        </AppShell>
      </OrgFeaturesProvider>
    </LocaleProvider>
  );
}
