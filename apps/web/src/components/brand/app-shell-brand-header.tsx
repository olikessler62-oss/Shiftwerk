import type { ReactNode } from "react";
import { SchichtwerkLogo } from "@/components/brand/schichtwerk-logo";
import { cn } from "@/lib/cn";
import { APP_SHELL_BRAND_HEADER_CLASS, APP_HEADER_DARK_PREVIEW_CLASS } from "@/lib/app-shell-layout";

type Props = {
  orgName?: string;
  trailing?: ReactNode;
  className?: string;
};

export function AppShellBrandHeader({ orgName, trailing, className }: Props) {
  return (
    <div
      className={cn(
        APP_HEADER_DARK_PREVIEW_CLASS,
        "relative flex shrink-0 items-center gap-2.5 border-b border-border py-0 pl-4 pr-3",
        APP_SHELL_BRAND_HEADER_CLASS,
        className
      )}
    >
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
    </div>
  );
}
