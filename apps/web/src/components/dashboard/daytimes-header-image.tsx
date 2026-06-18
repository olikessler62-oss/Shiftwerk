import { cn } from "@/lib/cn";

export const DAYTIMES_HEADER_IMAGE_SRC = "/images/daytimes.png";
export const DAYTIMES_HEADER_IMAGE_HEIGHT_PX = 2;

type Props = {
  className?: string;
};

/** Tageszeit-Verlauf (2px) oben in Kalenderzellen. */
export function DaytimesHeaderImage({ className }: Props) {
  return (
    <div
      className={cn("pointer-events-none w-full shrink-0", className)}
      style={{
        height: DAYTIMES_HEADER_IMAGE_HEIGHT_PX,
        backgroundImage: `url(${DAYTIMES_HEADER_IMAGE_SRC})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "top center",
        backgroundSize: `100% ${DAYTIMES_HEADER_IMAGE_HEIGHT_PX}px`,
      }}
      aria-hidden
    />
  );
}
