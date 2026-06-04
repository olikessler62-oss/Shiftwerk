import { cn } from "@/lib/cn";

const variants = {
  success: "border-emerald-200 bg-success text-success-foreground",
  error: "border-red-200 bg-danger text-danger-foreground",
  info: "border-teal-200 bg-info text-info-foreground",
  neutral: "border-border bg-subtle text-foreground",
};

export function Alert({
  variant = "neutral",
  className = "",
  children,
}: {
  variant?: keyof typeof variants;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "rounded-[var(--radius-control)] border px-3 py-2 text-sm",
        variants[variant],
        className
      )}
      role="status"
    >
      {children}
    </p>
  );
}
