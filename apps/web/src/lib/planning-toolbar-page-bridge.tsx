"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LocationArea, ManagerNotification } from "@schichtwerk/types";
import type { CommunicationOpenOptions } from "@/lib/communication-hub";

export type PlanningToolbarPageBridgeValue = {
  areas?: LocationArea[];
  selectedAreaId?: string | null;
  onAreaChange?: (areaId: string) => void;
  communicationItemCount?: number;
  communicationDisabled?: boolean;
  onOpenCommunication?: (options?: CommunicationOpenOptions) => void;
  onNavigateToWeek?: (weekStart: string) => void;
  managerNotifications?: ManagerNotification[];
};

type PlanningToolbarPageBridgeContextValue = {
  bridge: PlanningToolbarPageBridgeValue;
  setBridge: (value: PlanningToolbarPageBridgeValue) => void;
};

const PlanningToolbarPageBridgeContext =
  createContext<PlanningToolbarPageBridgeContextValue | null>(null);

export function PlanningToolbarPageBridgeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [bridge, setBridge] = useState<PlanningToolbarPageBridgeValue>({});

  const value = useMemo(
    () => ({
      bridge,
      setBridge,
    }),
    [bridge]
  );

  return (
    <PlanningToolbarPageBridgeContext.Provider value={value}>
      {children}
    </PlanningToolbarPageBridgeContext.Provider>
  );
}

export function usePlanningToolbarPageBridgeState(): PlanningToolbarPageBridgeValue {
  return useContext(PlanningToolbarPageBridgeContext)?.bridge ?? {};
}

function bridgeDisplayKey(value: PlanningToolbarPageBridgeValue): string {
  return [
    value.communicationItemCount ?? "",
    value.communicationDisabled ? "1" : "0",
    value.selectedAreaId ?? "",
    value.areas?.map((area) => area.id).join(",") ?? "",
    value.managerNotifications?.map((item) => item.id).join(",") ?? "",
  ].join("|");
}

/** Registriert seiten-spezifische Toolbar-Daten ohne Update-Schleife durch instabile Callback-Referenzen. */
export function useRegisterPlanningToolbarPageBridge(
  value: PlanningToolbarPageBridgeValue
) {
  const setBridge = useContext(PlanningToolbarPageBridgeContext)?.setBridge;
  const valueRef = useRef(value);
  valueRef.current = value;
  const displayKey = bridgeDisplayKey(value);

  useLayoutEffect(() => {
    if (!setBridge) return;
    setBridge(valueRef.current);
    return () => {
      setBridge({});
    };
  }, [setBridge, displayKey]);
}
