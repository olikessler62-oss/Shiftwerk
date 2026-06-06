import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Passwort vergessen</h1>
          <p className="mt-1 text-sm text-muted">
            Wir senden dir einen Link zum Zurücksetzen deines Passworts.
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

        <form action={requestPasswordReset} className="space-y-4">
          <Field label="E-Mail" htmlFor="email">
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Button type="submit" className="w-full">
            Link senden
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-primary">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </div>
  );
}
