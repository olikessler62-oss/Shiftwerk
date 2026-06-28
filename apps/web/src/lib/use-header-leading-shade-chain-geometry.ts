import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import type { HeaderShadeZone } from "@/lib/use-header-trailing-shade-chain-geometry";

const LIGHT_WIDTH_PX = 2;
/** Shade-Breite = Control-Breite × 1,5 (50 % breiter). */
const SHADE_CONTROL_WIDTH_RATIO = 1.5;

export type HeaderLeadingShadeMeasureSlot = {
  key: string;
  ref: RefObject<HTMLElement | null>;
  enabled: boolean;
};

export type HeaderLeadingShadeSlot = {
  key: string;
  shade: HeaderShadeZone;
  lightAfter: { left: number } | null;
};

export type HeaderLeadingShadeChainGeometry = {
  slots: HeaderLeadingShadeSlot[];
  /** Light-Streifen links vom ersten Control (z. B. zwischen Logo und Pfeil links). */
  leadingLight: { left: number } | null;
  /** Light-Streifen rechts von einem festen Control (z. B. Heute). */
  alwaysLightAfter: { left: number } | null;
  /** Light-Streifen rechts vom letzten Placement-Control (Standort oder Bereich). */
  placementTrailingLight: { left: number } | null;
};

export type HeaderLeadingShadeChainOptions = {
  /** 2px Light vor dem ersten Shade (Toolbar-Start / Logo-Grenze). */
  leadingLightBeforeFirst?: boolean;
  /** Light rechts von diesem Slot, unabhängig von der Ketten-Logik. */
  alwaysLightAfterKey?: string | null;
  placementTrailingLightAfterKey?: "location" | "area" | null;
};

function measureControlWidth(element: HTMLElement): number {
  const trigger = element.querySelector<HTMLElement>("button") ?? element;
  return trigger.getBoundingClientRect().width;
}

/**
 * Shade/Light-Kette ab der linken Header-Kante nach rechts.
 *
 * [Control] → Light (2px) → [Control] → …
 */
export function useHeaderLeadingShadeChainGeometry(
  headerRef: RefObject<HTMLElement | null>,
  measureSlots: readonly HeaderLeadingShadeMeasureSlot[],
  deps: readonly unknown[] = [],
  options: HeaderLeadingShadeChainOptions = {}
): HeaderLeadingShadeChainGeometry | null {
  const [geometry, setGeometry] = useState<HeaderLeadingShadeChainGeometry | null>(
    null
  );

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) {
      setGeometry(null);
      return;
    }

    function measure() {
      const headerEl = headerRef.current;
      if (!headerEl) {
        setGeometry(null);
        return;
      }

      const leadingLightBeforeFirst = options.leadingLightBeforeFirst ?? false;
      let leftEdge = leadingLightBeforeFirst ? LIGHT_WIDTH_PX : 0;
      const slots: HeaderLeadingShadeSlot[] = [];

      for (const slot of measureSlots) {
        if (!slot.enabled || !slot.ref.current) continue;

        const controlWidth = measureControlWidth(slot.ref.current);
        if (controlWidth <= 0) continue;

        const width = controlWidth * SHADE_CONTROL_WIDTH_RATIO;
        const left = leftEdge;
        slots.push({
          key: slot.key,
          shade: { left, width },
          lightAfter: { left: left + width },
        });
        leftEdge = left + width + LIGHT_WIDTH_PX;
      }

      if (slots.length === 0) {
        setGeometry(null);
        return;
      }

      const slotsWithLights = slots.map((slot, index) => ({
        ...slot,
        lightAfter: index < slots.length - 1 ? slot.lightAfter : null,
      }));

      const lastSlot = slots[slots.length - 1];
      const alwaysLightAfter =
        options.alwaysLightAfterKey &&
        lastSlot?.key === options.alwaysLightAfterKey
          ? { left: lastSlot.shade.left + lastSlot.shade.width }
          : null;

      const trailingKey = options.placementTrailingLightAfterKey;
      const trailingSlot = trailingKey
        ? slotsWithLights.find((slot) => slot.key === trailingKey)
        : undefined;
      const placementTrailingLight = trailingSlot
        ? { left: trailingSlot.shade.left + trailingSlot.shade.width }
        : null;

      setGeometry({
        slots: slotsWithLights,
        leadingLight: leadingLightBeforeFirst ? { left: 0 } : null,
        alwaysLightAfter,
        placementTrailingLight,
      });
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
    for (const slot of measureSlots) {
      if (!slot.enabled) continue;
      observe(slot.ref.current);
      if (slot.ref.current) {
        observe(slot.ref.current.querySelector("button"));
      }
    }

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure when leading controls change
  }, [
    headerRef,
    options.placementTrailingLightAfterKey,
    options.leadingLightBeforeFirst,
    options.alwaysLightAfterKey,
    ...deps,
  ]);

  return geometry;
}
