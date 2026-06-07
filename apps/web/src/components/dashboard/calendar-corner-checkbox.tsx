import type { ComponentProps } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";

export const CALENDAR_CELL_CHECKBOX_INSET_LEFT_PX = 2;
export const CALENDAR_DAY_CHECKBOX_INSET_TOP_PX = 2;
export const CALENDAR_AREA_CHECKBOX_INSET_TOP_PX = 5;

type CornerCheckboxProps = Omit<ComponentProps<typeof Checkbox>, "variant"> & {
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
      <Checkbox variant="area" {...props} />
    </div>
  );
}

/** Checkbox in Bereichsspalten-Zellen (5 px von oben, Text rechts daneben). */
export function CalendarAreaCheckbox({
  className,
  ...props
}: Omit<ComponentProps<typeof Checkbox>, "variant">) {
  return (
    <Checkbox variant="area" className={cn("shrink-0", className)} {...props} />
  );
}

export const AREA_CHECKBOX_TEXT_GAP_PX = 10;
