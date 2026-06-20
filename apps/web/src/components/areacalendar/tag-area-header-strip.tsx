import { TagAreaHeaderStaffingRow } from "@/components/areacalendar/tag-area-header-staffing-row";
import {
  DaytimesHeaderImage,
  DAYTIMES_HEADER_IMAGE_HEIGHT_PX,
} from "@/components/areacalendar/daytimes-header-image";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import { PLANNING_CLOSED_DAY_CELL_BG } from "@/lib/planning-calendar-layout";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export { DAYTIMES_HEADER_IMAGE_SRC, DAYTIMES_HEADER_IMAGE_HEIGHT_PX } from "@/components/areacalendar/daytimes-header-image";

export function TagAreaHeaderTooltipContent({
  title,
  subtitleLines,
  body,
}: {
  title: string;
  subtitleLines?: readonly string[];
  body: ReactNode;
}) {
  return (
    <>
      <div className="mb-1.5 border-b border-border/60 pb-1.5">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        {subtitleLines?.map((line, index) => (
          <p key={index} className="mt-0.5 text-xs text-foreground">
            {line}
          </p>
        ))}
      </div>
      {typeof body === "string" ? (
        <span className="block whitespace-pre-line">{body}</span>
      ) : (
        body
      )}
    </>
  );
}

type StaffingRowProps = {
  entries: TagAreaHeaderStaffingEntry[];
  /** Schichten ohne Servicezeit — Bedarf-Overlay ersetzen. */
  noServiceHoursLabel?: string;
  /** Tooltip für leere Bereiche der Header-Zeile (Servicezeiten). */
  headerTooltip?: ReactNode;
  /** Zugeklappter Tag — Bedarf als „!“ statt unleserlichem Text. */
  dayCollapsed?: boolean;
  className?: string;
};

export { TagAreaHeaderStaffingRow } from "@/components/areacalendar/tag-area-header-staffing-row";

type Props = StaffingRowProps & {
  showDaytimesGradient: boolean;
  overlayBackgroundColor?: string;
  style?: React.CSSProperties;
};

/** Tag-Bereich-Header: Tageszeit-Verlauf (2px oben) + Personalbedarf-Overlay. */
export function TagAreaHeaderStrip({
  showDaytimesGradient,
  overlayBackgroundColor,
  className,
  style,
  noServiceHoursLabel,
  ...rowProps
}: Props) {
  const resolvedBackgroundColor =
    overlayBackgroundColor ??
    (noServiceHoursLabel ? PLANNING_CLOSED_DAY_CELL_BG : undefined);

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 z-20 overflow-hidden border-b border-border",
        resolvedBackgroundColor ? undefined : "bg-background",
        className
      )}
      style={{
        ...style,
        ...(resolvedBackgroundColor
          ? { backgroundColor: resolvedBackgroundColor }
          : undefined),
      }}
    >
      {showDaytimesGradient ? (
        <DaytimesHeaderImage className="absolute inset-x-0 top-0" />
      ) : null}
      <TagAreaHeaderStaffingRow
        className="relative z-[1]"
        noServiceHoursLabel={noServiceHoursLabel}
        {...rowProps}
      />
    </div>
  );
}
