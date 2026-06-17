"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/sign-out";
import { Button, IconButton } from "@/components/ui";
import { SidebarNav } from "./sidebar-nav";

interface HamburgerNavProps {
  orgName?: string;
  userName?: string;
  role?: string;
}

export function HamburgerNav({ orgName, userName, role }: HamburgerNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="border-b border-border bg-surface">
      <div className="flex items-center px-4 py-3">
        <div ref={menuRef} className="relative flex items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 grid-cols-2 gap-0.5 rounded-lg bg-primary p-1">
            <span className="rounded-sm bg-primary-foreground/90" />
            <span className="rounded-sm bg-primary-foreground/60" />
            <span className="rounded-sm bg-primary-foreground/60" />
            <span className="rounded-sm bg-primary-foreground/90" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Schichtwerk</p>
            {orgName && (
              <p className="max-w-[110px] truncate text-xs leading-tight text-muted">
                {orgName}
              </p>
            )}
          </div>

          <IconButton
            size="sm"
            onClick={() => setOpen((prev) => !prev)}
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={open}
            className="ml-1 border-transparent bg-transparent hover:bg-subtle"
          >
            {open ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </IconButton>

          {open && (
            <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-border bg-surface shadow-lg">
              <Suspense fallback={<nav className="p-2 text-sm text-muted">Laden…</nav>}>
                <SidebarNav onNavigate={() => setOpen(false)} />
              </Suspense>

              <div className="border-t border-border p-2">
                <p className="px-3 py-1.5 text-xs text-muted">
                  {userName}
                  {" · "}
                  {role === "admin"
                    ? "Administrator"
                    : role === "manager"
                      ? "Manager"
                      : "Mitarbeiter"}
                </p>
                <form action={signOut}>
                  <Button
                    type="submit"
                    variant="ghost"
                    className="h-auto w-full justify-start px-3 py-2 text-sm font-normal"
                  >
                    Abmelden
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
