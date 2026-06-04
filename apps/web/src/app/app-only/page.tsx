export default function AppOnlyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Schichtwerk App</h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          Als Mitarbeiter nutzt du bitte die Schichtwerk-App für iOS oder
          Android. Der Web-Zugang ist nur für Inhaber und Schicht-Manager
          vorgesehen.
        </p>
        <p className="mt-6 text-xs text-muted">
          Hast du ein Manager-Konto? Melde dich mit der richtigen Rolle an oder
          wende dich an deinen Arbeitgeber.
        </p>
      </div>
    </div>
  );
}
