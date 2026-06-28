import type { ReactNode } from "react";
import { SchichtwerkLogo } from "@/components/brand/schichtwerk-logo";
import { cn } from "@/lib/cn";
import {
  APP_SHELL_BRAND_HEADER_CLASS,
  APP_SHELL_TOP_PANEL_CLASS,
} from "@/lib/app-shell-layout";

type Props = {
  orgName?: string;
  trailing?: ReactNode;
  className?: string;
};

export function AppShellBrandHeader({
  orgName,
  trailing,
  className,
}: Props) {
  return (
    <div
      className={cn(
        APP_SHELL_TOP_PANEL_CLASS,
        "app-shell-brand-header relative flex shrink-0 items-center gap-2.5 py-0 pl-4 pr-3",
        APP_SHELL_BRAND_HEADER_CLASS,
        className
      )}
    >
      <SchichtwerkLogo className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="app-shell-brand-wordmark" aria-label="Schichtwerk">
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
