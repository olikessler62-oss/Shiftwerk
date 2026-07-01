"use client";

import { cn } from "@/lib/cn";
import { useTranslations } from "@/i18n/locale-provider";
import type { DashboardAreaDetailScope } from "@/lib/dashboard-drilldown-week-navigation";
import {
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_ACTIVE_CLASS,
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_INACTIVE_CLASS,
  DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_SHELL_CLASS,
} from "@/lib/dashboard-toolbar-ui";

type Props = {
  scope: DashboardAreaDetailScope;
  dayLabel: string;
  weekLabel: string;
  weekShortLabel?: string;
  onScopeChange: (scope: DashboardAreaDetailScope) => void;
  className?: string;
};

export function DashboardAreaScopeToggle({
  scope,
  dayLabel,
  weekLabel,
  weekShortLabel,
  onScopeChange,
  className,
}: Props) {
  const t = useTranslations();
  const weekButtonLabel = weekShortLabel ?? weekLabel;

  return (
    <div
      role="group"
      aria-label={t("dashboard.areaScopeAriaLabel")}
      className={cn(DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_SHELL_CLASS, className)}
    >
      <button
        type="button"
        aria-pressed={scope === "day"}
        title={dayLabel}
        onClick={() => onScopeChange("day")}
        className={
          scope === "day"
            ? DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_ACTIVE_CLASS
            : DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_INACTIVE_CLASS
        }
      >
        <span className="min-w-0 truncate">{dayLabel}</span>
      </button>
      <button
        type="button"
        aria-pressed={scope === "week"}
        title={weekLabel}
        onClick={() => onScopeChange("week")}
        className={
          scope === "week"
            ? DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_ACTIVE_CLASS
            : DASHBOARD_AREA_SCOPE_TOGGLE_DRILLDOWN_INACTIVE_CLASS
        }
      >
        <span className="min-w-0 truncate">{weekButtonLabel}</span>
      </button>
    </div>
  );
}
