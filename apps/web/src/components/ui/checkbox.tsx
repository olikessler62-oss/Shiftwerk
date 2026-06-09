import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { CheckIcon } from "@/components/ui/icons";

type CheckboxVariant = "default" | "area";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  variant?: CheckboxVariant;
};

const standardCheckboxClasses =
  "border-2 border-slate-300/90 bg-surface shadow-sm peer-hover:border-primary/70 peer-hover:shadow peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary/35 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface peer-checked:border-primary peer-checked:bg-primary peer-checked:shadow-md";

export function Checkbox({
  className = "",
  variant = "default",
  ...props
}: Props) {
  const isArea = variant === "area";

  return (
    <label
      className={cn(
        "inline-flex shrink-0 cursor-pointer select-none leading-none",
        props.disabled && "cursor-not-allowed",
        className
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center transition-all duration-150 ease-out",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-45",
          "peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:opacity-100",
          "[&>svg]:scale-75 [&>svg]:opacity-0 [&>svg]:transition-all [&>svg]:duration-150",
          isArea
            ? "h-[14px] w-[14px] rounded-[0.25rem]"
            : "h-[1.125rem] w-[1.125rem] rounded-[0.3rem]",
          standardCheckboxClasses
        )}
      >
        <CheckIcon
          className={cn(
            isArea ? "h-1.5 w-1.5 text-primary-foreground" : "h-2 w-2 text-primary-foreground"
          )}
        />
      </span>
    </label>
  );
}

/** Breite der Kalender-Bereichs-Checkbox (variant="area"). */
export const AREA_CHECKBOX_SIZE_PX = 14;
