import { type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Label({
  className = "",
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function LabelMuted({
  className = "",
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted",
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
}
