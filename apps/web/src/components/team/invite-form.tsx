"use client";

import { useActionState } from "react";
import {
  inviteEmployee,
  type TeamActionResult,
} from "@/app/actions/team";
import { Alert, Button, Field, Input } from "@/components/ui";

const initial: TeamActionResult | null = null;

export function InviteForm({ employeeCount }: { employeeCount: number }) {
  const [state, formAction, pending] = useActionState(inviteEmployee, initial);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-lg font-medium">Mitarbeiter einladen</h2>
      <p className="mt-1 text-sm text-muted">
        {employeeCount}/20 aktiv · Einladung per E-Mail (App-Login)
      </p>

      {state?.ok === false && (
        <Alert variant="error" className="mt-3">
          {state.error}
        </Alert>
      )}
      {state?.ok === true && (
        <Alert variant="success" className="mt-3">
          {state.message}
        </Alert>
      )}

      <form action={formAction} className="mt-4 space-y-3">
        <Field label="Name" htmlFor="fullName">
          <Input id="fullName" name="fullName" required placeholder="Max Mustermann" />
        </Field>
        <Field label="E-Mail" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="max@beispiel.de"
          />
        </Field>
        <Button type="submit" disabled={pending || employeeCount >= 20}>
          {pending ? "Wird gesendet…" : "Einladung senden"}
        </Button>
      </form>
    </div>
  );
}
