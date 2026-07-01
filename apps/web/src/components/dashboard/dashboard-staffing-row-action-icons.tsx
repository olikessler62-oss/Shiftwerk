import { cn } from "@/lib/cn";
import { DASHBOARD_STAFFING_VACANCY_SILHOUETTE_COLOR } from "@/lib/dashboard-panel-styles";

/** Feste Klickfläche — Platzhalter und Buttons teilen dieselbe Box. */
export const DASHBOARD_STAFFING_ROW_ACTION_SLOT_CLASS =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden leading-none";

/** SVG block + feste Größe — vermeidet Inline-Baseline-Lücken unter dem Icon. */
export const DASHBOARD_STAFFING_ROW_ACTION_ICON_CLASS =
  "block h-5 w-5 shrink-0";

type IconProps = {
  className?: string;
};

const PERSON_FILL = "#94a3b8";
const PLUS_OUTLINE = "#1c1917";
const PLUS_FILL = "#22c55e";

/** Unbesetzte Schicht — Silhouette + grünes Plus (Personal zuweisen). */
export function StaffingVacancyIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={cn(DASHBOARD_STAFFING_ROW_ACTION_ICON_CLASS, className)}
    >
      <circle cx="9.25" cy="7.25" r="2.65" fill={DASHBOARD_STAFFING_VACANCY_SILHOUETTE_COLOR} />
      <path
        d="M4.75 16.25v-1.35c0-2.1 2.65-3.4 4.5-3.4s4.5 1.3 4.5 3.4v1.35H4.75Z"
        fill={DASHBOARD_STAFFING_VACANCY_SILHOUETTE_COLOR}
      />
      <path
        d="M15.15 1.95v5.5M12.4 4.7h5.5"
        stroke={PLUS_OUTLINE}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M15.15 1.95v5.5M12.4 4.7h5.5"
        stroke={PLUS_FILL}
        strokeWidth="0.95"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Hinweise zur Einteilung (Überbesetzung / Qualifikation). */
export function StaffingConflictIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={cn(DASHBOARD_STAFFING_ROW_ACTION_ICON_CLASS, className)}
    >
      <path
        d="M10 3.5 17.5 16.5H2.5L10 3.5Z"
        fill={PERSON_FILL}
        fillOpacity={0.22}
        stroke={PERSON_FILL}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M10 8.25v3.5"
        stroke={PERSON_FILL}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="13.75" r="0.9" fill={PERSON_FILL} />
    </svg>
  );
}

/** Offene Punkte (Bestätigung / Schichtfenster). */
export function StaffingOpenPointsIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={cn(DASHBOARD_STAFFING_ROW_ACTION_ICON_CLASS, className)}
    >
      <rect
        x="4.5"
        y="3.5"
        width="11"
        height="13"
        rx="1.25"
        stroke={PERSON_FILL}
        strokeWidth="1.25"
      />
      <path
        d="M7.25 7.5h5.5M7.25 10h5.5M7.25 12.5h3.5"
        stroke={PERSON_FILL}
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle
        cx="14.75"
        cy="5.25"
        r="2.6"
        className="fill-[#dc2626] stroke-white"
        strokeWidth="1"
      />
    </svg>
  );
}
