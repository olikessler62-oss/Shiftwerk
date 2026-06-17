import { TagAreaHeaderStaffingOverlay } from "@/components/dashboard/tag-area-header-staffing-overlay";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

export const DAYTIMES_HEADER_IMAGE_SRC = "/images/daytimes.png";
export const DAYTIMES_HEADER_IMAGE_HEIGHT_PX = 4;

type Props = {
  showDaytimesGradient: boolean;
  entries: TagAreaHeaderStaffingEntry[];
  /** Schichten ohne Servicezeit — Bedarf-Overlay ersetzen. */
  noServiceHoursLabel?: string;
  noServiceHoursTooltip?: string;
  overlayBackgroundColor?: string;
  staffingLabelsDimmed?: boolean;
  /** Zugeklappter Tag — Bedarf als „!“ statt unleserlichem Text. */
  dayCollapsed?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** Tag-Bereich-Header: Tageszeit-Verlauf (4px oben) + Personalbedarf-Overlay. */
export function TagAreaHeaderStrip({
  showDaytimesGradient,
  entries,
  noServiceHoursLabel,
  noServiceHoursTooltip,
  overlayBackgroundColor,
  staffingLabelsDimmed = false,
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
        <div
          className="pointer-events-none absolute inset-x-0 top-0 w-full"
          style={{
            height: DAYTIMES_HEADER_IMAGE_HEIGHT_PX,
            backgroundImage: `url(${DAYTIMES_HEADER_IMAGE_SRC})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "top center",
            backgroundSize: `100% ${DAYTIMES_HEADER_IMAGE_HEIGHT_PX}px`,
          }}
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "relative z-[1] flex h-full w-full min-w-0 items-end justify-center px-1 pb-px",
          showDaytimesGradient && "translate-y-px"
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
            dimmed={staffingLabelsDimmed}
            dayCollapsed={dayCollapsed}
          />
        )}
      </div>
    </div>
  );
}
