import { TagAreaHeaderStaffingOverlay } from "@/components/dashboard/tag-area-header-staffing-overlay";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import { cn } from "@/lib/cn";

export const DAYTIMES_HEADER_IMAGE_SRC = "/images/daytimes.png";
export const DAYTIMES_HEADER_IMAGE_HEIGHT_PX = 4;

type Props = {
  showDaytimesGradient: boolean;
  entries: TagAreaHeaderStaffingEntry[];
  shiftTypeNameById: ReadonlyMap<string, string>;
  className?: string;
  style?: React.CSSProperties;
};

/** Tag-Bereich-Header: Tageszeit-Verlauf (24h) + Personalbedarf-Overlay. */
export function TagAreaHeaderStrip({
  showDaytimesGradient,
  entries,
  shiftTypeNameById,
  className,
  style,
}: Props) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 z-20 overflow-hidden border-b border-border bg-background",
        className
      )}
      style={style}
    >
      {showDaytimesGradient ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 w-full"
          style={{
            height: DAYTIMES_HEADER_IMAGE_HEIGHT_PX,
            backgroundImage: `url(${DAYTIMES_HEADER_IMAGE_SRC})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "bottom center",
            backgroundSize: `100% ${DAYTIMES_HEADER_IMAGE_HEIGHT_PX}px`,
          }}
          aria-hidden
        />
      ) : null}
      <div className="relative z-[1] flex h-full w-full min-w-0 -translate-y-[3px] items-center justify-center px-1">
        <TagAreaHeaderStaffingOverlay
          entries={entries}
          shiftTypeNameById={shiftTypeNameById}
        />
      </div>
    </div>
  );
}
