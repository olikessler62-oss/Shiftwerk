"use client";

import { useEffect, type ReactNode } from "react";
import { PlanningSidePanel } from "@/components/planning/planning-side-panel";
import { settingsModalBodyPaddingClass } from "@/components/settings/settings-list-ui";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  subtitle?: string;
  subtitleNode?: ReactNode;
  titleId: string;
  onClose: () => void;
  closeDisabled?: boolean;
  dismissOnBackdrop?: boolean;
  closeAriaLabel: string;
  contentReady?: boolean;
  panelClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  headerAside?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

/** Übersichtslisten — gleiches Slide-in-Panel wie Schichtzuweisung. */
export function OverviewSidePanel({
  contentReady = true,
  panelClassName,
  headerClassName,
  bodyClassName,
  ...props
}: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <PlanningSidePanel
      anchor="left"
      size="wide"
      panelClassName={cn(
        !contentReady && "invisible pointer-events-none",
        panelClassName
      )}
      bodyClassName={cn(settingsModalBodyPaddingClass(), "bg-background", bodyClassName)}
      headerClassName={headerClassName}
      {...props}
    />
  );
}
