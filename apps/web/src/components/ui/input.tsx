import {
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

export const controlBase =
  "w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, className)} {...props} />;
}

const selectBase =
  "w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 h-9 min-h-9 leading-9";

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(selectBase, className)} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(controlBase, "resize-none", className)} {...props} />
  );
}

/** Zeitfeld mit einheitlichem Control-Styling */
export function TimeInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="time"
      className={cn(controlBase, "pr-9", className)}
      {...props}
    />
  );
}

/** Nur Anzeige (z. B. Datumsbereich, Standort) */
export function ControlDisplay({
  className = "",
  title,
  children,
}: {
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const display = (
    <div
      className={cn(
        controlBase,
        "flex select-none items-center bg-background py-2 font-medium",
        className
      )}
    >
      {children}
    </div>
  );

  if (!title) return display;

  return (
    <Tooltip content={title} className="w-full">
      {display}
    </Tooltip>
  );
}
