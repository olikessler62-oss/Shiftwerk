import type { ReactNode } from "react";
import { SchichtwerkLogo } from "@/components/brand/schichtwerk-logo";
import { cn } from "@/lib/cn";
import {
  APP_SHELL_BRAND_HEADER_CLASS,
  APP_SHELL_BRAND_HEADER_CONTENT_ALIGN_CLASS,
  APP_SHELL_TOP_HEADER_ROW_MD_CLASS,
  APP_HEADER_DARK_PREVIEW_CLASS,
} from "@/lib/app-shell-layout";

type Props = {
  orgName?: string;
  trailing?: ReactNode;
  className?: string;
  /** Trennlinie unter dem Logo auf Höhe der Kalender-Inhaltskante (Bereich-Kalender). */
  alignContentStart?: boolean;
};

export function AppShellBrandHeader({
  orgName,
  trailing,
  className,
  alignContentStart = false,
}: Props) {
  const logoRow = (
    <>
      <span
        className="absolute inset-y-3 left-0 w-1 rounded-r-sm bg-[var(--header-toolbar-accent,#5c7a9e)] md:inset-y-4"
        aria-hidden
      />
      <SchichtwerkLogo />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight tracking-tight text-foreground">
          Schichtwerk
        </p>
        {orgName ? (
          <p className="truncate text-xs leading-tight text-muted">{orgName}</p>
        ) : null}
      </div>
      {trailing}
    </>
  );

  if (!alignContentStart) {
    return (
      <div
        className={cn(
          APP_HEADER_DARK_PREVIEW_CLASS,
          "relative flex shrink-0 items-center gap-2.5 border-b border-border py-0 pl-4 pr-3",
          APP_SHELL_BRAND_HEADER_CLASS,
          className
        )}
      >
        {logoRow}
      </div>
    );
  }

  return (
    <div
      className={cn(
        APP_HEADER_DARK_PREVIEW_CLASS,
        "relative flex shrink-0 flex-col border-b border-border",
        className
      )}
    >
      <div
        className={cn(
          "relative flex min-h-[5.5rem] shrink-0 items-center gap-2.5 py-0 pl-4 pr-3",
          APP_SHELL_TOP_HEADER_ROW_MD_CLASS
        )}
      >
        {logoRow}
      </div>
      <div
        className={cn("shrink-0", APP_SHELL_BRAND_HEADER_CONTENT_ALIGN_CLASS)}
        aria-hidden
      />
    </div>
  );
}
