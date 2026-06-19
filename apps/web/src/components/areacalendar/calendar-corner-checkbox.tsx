import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const CALENDAR_CELL_CHECKBOX_INSET_LEFT_PX = 2;
export const CALENDAR_DAY_CHECKBOX_INSET_TOP_PX = 2;
export const CALENDAR_AREA_CHECKBOX_INSET_TOP_PX = 5;

export const CALENDAR_TOGGLE_CHECKBOX_SIZE_PX = 14;

type CalendarToggleCheckboxProps = InputHTMLAttributes<HTMLInputElement>;

/** Aufklappen/Zuklappen: inaktiv = helles Quadrat, aktiv = dunkles Feld mit Punkt. */
function CalendarToggleCheckbox({
  className,
  checked,
  ...props
}: CalendarToggleCheckboxProps) {
  return (
    <label
      className={cn(
        "inline-flex shrink-0 cursor-pointer select-none leading-none",
        props.disabled && "cursor-not-allowed",
        className
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} {...props} />
      <span
        aria-hidden
        className={cn(
          "flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border shadow-sm transition",
          checked
            ? "border-[#2c4080] bg-[#2c4080]"
            : "border-slate-400 bg-white",
          props.disabled && "opacity-45"
        )}
      >
        {checked ? <span className="h-1 w-1 rounded-full bg-white" /> : null}
      </span>
    </label>
  );
}

type CornerCheckboxProps = CalendarToggleCheckboxProps & {
  insetTop?: number;
};

/** Checkbox oben links in Kalender-Tag-Header-Zellen. */
export function CalendarCornerCheckbox({
  insetTop = CALENDAR_DAY_CHECKBOX_INSET_TOP_PX,
  ...props
}: CornerCheckboxProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: CALENDAR_CELL_CHECKBOX_INSET_LEFT_PX,
        top: insetTop,
        zIndex: 10,
        lineHeight: 0,
      }}
    >
      <CalendarToggleCheckbox {...props} />
    </div>
  );
}

/** Checkbox in Bereichsspalten-Zellen (5 px von oben, Text rechts daneben). */
export function CalendarAreaCheckbox({
  className,
  ...props
}: CalendarToggleCheckboxProps) {
  return <CalendarToggleCheckbox className={cn("shrink-0", className)} {...props} />;
}

export const AREA_CHECKBOX_TEXT_GAP_PX = 10;
