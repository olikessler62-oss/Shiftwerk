"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useOrgFeatures } from "@/lib/org-features-provider";
import {
  readSimpleCalendarFirstShiftOnlyPreference,
  writeSimpleCalendarFirstShiftOnlyPreference,
} from "@/lib/simple-calendar-display-toggle";

type SimpleCalendarDisplayContextValue = {
  simpleCalendarFirstShiftOnly: boolean;
  setSimpleCalendarFirstShiftOnly: (enabled: boolean) => void;
};

const SimpleCalendarDisplayContext =
  createContext<SimpleCalendarDisplayContextValue | null>(null);

export function SimpleCalendarDisplayProvider({
  children,
}: {
  children: ReactNode;
}) {
  const features = useOrgFeatures();
  const defaultEnabled = !features.areas;
  const [simpleCalendarFirstShiftOnly, setState] = useState(defaultEnabled);

  useEffect(() => {
    setState(readSimpleCalendarFirstShiftOnlyPreference(defaultEnabled));
  }, [defaultEnabled]);

  const value = useMemo(
    (): SimpleCalendarDisplayContextValue => ({
      simpleCalendarFirstShiftOnly,
      setSimpleCalendarFirstShiftOnly: (enabled: boolean) => {
        writeSimpleCalendarFirstShiftOnlyPreference(enabled);
        setState(enabled);
      },
    }),
    [simpleCalendarFirstShiftOnly]
  );

  return (
    <SimpleCalendarDisplayContext.Provider value={value}>
      {children}
    </SimpleCalendarDisplayContext.Provider>
  );
}

export function useSimpleCalendarDisplay(): SimpleCalendarDisplayContextValue {
  const context = useContext(SimpleCalendarDisplayContext);
  if (!context) {
    throw new Error(
      "useSimpleCalendarDisplay must be used within SimpleCalendarDisplayProvider"
    );
  }
  return context;
}
