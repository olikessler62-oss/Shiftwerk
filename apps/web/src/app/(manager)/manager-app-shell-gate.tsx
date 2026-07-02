import { redirect } from "next/navigation";
import { AppShell } from "@/components/areacalendar/app-shell";
import { LocaleProvider } from "@/i18n/locale-provider";
import { getServerLocale } from "@/i18n/server";
import { OrgFeaturesProvider } from "@/lib/org-features-provider";
import { SimpleCalendarDisplayProvider } from "@/lib/simple-calendar-display-context";
import { ShiftConfirmationSimulationProvider } from "@/lib/shift-confirmation-simulation-context";
import { getManagerSession } from "@/lib/server-manager-session";
import { isSuperadminDeveloperForEmails } from "@/lib/superadmin-access";

export async function ManagerAppShellGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getManagerSession();

  if (!session) redirect("/login");

  const { user, profile, organization } = session;

  if (profile.role === "basic") redirect("/app-only");

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
              orgName={organization.name || undefined}
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
