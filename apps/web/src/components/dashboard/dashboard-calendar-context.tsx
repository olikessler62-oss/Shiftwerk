"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DashboardCalendarLayerData } from "@/lib/dashboard-calendar-layer-data";

type DashboardCalendarContextValue = {
  ready: boolean;
  data: DashboardCalendarLayerData | null;
  setLayerData: (data: DashboardCalendarLayerData) => void;
};

const DashboardCalendarContext = createContext<DashboardCalendarContextValue | null>(
  null
);

export function DashboardCalendarProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardCalendarLayerData | null>(null);

  const setLayerData = useCallback((layer: DashboardCalendarLayerData) => {
    setData(layer);
  }, []);

  const value = useMemo(
    () => ({
      ready: data !== null,
      data,
      setLayerData,
    }),
    [data, setLayerData]
  );

  return (
    <DashboardCalendarContext.Provider value={value}>
      {children}
    </DashboardCalendarContext.Provider>
  );
}

export function useDashboardCalendarLayer() {
  return useContext(DashboardCalendarContext);
}
