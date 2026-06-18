import { cn } from "@/lib/cn";

type Props = {
  className?: string;
};

/** Kalender-Gitter mit hervorgehobener Zelle — Schichtwerk-Markenzeichen. */
export function SchichtwerkLogo({ className }: Props) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-9 w-9 shrink-0", className)}
      aria-hidden
    >
      <rect width="36" height="36" rx="8" className="fill-primary" />
      <g stroke="white" strokeWidth="1.25" strokeLinecap="round" opacity="0.35">
        <line x1="13" y1="9" x2="13" y2="27" />
        <line x1="23" y1="9" x2="23" y2="27" />
        <line x1="7" y1="15" x2="29" y2="15" />
        <line x1="7" y1="21" x2="29" y2="21" />
      </g>
      <rect x="14.5" y="16" width="8" height="8" rx="2" fill="white" fillOpacity="0.95" />
      <rect x="16" y="18" width="5" height="2" rx="1" className="fill-primary" fillOpacity="0.85" />
    </svg>
  );
}
