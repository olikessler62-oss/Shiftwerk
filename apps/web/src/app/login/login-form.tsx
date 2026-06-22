"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "@/app/actions/auth";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

function useBodyWaitCursor(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previousBody = document.body.style.cursor;
    const previousHtml = document.documentElement.style.cursor;
    document.body.style.cursor = "wait";
    document.documentElement.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previousBody;
      document.documentElement.style.cursor = previousHtml;
    };
  }, [active]);
}

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
      onSubmit={() => setSubmitting(true)}
    >
      <LoginFormFields submitting={submitting} />
    </form>
  );
}
