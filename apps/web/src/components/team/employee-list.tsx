"use client";

import { useTransition } from "react";
import { deactivateEmployee } from "@/app/actions/team";
import type { Profile } from "@schichtwerk/types";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function EmployeeList({ employees }: { employees: Profile[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (employees.length === 0) {
    return (
      <p className="text-sm text-muted">Noch keine Mitarbeiter eingeladen.</p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {employees.map((emp) => (
        <li
          key={emp.id}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div>
            <p className="font-medium">{emp.full_name}</p>
            <p className="text-sm text-muted">{emp.email}</p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (
                  confirm(
                    `${emp.full_name} wirklich deaktivieren? Bestehende Schichten bleiben erhalten.`
                  )
                ) {
                  await deactivateEmployee(emp.id);
                  router.refresh();
                }
              })
            }
          >
            Deaktivieren
          </Button>
        </li>
      ))}
    </ul>
  );
}
