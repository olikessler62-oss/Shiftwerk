import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

const LIGHT_WIDTH_PX = 2;
/** Shade-Breite = Control-Breite × 1,5 (50 % breiter). */
const SHADE_CONTROL_WIDTH_RATIO = 1.5;

export type HeaderShadeZone = {
  left: number;
  width: number;
};

export type HeaderTrailingShadeChainGeometry = {
  statiShade: HeaderShadeZone | null;
  lightAfterLastShade: { left: number } | null;
  lightBeforeBell: { left: number } | null;
  bellShade: HeaderShadeZone | null;
};

type Options = {
  hasBell: boolean;
  hasStati: boolean;
};

/**
 * Shade/Light-Kette links der Sprach-Zone — verankert an `languageShadeLeft`
 * (linke Kante des bestehenden Sprach-Shades, unverändert).
 *
 * Von rechts nach links: [Sprache] ← Light ← [Glocke] ← Light ← [Schicht-Stati] ← Light
 */
export function useHeaderTrailingShadeChainGeometry(
  headerRef: RefObject<HTMLElement | null>,
  languageShadeLeft: number | null,
  statiMeasureRef: RefObject<HTMLElement | null>,
  bellMeasureRef: RefObject<HTMLElement | null>,
  options: Options,
  deps: readonly unknown[] = []
): HeaderTrailingShadeChainGeometry | null {
  const [geometry, setGeometry] =
    useState<HeaderTrailingShadeChainGeometry | null>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header || languageShadeLeft == null) {
      setGeometry(null);
      return;
    }

    function measure() {
      const headerEl = headerRef.current;
      if (!headerEl || languageShadeLeft == null) {
        setGeometry(null);
        return;
      }

      let rightEdge = languageShadeLeft - LIGHT_WIDTH_PX;

      let bellShade: HeaderShadeZone | null = null;
      let lightBeforeBell: { left: number } | null = null;
      let statiShade: HeaderShadeZone | null = null;

      if (options.hasBell && bellMeasureRef.current) {
        const bellMeasureEl = bellMeasureRef.current;
        const bellTrigger =
          bellMeasureEl.querySelector<HTMLElement>("button") ?? bellMeasureEl;
        const bellWidth = bellTrigger.getBoundingClientRect().width;
        if (bellWidth > 0) {
          const width = bellWidth * SHADE_CONTROL_WIDTH_RATIO;
          const left = rightEdge - width;
          bellShade = { left, width };
          rightEdge = left - LIGHT_WIDTH_PX;
        }
      }

      if (options.hasStati && statiMeasureRef.current) {
        const statiWidth = statiMeasureRef.current.getBoundingClientRect().width;
        if (statiWidth > 0) {
          const width = statiWidth * SHADE_CONTROL_WIDTH_RATIO;
          const left = rightEdge - width;
          statiShade = { left, width };
        }
      }

      if (bellShade && statiShade) {
        lightBeforeBell = { left: bellShade.left - LIGHT_WIDTH_PX };
      }

      const lastShade = statiShade ?? bellShade;
      const lightAfterLastShade = lastShade
        ? { left: lastShade.left - LIGHT_WIDTH_PX }
        : null;

      if (!bellShade && !statiShade) {
        setGeometry(null);
        return;
      }

      setGeometry({ statiShade, lightAfterLastShade, lightBeforeBell, bellShade });
    }

    measure();

    const observed = new Set<Element>();
    const observer = new ResizeObserver(measure);

    function observe(el: Element | null | undefined) {
      if (!el || observed.has(el)) return;
      observer.observe(el);
      observed.add(el);
    }

    observe(header);
    observe(statiMeasureRef.current);
    observe(bellMeasureRef.current);
    if (bellMeasureRef.current) {
      observe(bellMeasureRef.current.querySelector("button"));
    }
    if (statiMeasureRef.current) {
      observe(statiMeasureRef.current.querySelector("button"));
    }

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure when trailing controls change
  }, [
    headerRef,
    languageShadeLeft,
    statiMeasureRef,
    bellMeasureRef,
    options.hasBell,
    options.hasStati,
    ...deps,
  ]);

  return geometry;
}
