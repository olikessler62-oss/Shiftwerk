/**
 * Türkis-Verlauf + geschwungene Linien unter der Logo-Zeile — nahtloser Übergang vom Brand-Backdrop.
 */
export function AppShellSidebarBrandArt() {
  return (
    <div className="app-shell-sidebar-brand-art" aria-hidden>
      <div className="app-shell-sidebar-brand-art-mesh" />
      <svg
        className="app-shell-sidebar-brand-art-curves"
        viewBox="0 0 224 800"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="sidebar-swoosh-clip">
            <rect x="0" y="0" width="220" height="800" />
          </clipPath>
          <linearGradient id="sidebar-swoosh-stroke" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-neon-cyan)" stopOpacity="0.35" />
            <stop offset="40%" stopColor="var(--brand-neon-magenta)" stopOpacity="0.22" />
            <stop offset="45%" stopColor="var(--brand-glow)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-neon-violet)" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="sidebar-swoosh-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-neon-cyan)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--brand-neon-cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g clipPath="url(#sidebar-swoosh-clip)">
          {/* Kurven leicht von der rechten Kante eingezogen — kein Stroke-Bleed in den Inhalt */}
          <path
            d="M218 0 C 168 48, 192 120, 140 180 S 72 320, 120 420 S 200 560, 160 680 S 48 760, 80 800"
            fill="none"
            stroke="url(#sidebar-swoosh-stroke)"
            strokeWidth="2"
            strokeLinecap="butt"
          />
          <path
            d="M218 24 C 200 80, 176 140, 188 220 S 220 380, 172 480 S 96 600, 132 720 S 188 760, 218 800"
            fill="none"
            stroke="white"
            strokeWidth="1"
            strokeLinecap="butt"
            opacity="0.1"
          />
          <path
            d="M0 0 L 218 0 L 218 140 C 180 100, 120 160, 80 120 S 20 200, 0 260 Z"
            fill="url(#sidebar-swoosh-fade)"
          />
          <path
            d="M218 100 C 160 180, 200 280, 148 360 S 88 520, 128 640 S 200 720, 218 800"
            fill="none"
            stroke="var(--brand-neon-cyan)"
            strokeWidth="1.25"
            strokeLinecap="butt"
            opacity="0.16"
          />
        </g>
      </svg>
    </div>
  );
}
