import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Schichtwerk</h1>
          <p className="mt-1 text-sm text-muted">
            Anmeldung für Inhaber und Schicht-Manager
          </p>
        </div>

        {message && (
          <Alert variant="info" className="mb-4">
            {decodeURIComponent(message)}
          </Alert>
        )}

        {error && (
          <Alert variant="error" className="mb-4">
            {decodeURIComponent(error)}
          </Alert>
        )}

        <form action={signIn} className="space-y-4">
          <Field label="E-Mail" htmlFor="email">
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Passwort" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" className="w-full">
            Anmelden
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Noch kein Konto?{" "}
          <Link href="/register" className="font-medium text-primary">
            Betrieb registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
