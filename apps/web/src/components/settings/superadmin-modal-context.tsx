"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { SuperadminModal } from "@/components/settings/superadmin-modal";

type SuperadminModalContextValue = {
  open: boolean;
  openSuperadminModal: () => void;
  closeSuperadminModal: () => void;
};

const SuperadminModalContext = createContext<SuperadminModalContextValue | null>(
  null
);

type ProviderProps = {
  children: ReactNode;
  enabled?: boolean;
};

export function SuperadminModalProvider({
  children,
  enabled = false,
}: ProviderProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openSuperadminModal = useCallback(() => {
    if (enabled) {
      setOpen(true);
    }
  }, [enabled]);

  const closeSuperadminModal = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      open,
      openSuperadminModal,
      closeSuperadminModal,
    }),
    [closeSuperadminModal, open, openSuperadminModal]
  );

  return (
    <SuperadminModalContext.Provider value={value}>
      {children}
      {mounted && enabled && open
        ? createPortal(
            <SuperadminModal onClose={closeSuperadminModal} />,
            document.body
          )
        : null}
    </SuperadminModalContext.Provider>
  );
}

export function useSuperadminModal(): SuperadminModalContextValue {
  const context = useContext(SuperadminModalContext);
  if (!context) {
    throw new Error("useSuperadminModal must be used within SuperadminModalProvider");
  }
  return context;
}
