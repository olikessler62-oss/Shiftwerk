/**
 * Gemeinsame Verlauf- + Kurven-Schicht für Sidebar-Logo und Wochen-Toolbar.
 * Liegt auf der Shell-Root — Sidebar und Header sind leichte Overlays darüber.
 */
export function AppShellBrandBackdrop() {
  return (
    <div className="app-shell-brand-backdrop" aria-hidden>
      <div className="app-shell-brand-backdrop-mesh" />
      <div className="app-shell-brand-backdrop-orbs">
        <span className="app-shell-brand-orb app-shell-brand-orb-a" />
        <span className="app-shell-brand-orb app-shell-brand-orb-b" />
        <span className="app-shell-brand-orb app-shell-brand-orb-c" />
      </div>
      <svg
        className="app-shell-brand-backdrop-art"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="brand-wave-deep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-neon-cyan)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-wave-bottom)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="brand-wave-mid" x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0%" stopColor="var(--brand-neon-magenta)" stopOpacity="0.17" />
            <stop offset="50%" stopColor="var(--brand-glow)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--brand-neon-cyan)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="brand-swoosh-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="40%" stopColor="var(--brand-neon-cyan)" stopOpacity="0.38" />
            <stop offset="72%" stopColor="var(--brand-neon-magenta)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--brand-glow)" stopOpacity="0.22" />
          </linearGradient>
          <filter id="brand-glow-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Geschwungene Lichtbänder */}
        <path
          d="M-80 8 C 280 78, 520 -12, 760 42 S 1180 96, 1520 18"
          fill="none"
          stroke="url(#brand-swoosh-stroke)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#brand-glow-soft)"
        />
        <path
          d="M-40 52 C 220 4, 480 88, 720 38 S 1080 -8, 1480 58"
          fill="none"
          stroke="white"
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.12"
        />
        <path
          d="M0 28 C 180 68, 360 0, 540 44 S 900 82, 1200 34 S 1380 8, 1440 36"
          fill="none"
          stroke="var(--brand-neon-cyan)"
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.22"
        />

        {/* Organische Wellen — Übergang zum Inhalt */}
        <path
          d="M0 52 C 160 8, 320 78, 480 44 C 640 10, 800 72, 960 38 C 1120 4, 1280 64, 1440 28 L 1440 120 L 0 120 Z"
          fill="url(#brand-wave-deep)"
        />
        <path
          d="M0 68 C 240 98, 480 34, 720 62 C 960 90, 1200 40, 1440 72 L 1440 120 L 0 120 Z"
          fill="url(#brand-wave-mid)"
        />
        <path
          d="M0 82 Q 360 108 720 76 T 1440 88 L 1440 120 L 0 120 Z"
          fill="var(--brand-wave-ribbon)"
          fillOpacity="0.22"
        />
      </svg>
    </div>
  );
}
