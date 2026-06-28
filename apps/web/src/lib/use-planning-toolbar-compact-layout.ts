import { useEffect, useState } from "react";

/** Ab lg (1024px): volle Datumszeile, Heute-Button, breitere Sprachauswahl. */
export const PLANNING_TOOLBAR_COMPACT_LAYOUT_MEDIA =
  "(max-width: 1023px)";

export function usePlanningToolbarCompactLayout(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(PLANNING_TOOLBAR_COMPACT_LAYOUT_MEDIA);
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return compact;
}
