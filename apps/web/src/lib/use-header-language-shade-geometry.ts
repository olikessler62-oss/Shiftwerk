import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

export type HeaderLanguageShadeGeometry = {
  /** Abstand von der linken Kante des Headers (px). */
  left: number;
};

/**
 * Fläche hinter der Sprach-Combobox: links Mitte zwischen Anker (Glocke o. ä.) und
 * Combobox-Referenzposition, rechts Viewport-Rand, volle Header-Höhe.
 */
export function useHeaderLanguageShadeGeometry(
  headerRef: RefObject<HTMLElement | null>,
  beforeLanguageRef: RefObject<HTMLElement | null>,
  languageMeasureRef: RefObject<HTMLElement | null>,
  deps: readonly unknown[] = []
): HeaderLanguageShadeGeometry | null {
  const [geometry, setGeometry] = useState<HeaderLanguageShadeGeometry | null>(
    null
  );

  useLayoutEffect(() => {
    const header = headerRef.current;
    const languageMeasure = languageMeasureRef.current;
    if (!header || !languageMeasure) {
      setGeometry(null);
      return;
    }

    function measure() {
      const headerEl = headerRef.current;
      const measureEl = languageMeasureRef.current;
      const anchorEl = beforeLanguageRef.current;
      if (!headerEl || !measureEl) {
        setGeometry(null);
        return;
      }

      const headerRect = headerEl.getBoundingClientRect();
      const measureRect = measureEl.getBoundingClientRect();
      const anchorRect = anchorEl?.getBoundingClientRect();
      const anchorRight = anchorRect?.right ?? measureRect.left;
      const left = (anchorRight + measureRect.left) / 2 - headerRect.left;

      setGeometry({ left });
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
    observe(languageMeasure);
    observe(beforeLanguageRef.current);
    if (languageMeasure instanceof HTMLElement) {
      observe(languageMeasure.querySelector("button"));
    }

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure when trailing controls change
  }, [headerRef, beforeLanguageRef, languageMeasureRef, ...deps]);

  return geometry;
}
