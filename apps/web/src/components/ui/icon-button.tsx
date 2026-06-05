import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const base =
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center rounded-[var(--radius-control)] border border-border bg-background text-foreground transition hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50";

export function IconButton({
  className = "",
  size = "md",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm" ? "h-8 w-8 text-base" : size === "lg" ? "h-10 w-10 text-lg" : "h-9 w-9 text-lg";

  return (
    <button type="button" className={cn(base, sizeClass, className)} {...props}>
      {children}
    </button>
  );
}
