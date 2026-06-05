"use client";

import { Button } from "@/components/ui";

export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        Seite konnte nicht geladen werden
      </h1>
      <p className="max-w-lg text-sm text-muted">
        {error.message ||
          "Ein unerwarteter Fehler ist aufgetreten. Prüfen Sie, ob alle Datenbank-Migrationen in Supabase ausgeführt wurden."}
      </p>
      <Button type="button" variant="primary" onClick={() => reset()}>
        Erneut versuchen
      </Button>
    </div>
  );
}
