import { redirect } from "next/navigation";
import { AppShell } from "@/components/areacalendar/app-shell";
import { LocaleProvider } from "@/i18n/locale-provider";
import { getServerLocale } from "@/i18n/server";
import { getDatabase } from "@/lib/db";
import { OrgFeaturesProvider } from "@/lib/org-features-provider";
import { SimpleCalendarDisplayProvider } from "@/lib/simple-calendar-display-context";
import { ShiftConfirmationSimulationProvider } from "@/lib/shift-confirmation-simulation-context";
import { loadManagerOrganization } from "@/lib/manager";
import { isSuperadminDeveloperForEmails } from "@/lib/superadmin-access";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

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

  const superadminEnabled = isSuperadminDeveloperForEmails([
    profile.email,
    user.email,
  ]);

  return (
    <LocaleProvider initialLocale={locale}>
      <OrgFeaturesProvider organization={organization}>
        <SimpleCalendarDisplayProvider>
          <ShiftConfirmationSimulationProvider>
            <AppShell
              orgName={organization.name || orgName || undefined}
              userName={profile.full_name}
              role={profile.role}
              superadminEnabled={superadminEnabled}
            >
              {children}
            </AppShell>
          </ShiftConfirmationSimulationProvider>
        </SimpleCalendarDisplayProvider>
      </OrgFeaturesProvider>
    </LocaleProvider>
  );
}
