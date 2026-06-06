import Link from "next/link";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/planung", label: "Planung" },
  { href: "/abwesenheiten", label: "Abwesenheiten" },
  { href: "/berichte", label: "Berichte" },
  { href: "/einstellungen", label: "Einstellungen" },
];

export function Sidebar({ orgName }: { orgName?: string }) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 grid-cols-2 gap-0.5 rounded-lg bg-primary p-1">
            <span className="rounded-sm bg-primary-foreground/90" />
            <span className="rounded-sm bg-primary-foreground/60" />
            <span className="rounded-sm bg-primary-foreground/60" />
            <span className="rounded-sm bg-primary-foreground/90" />
          </div>
          <div>
            <p className="text-sm font-semibold">Schichtwerk</p>
            {orgName && (
              <p className="text-xs text-muted truncate max-w-[120px]">
                {orgName}
              </p>
            )}
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm text-foreground hover:bg-background"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
