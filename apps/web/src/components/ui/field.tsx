import { Label, LabelMuted } from "./label";
import { cn } from "@/lib/cn";

export function Field({
  label,
  mutedLabel,
  htmlFor,
  className = "",
  children,
}: {
  label: string;
  mutedLabel?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const LabelComponent = mutedLabel ? LabelMuted : Label;
  return (
    <div className={cn(className)}>
      <LabelComponent htmlFor={htmlFor}>{label}</LabelComponent>
      {children}
    </div>
  );
}
