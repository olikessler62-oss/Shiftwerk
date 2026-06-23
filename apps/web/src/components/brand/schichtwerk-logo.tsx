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
      className={cn("h-7 w-7 shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient
          id="schichtwerk-logo-face"
          x1="2"
          y1="2"
          x2="34"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--brand-logo-from)" />
          <stop offset="45%" stopColor="var(--brand-logo-mid)" />
          <stop offset="88%" stopColor="var(--brand-logo-to)" />
          <stop offset="100%" stopColor="var(--brand-neon-fuchsia)" />
        </linearGradient>
        <linearGradient
          id="schichtwerk-logo-ring"
          x1="0"
          y1="0"
          x2="36"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--brand-neon-cyan)" stopOpacity="0.75" />
          <stop offset="50%" stopColor="var(--brand-neon-violet)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--brand-neon-magenta)" stopOpacity="0.65" />
        </linearGradient>
        <filter id="schichtwerk-logo-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect
        x="1"
        y="1"
        width="34"
        height="34"
        rx="10"
        stroke="url(#schichtwerk-logo-ring)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.7"
        filter="url(#schichtwerk-logo-glow)"
      />
      <rect width="36" height="36" rx="9" fill="url(#schichtwerk-logo-face)" />
      <path
        d="M6 30 C 12 22, 18 34, 24 28 S 32 20, 34 26"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.2"
        fill="none"
      />
      <g stroke="white" strokeWidth="1.25" strokeLinecap="round" opacity="0.38">
        <line x1="13" y1="9" x2="13" y2="27" />
        <line x1="23" y1="9" x2="23" y2="27" />
        <line x1="7" y1="15" x2="29" y2="15" />
        <line x1="7" y1="21" x2="29" y2="21" />
      </g>
      <rect
        x="14.5"
        y="16"
        width="8"
        height="8"
        rx="2"
        fill="white"
        fillOpacity="0.95"
      />
      <rect
        x="16"
        y="18"
        width="5"
        height="2"
        rx="1"
        fill="var(--brand-logo-to)"
        fillOpacity="0.92"
      />
    </svg>
  );
}
