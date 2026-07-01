import { cn } from "@/lib/cn";

/** 10px 3D-Kugel — Rahmen, Licht und Schatten. */
export const STATUS_SPHERE_DOT_FRAME_CLASS = cn(
  "size-2.5 shrink-0 rounded-full",
  "shadow-[inset_-0.5px_-0.5px_0.5px_rgba(0,0,0,0.38),inset_0.5px_0.5px_0.5px_rgba(255,255,255,0.42),0_0.5px_1px_rgba(0,0,0,0.24)]"
);

const STATUS_SPHERE_DOT_SUCCESS_SURFACE_CLASS =
  "bg-[radial-gradient(circle_at_32%_28%,#4ade80_0%,#059669_55%,#047857_100%)]";

const STATUS_SPHERE_DOT_DANGER_SURFACE_CLASS =
  "bg-[radial-gradient(circle_at_32%_28%,#f87171_0%,#dc2626_55%,#991b1b_100%)]";

export function statusSphereDotSurfaceClass(
  variant: "success" | "danger"
): string {
  return variant === "success"
    ? STATUS_SPHERE_DOT_SUCCESS_SURFACE_CLASS
    : STATUS_SPHERE_DOT_DANGER_SURFACE_CLASS;
}
