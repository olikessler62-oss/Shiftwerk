import { TagAreaHeaderStaffingRow } from "@/components/areacalendar/tag-area-header-staffing-row";
import type { TagAreaHeaderStaffingEntry } from "@/lib/location-staffing-client";
import { isTagAreaHeaderStaffingHeaderAlertBadge } from "@/lib/tag-area-header-staffing-display";
import { PLANNING_CLOSED_DAY_CELL_BG } from "@/lib/planning-calendar-layout";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

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
  onStaffingHeaderMenu?: (event: React.MouseEvent) => void;
  staffingHeaderMenuOpen?: boolean;
  className?: string;
};

export { TagAreaHeaderStaffingRow } from "@/components/areacalendar/tag-area-header-staffing-row";

type Props = StaffingRowProps & {
  overlayBackgroundColor?: string;
  style?: React.CSSProperties;
};

/** Tag-Bereich-Header: Personalbedarf-Overlay. */
export function TagAreaHeaderStrip({
  overlayBackgroundColor,
  className,
  style,
  noServiceHoursLabel,
  ...rowProps
}: Props) {
  const resolvedBackgroundColor =
    overlayBackgroundColor ??
    (noServiceHoursLabel ? PLANNING_CLOSED_DAY_CELL_BG : undefined);

  const headerAlertBadge =
    !noServiceHoursLabel &&
    rowProps.entries.length > 0 &&
    isTagAreaHeaderStaffingHeaderAlertBadge(rowProps.entries);

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 overflow-visible border-b border-border",
        headerAlertBadge ? "z-40" : "z-30",
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
      <TagAreaHeaderStaffingRow
        className="relative z-[1]"
        noServiceHoursLabel={noServiceHoursLabel}
        {...rowProps}
      />
    </div>
  );
}
