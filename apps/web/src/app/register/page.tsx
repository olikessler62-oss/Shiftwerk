import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Betrieb anlegen</h1>
          <p className="mt-1 text-sm text-muted">
            Erstelle dein Team (bis 20 Mitarbeiter)
          </p>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {decodeURIComponent(error)}
          </Alert>
        )}

        <form action={signUp} className="space-y-4">
          <Field label="Betriebsname" htmlFor="orgName">
            <Input id="orgName" name="orgName" required placeholder="z. B. Café Sonnenschein" />
          </Field>
          <Field label="Dein Name" htmlFor="fullName">
            <Input id="fullName" name="fullName" required />
          </Field>
          <Field label="E-Mail" htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field label="Passwort" htmlFor="password">
            <Input id="password" name="password" type="password" required minLength={8} />
          </Field>
          <Button type="submit" className="w-full">
            Konto erstellen
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Bereits registriert?{" "}
          <Link href="/login" className="font-medium text-primary">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
