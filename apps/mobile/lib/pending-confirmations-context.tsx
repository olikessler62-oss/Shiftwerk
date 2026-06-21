import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import type {
  ConfirmationWeekItem,
  EmployeeShiftCanceledNotificationItem,
} from "@schichtwerk/types";
import { fetchPendingConfirmations } from "@/lib/confirmations-api";
import { MobileApiError } from "@/lib/mobile-api-client";

type PendingConfirmationsContextValue = {
  count: number;
  items: ConfirmationWeekItem[];
  canceledByManagerItems: EmployeeShiftCanceledNotificationItem[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const PendingConfirmationsContext =
  createContext<PendingConfirmationsContextValue | null>(null);

export function PendingConfirmationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ConfirmationWeekItem[]>([]);
  const [canceledByManagerItems, setCanceledByManagerItems] = useState<
    EmployeeShiftCanceledNotificationItem[]
  >([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetchPendingConfirmations();
      setItems(response.items);
      setCanceledByManagerItems(response.canceledByManagerItems ?? []);
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 403) {
        setItems([]);
        setCanceledByManagerItems([]);
        return;
      }
      if (error instanceof MobileApiError && error.status === 401) {
        setItems([]);
        setCanceledByManagerItems([]);
        return;
      }
      setItems([]);
      setCanceledByManagerItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onAppStateChange(nextState: AppStateStatus) {
      if (nextState === "active") {
        void refresh();
      }
    }
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, [refresh]);

  const value = useMemo(
    () => ({
      count: items.length + canceledByManagerItems.length,
      items,
      canceledByManagerItems,
      loading,
      refresh,
    }),
    [items, canceledByManagerItems, loading, refresh]
  );

  return (
    <PendingConfirmationsContext.Provider value={value}>
      {children}
    </PendingConfirmationsContext.Provider>
  );
}

export function usePendingConfirmations(): PendingConfirmationsContextValue {
  const context = useContext(PendingConfirmationsContext);
  if (!context) {
    throw new Error(
      "usePendingConfirmations must be used within PendingConfirmationsProvider"
    );
  }
  return context;
}
