"use client";

import { Children, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Entspricht `D3_DAY_DRILLDOWN_AREAS_GRID_CLASS`: 1 / sm:2 / xl:3 Spalten. */
function useDrilldownMasonryColumnCount(): number {
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    const xlMedia = window.matchMedia("(min-width: 1280px)");
    const smMedia = window.matchMedia("(min-width: 640px)");

    const sync = () => {
      if (xlMedia.matches) {
        setColumnCount(3);
        return;
      }
      if (smMedia.matches) {
        setColumnCount(2);
        return;
      }
      setColumnCount(1);
    };

    sync();
    xlMedia.addEventListener("change", sync);
    smMedia.addEventListener("change", sync);
    return () => {
      xlMedia.removeEventListener("change", sync);
      smMedia.removeEventListener("change", sync);
    };
  }, []);

  return columnCount;
}

function distributeChildrenAcrossColumns(
  children: readonly ReactNode[],
  columnCount: number
): ReactNode[][] {
  const columns = Array.from({ length: columnCount }, () => [] as ReactNode[]);
  children.forEach((child, index) => {
    columns[index % columnCount]?.push(child);
  });
  return columns;
}

type Props = {
  children: ReactNode;
  className?: string;
};

export function DashboardDayDrilldownAreasMasonry({
  children,
  className,
}: Props) {
  const columnCount = useDrilldownMasonryColumnCount();
  const childList = Children.toArray(children);

  const columns = useMemo(
    () => distributeChildrenAcrossColumns(childList, columnCount),
    [childList, columnCount]
  );

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full items-start gap-4",
        className
      )}
    >
      {columns.map((columnChildren, columnIndex) => (
        <div
          key={columnIndex}
          className="flex min-w-0 flex-1 flex-col gap-4"
        >
          {columnChildren}
        </div>
      ))}
    </div>
  );
}
