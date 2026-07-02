"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "@/app/actions/auth";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { markPlanningPostLoginPending } from "@/lib/planning-post-login-pending";
import { useBodyWaitCursor } from "@/lib/use-body-wait-cursor";

function LoginFormFields({ submitting }: { submitting: boolean }) {
  const { pending } = useFormStatus();
  const busy = submitting || pending;
  useBodyWaitCursor(busy);

  return (
    <div
      className={cn("space-y-4", busy && "cursor-wait [&_*]:cursor-wait")}
      aria-busy={busy}
    >
      <Field label="E-Mail" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={busy}
        />
      </Field>
      <Field label="Passwort" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          disabled={busy}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Anmelden…" : "Anmelden"}
      </Button>
    </div>
  );
}

export function LoginForm() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={signIn}
      onSubmit={() => {
        setSubmitting(true);
        markPlanningPostLoginPending();
      }}
    >
      <LoginFormFields submitting={submitting} />
    </form>
  );
}
