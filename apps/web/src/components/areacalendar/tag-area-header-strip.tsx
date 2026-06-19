import { TagAreaHeaderStaffingOverlay } from "@/components/areacalendar/tag-area-header-staffing-overlay";
import {
  DaytimesHeaderImage,
  DAYTIMES_HEADER_IMAGE_HEIGHT_PX,
} from "@/components/areacalendar/daytimes-header-image";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

export { DAYTIMES_HEADER_IMAGE_SRC, DAYTIMES_HEADER_IMAGE_HEIGHT_PX } from "@/components/areacalendar/daytimes-header-image";

type Props = {
  showDaytimesGradient: boolean;
  entries: TagAreaHeaderStaffingEntry[];
  /** Schichten ohne Servicezeit — Bedarf-Overlay ersetzen. */
  noServiceHoursLabel?: string;
  noServiceHoursTooltip?: string;
  overlayBackgroundColor?: string;
  /** Zugeklappter Tag — Bedarf als „!“ statt unleserlichem Text. */
  dayCollapsed?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** Tag-Bereich-Header: Tageszeit-Verlauf (2px oben) + Personalbedarf-Overlay. */
export function TagAreaHeaderStrip({
  showDaytimesGradient,
  entries,
  noServiceHoursLabel,
  noServiceHoursTooltip,
  overlayBackgroundColor,
  dayCollapsed = false,
  className,
  style,
}: Props) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 z-20 overflow-hidden border-b border-border",
        overlayBackgroundColor ? undefined : "bg-background",
        className
      )}
      style={{
        ...style,
        ...(overlayBackgroundColor
          ? { backgroundColor: overlayBackgroundColor }
          : undefined),
      }}
    >
      {showDaytimesGradient ? (
        <DaytimesHeaderImage className="absolute inset-x-0 top-0" />
      ) : null}
      <div
        className={cn(
          "relative z-[1] flex h-full w-full min-w-0 items-center justify-center px-1",
        )}
      >
        {noServiceHoursLabel ? (
          <Tooltip
            content={
              noServiceHoursTooltip ? (
                <span className="block whitespace-pre-line">
                  {noServiceHoursTooltip}
                </span>
              ) : (
                noServiceHoursLabel
              )
            }
          >
            <span className="shrink-0 cursor-default whitespace-nowrap rounded px-1 py-px text-[11px] font-medium leading-none text-black">
              {noServiceHoursLabel}
            </span>
          </Tooltip>
        ) : (
          <TagAreaHeaderStaffingOverlay
            key={entries
              .map(
                (entry) =>
                  `${entry.serviceHourId}:${entry.assigned}/${entry.required}`
              )
              .join("|")}
            entries={entries}
            dayCollapsed={dayCollapsed}
          />
        )}
      </div>
    </div>
  );
}
