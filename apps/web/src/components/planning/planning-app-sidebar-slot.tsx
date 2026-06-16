"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PlanningAppSidebarSlotContextValue = {
  content: ReactNode;
  setContent: (content: ReactNode) => void;
};

const PlanningAppSidebarSlotContext =
  createContext<PlanningAppSidebarSlotContextValue | null>(null);

export function PlanningAppSidebarSlotProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [content, setContent] = useState<ReactNode>(null);
  const value = useMemo(
    () => ({
      content,
      setContent,
    }),
    [content]
  );

  return (
    <PlanningAppSidebarSlotContext.Provider value={value}>
      {children}
    </PlanningAppSidebarSlotContext.Provider>
  );
}

export function PlanningAppSidebarSlotMount() {
  const context = useContext(PlanningAppSidebarSlotContext);
  if (!context?.content) return null;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">{context.content}</div>
  );
}

export function usePlanningAppSidebarContent(content: ReactNode) {
  const context = useContext(PlanningAppSidebarSlotContext);

  useLayoutEffect(() => {
    if (!context) return;
    context.setContent(content);
    return () => context.setContent(null);
  }, [context, content]);
}
