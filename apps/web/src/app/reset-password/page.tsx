import Link from "next/link";
import { updatePassword } from "@/app/actions/auth";
import { getDatabase } from "@/lib/db";
import { Alert, Button, Field, Input } from "@/components/ui";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const db = await getDatabase();
  const user = await db.authGetUser();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold">Link ungültig</h1>
            <p className="mt-2 text-sm text-muted">
              Der Link zum Zurücksetzen ist abgelaufen oder wurde bereits verwendet.
            </p>
          </div>
          <p className="text-center text-sm text-muted">
            <Link href="/forgot-password" className="font-medium text-primary">
              Neuen Link anfordern
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Neues Passwort</h1>
          <p className="mt-1 text-sm text-muted">Bitte wähle ein neues Passwort für dein Konto.</p>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {decodeURIComponent(error)}
          </Alert>
        )}

        <form action={updatePassword} className="space-y-4">
          <Field label="Neues Passwort" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Passwort bestätigen" htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" className="w-full">
            Passwort speichern
          </Button>
        </form>
      </div>
    </div>
  );
}
