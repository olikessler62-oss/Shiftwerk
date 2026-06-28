"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button, CloseIcon } from "@/components/ui";
import {
  settingsFixedNestedOverlayClass,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsNestedModalDialogClass,
} from "@/components/settings/settings-modal-shell";
import { SettingsModalHeader } from "@/components/settings/settings-list-ui";
import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";
import {
  DASHBOARD_MODAL_ROUNDED_CLASS,
  DASHBOARD_PANEL_ROUNDED_CLASS,
} from "@/lib/dashboard-panel-styles";
import { DASHBOARD_UI_BUTTON_CLASS } from "@/lib/dashboard-toolbar-ui";
import {
  formatDashboardStaffingIssueDescription,
  dashboardStaffingIssueKindDotClass,
  type DashboardStaffingIssue,
} from "@/lib/dashboard-area-week-stats";
import { useAppShellModalLockActive } from "@/lib/app-shell-modal-lock";

type Props = {
  areaName: string;
  issues: readonly DashboardStaffingIssue[];
  onClose: () => void;
};

export function DashboardAreaStaffingIssuesModal({
  areaName,
  issues,
  onClose,
}: Props) {
  const t = useTranslations();

  useAppShellModalLockActive(true);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={settingsFixedNestedOverlayClass()}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-staffing-issues-title"
        className={settingsNestedModalDialogClass("2xl", DASHBOARD_MODAL_ROUNDED_CLASS)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SettingsModalHeader
          titleId="dashboard-staffing-issues-title"
          title={t("dashboard.staffingIssuesModalTitle", { area: areaName })}
          subtitle={t("dashboard.staffingIssuesModalSubtitle")}
          onClose={onClose}
          closeAriaLabel={t("common.close")}
        />

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            settingsModalBodyPaddingClass()
          )}
        >
          <ul className="space-y-2">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className={cn(
                  "flex items-start gap-2.5 border border-border/70 bg-background/40 px-3 py-2.5",
                  DASHBOARD_PANEL_ROUNDED_CLASS
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    dashboardStaffingIssueKindDotClass(issue.kind)
                  )}
                  aria-hidden
                />
                <p className="min-w-0 text-sm leading-snug text-foreground">
                  {formatDashboardStaffingIssueDescription(issue, (key, params) =>
                    t(key, params)
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className={settingsModalFooterClass()}>
          <Button
            type="button"
            variant="outline"
            className={DASHBOARD_UI_BUTTON_CLASS}
            onClick={onClose}
          >
            <CloseIcon />
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
