"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DashboardAppSidebarSlotContextValue = {
  content: ReactNode;
  setContent: (content: ReactNode) => void;
};

const DashboardAppSidebarSlotContext =
  createContext<DashboardAppSidebarSlotContextValue | null>(null);

export function DashboardAppSidebarSlotProvider({
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
    <DashboardAppSidebarSlotContext.Provider value={value}>
      {children}
    </DashboardAppSidebarSlotContext.Provider>
  );
}

export function DashboardAppSidebarSlotMount() {
  const context = useContext(DashboardAppSidebarSlotContext);
  if (!context?.content) return null;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">{context.content}</div>
  );
}

export function useDashboardAppSidebarContent(content: ReactNode) {
  const context = useContext(DashboardAppSidebarSlotContext);

  useLayoutEffect(() => {
    if (!context) return;
    context.setContent(content);
    return () => context.setContent(null);
  }, [context, content]);
}
