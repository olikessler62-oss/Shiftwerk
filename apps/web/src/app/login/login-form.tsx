"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "@/app/actions/auth";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

function useBodyWaitCursor(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "wait";
    document.documentElement.style.cursor = "wait";
    return () => {
      document.body.style.cursor = previous;
      document.documentElement.style.cursor = "";
    };
  }, [active]);
}

function LoginFormFields() {
  const { pending } = useFormStatus();
  useBodyWaitCursor(pending);

  return (
    <div
      className={cn(
        "space-y-4",
        pending && "cursor-wait [&_*]:cursor-wait"
      )}
      aria-busy={pending}
    >
    <Field label="E-Mail" htmlFor="email">
      <Input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        disabled={pending}
      />
    </Field>
    <Field label="Passwort" htmlFor="password">
      <Input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        disabled={pending}
      />
    </Field>
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Anmelden…" : "Anmelden"}
    </Button>
    </div>
  );
}

export function LoginForm() {
  return (
    <form action={signIn}>
      <LoginFormFields />
    </form>
  );
}
