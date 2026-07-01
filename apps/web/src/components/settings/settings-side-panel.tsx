"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  PlanningSidePanel,
  usePlanningSidePanelRequestClose,
} from "@/components/planning/planning-side-panel";
import { settingsModalBodyPaddingClass } from "@/components/settings/settings-list-ui";
import { Button, CloseIcon } from "@/components/ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  subtitle?: string;
  subtitleNode?: ReactNode;
  titleId: string;
  onClose: () => void;
  closeDisabled?: boolean;
  closeAriaLabel: string;
  contentReady?: boolean;
  panelClassName?: string;
  bodyClassName?: string;
  headerAside?: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  size?: "default" | "wide";
  children: ReactNode;
};

/** Footer-Schließen — nutzt Slide-out statt sofortiges Unmount. */
export function SettingsSidePanelCloseButton({
  disabled,
}: {
  disabled?: boolean;
}) {
  const t = useTranslations();
  const requestClose = usePlanningSidePanelRequestClose();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={requestClose}
      disabled={disabled}
    >
      <CloseIcon />
      {t("common.close")}
    </Button>
  );
}

/** Einstellungslisten — gleiches Slide-in-Panel wie Übersicht / Schichtzuweisung. */
export function SettingsSidePanel({
  contentReady = true,
  panelClassName,
  bodyClassName,
  overlay,
  size = "wide",
  children,
  ...props
}: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const overlayPortal =
    overlay && typeof document !== "undefined"
      ? createPortal(
          <div
            className="pointer-events-none fixed inset-0 z-[115] md:left-[var(--app-shell-sidebar-width)] [&>*]:pointer-events-auto"
          >
            {overlay}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <PlanningSidePanel
        anchor="left"
        size={size}
        panelClassName={cn(
          !contentReady && "pointer-events-none",
          panelClassName
        )}
        bodyClassName={cn(
          settingsModalBodyPaddingClass(),
          "bg-background",
          bodyClassName,
          !contentReady && "invisible"
        )}
        {...props}
      >
        {children}
      </PlanningSidePanel>
      {overlayPortal}
    </>
  );
}
