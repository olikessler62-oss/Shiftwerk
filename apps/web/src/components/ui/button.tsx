import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "destructive";

export type ButtonSize = "sm" | "md" | "lg" | "header";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-primary text-primary-foreground hover:opacity-90",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-background",
  outline:
    "border border-border bg-background text-foreground hover:bg-subtle",
  ghost: "border border-transparent bg-transparent text-foreground hover:bg-subtle",
  danger:
    "border border-transparent bg-red-600 text-white hover:bg-red-700",
  destructive:
    "border border-border bg-background text-red-600 hover:bg-danger",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-sm",
  header: "h-9 min-h-9 gap-1 px-3 text-sm",
};

const base =
  "inline-flex cursor-pointer select-none items-center justify-center rounded-[var(--radius-control)] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
