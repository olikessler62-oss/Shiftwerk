import { redirect } from "next/navigation";
import { InviteForm } from "@/components/team/invite-form";
import { EmployeeList } from "@/components/team/employee-list";
import { getDatabase } from "@/lib/db";

export default async function TeamPage() {
  const db = await getDatabase();
  const user = await db.authGetUser();
  if (!user) redirect("/login");

  const orgId = await db.getProfileOrganizationId(user.id);
  if (!orgId) redirect("/login");

  const list = await db.listActiveEmployees(orgId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-1 text-sm text-muted">
          Mitarbeiter einladen — sie erhalten eine E-Mail und nutzen die App.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <InviteForm employeeCount={list.length} />
        <div>
          <h2 className="mb-3 text-lg font-medium">Aktive Mitarbeiter</h2>
          <EmployeeList employees={list} />
        </div>
      </div>
    </div>
  );
}
