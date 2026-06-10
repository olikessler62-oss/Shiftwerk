import type { CSSProperties } from "react";
import { isShiftTemplateGradientColor } from "@schichtwerk/database";

export function shiftColorStyle(color: string): CSSProperties {
  if (isShiftTemplateGradientColor(color)) {
    return {
      backgroundColor: "transparent",
      backgroundImage: color,
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
    };
  }
  return { backgroundColor: color };
}
