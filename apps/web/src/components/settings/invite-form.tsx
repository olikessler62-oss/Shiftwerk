"use client";

import { useActionState, useEffect } from "react";
import {
  inviteEmployee,
  type TeamActionResult,
} from "@/app/actions/team";
import { Alert, Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

const initial: TeamActionResult | null = null;

type Props = {
  employeeCount: number;
  embedded?: boolean;
  onSuccess?: () => void;
};

export function InviteForm({ employeeCount, embedded = false, onSuccess }: Props) {
  const [state, formAction, pending] = useActionState(inviteEmployee, initial);

  useEffect(() => {
    if (state?.ok === true) onSuccess?.();
  }, [onSuccess, state]);

  return (
    <div
      className={cn(
        embedded ? "p-0" : "rounded-2xl border border-border bg-surface p-6"
      )}
    >
      {!embedded ? (
        <h2 className="text-lg font-medium">Personal einladen</h2>
      ) : null}
      <p className={cn("text-sm text-muted", embedded ? "" : "mt-1")}>
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

      <form action={formAction} className="mt-4 space-y-3" autoComplete="off">
        <Field label="Name" htmlFor="fullName">
          <Input
            id="fullName"
            name="fullName"
            required
            placeholder="Max Mustermann"
            autoComplete="off"
          />
        </Field>
        <Field label="E-Mail" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="max@beispiel.de"
            autoComplete="off"
          />
        </Field>
        <Button type="submit" disabled={pending || employeeCount >= 20}>
          {pending ? "Wird gesendet…" : "Einladung senden"}
        </Button>
      </form>
    </div>
  );
}
