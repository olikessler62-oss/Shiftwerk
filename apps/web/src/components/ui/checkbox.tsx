import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { CheckIcon } from "@/components/ui/icons";

export function Checkbox({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer select-none",
        props.disabled && "cursor-not-allowed",
        className
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden
        className={cn(
          "flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-[0.3rem]",
          "border-2 border-slate-300/90 bg-surface shadow-sm",
          "transition-all duration-150 ease-out",
          "peer-hover:border-primary/70 peer-hover:shadow",
          "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary/35 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface",
          "peer-checked:border-primary peer-checked:bg-primary peer-checked:shadow-md",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-45",
          "peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:opacity-100",
          "[&>svg]:scale-75 [&>svg]:opacity-0 [&>svg]:transition-all [&>svg]:duration-150"
        )}
      >
        <CheckIcon className="h-2.5 w-2.5 text-primary-foreground" />
      </span>
    </label>
  );
}
